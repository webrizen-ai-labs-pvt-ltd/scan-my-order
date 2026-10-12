const { getPrismaClient } = require("../../lib/prisma");
const { createHttpError } = require("../../middleware/error-handler");
const { verifyStoreAccess } = require("../menu/menu-service");
const { broadcastToStore } = require("../orders/sse-service");
const { tablesStatusCache, invalidateTablesCache } = require("../../lib/cache");

async function getTables(actor, storeId) {
  await verifyStoreAccess(actor, storeId);
  
  const cached = tablesStatusCache.get(storeId);
  if (cached) {
    return cached;
  }

  const prisma = getPrismaClient();
  
  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
  const todayEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);

  // 1. Fetch tables with core relations
  const rawTables = await prisma.table.findMany({
    where: { storeId },
    include: {
      orders: {
        where: {
          status: { in: ['DRAFT', 'PENDING_PAYMENT', 'PENDING_VERIFICATION', 'PROCESSING', 'READY', 'SERVED'] }
        },
        orderBy: { createdAt: 'desc' },
        take: 1
      },
      sessions: {
        where: { status: 'ACTIVE' },
        take: 1
      },
      waiterCalls: {
        where: {
          status: { in: ['PENDING', 'ACKNOWLEDGED'] }
        },
        orderBy: { createdAt: 'desc' },
        take: 1
      }
    },
    orderBy: { tableNumber: 'asc' }
  });

  // Unpaid running bill per table (drives the POS table board)
  const unpaidByTable = new Map();
  const unpaidGroups = await prisma.order.groupBy({
    by: ['tableId'],
    where: {
      storeId,
      tableId: { not: null },
      status: { in: ['PENDING_VERIFICATION', 'PENDING_PAYMENT', 'PROCESSING', 'READY', 'SERVED'] },
      paidAt: null
    },
    _sum: { totalAmount: true },
    _count: { _all: true }
  });
  for (const g of unpaidGroups) {
    unpaidByTable.set(g.tableId, { amount: g._sum.totalAmount || 0, count: g._count._all });
  }

  // 2. Safely look up reservations for today if model exists in Prisma client
  const reservationsByTable = new Map();
  if (prisma.tableReservation) {
    try {
      const activeReservations = await prisma.tableReservation.findMany({
        where: {
          storeId,
          status: { in: ['CONFIRMED', 'SEATED'] },
          startsAt: { lte: todayEnd },
          endsAt: { gte: todayStart }
        },
        orderBy: { startsAt: 'asc' }
      });
      for (const res of activeReservations) {
        if (!reservationsByTable.has(res.tableId)) {
          reservationsByTable.set(res.tableId, []);
        }
        reservationsByTable.get(res.tableId).push(res);
      }
    } catch (e) {
      console.warn('[Table Service] Reservations lookup skipped:', e.message || e);
    }
  }

  const result = rawTables.map(tbl => {
    const activeOrder = tbl.orders[0] || null;
    const activeSession = tbl.sessions?.[0] || null;
    const isOccupied = Boolean(activeOrder || activeSession);

    // Check if table is currently reserved (within 45 min buffer or right now)
    const tableReservations = reservationsByTable.get(tbl.id) || [];
    const currentOrNextReservation = tableReservations.find(r => new Date(r.endsAt).getTime() >= now.getTime()) || null;
    const isReserved = Boolean(
      currentOrNextReservation &&
      new Date(currentOrNextReservation.startsAt).getTime() <= (now.getTime() + 45 * 60 * 1000) &&
      new Date(currentOrNextReservation.endsAt).getTime() >= now.getTime()
    );

    let status = 'AVAILABLE';
    if (isOccupied) {
      status = 'OCCUPIED';
    } else if (isReserved) {
      status = 'RESERVED';
    }

    return {
      id: tbl.id,
      storeId: tbl.storeId,
      tableNumber: tbl.tableNumber,
      capacity: tbl.capacity,
      isActive: tbl.isActive,
      status,
      isOccupied,
      isReserved,
      isAvailable: status === 'AVAILABLE',
      activeReservation: isReserved ? currentOrNextReservation : null,
      nextReservation: currentOrNextReservation,
      currentOrder: activeOrder ? {
        id: activeOrder.id,
        status: activeOrder.status,
        totalAmount: activeOrder.totalAmount
      } : null,
      unpaidTotal: unpaidByTable.get(tbl.id)?.amount || 0,
      unpaidOrderCount: unpaidByTable.get(tbl.id)?.count || 0,
      activePin: activeSession?.pin || null,
      activeSessionId: activeSession?.id || null,
      activeSessionCreatedAt: activeSession?.createdAt || null,
      createdAt: tbl.createdAt,
      updatedAt: tbl.updatedAt
    };
  });

  tablesStatusCache.set(storeId, result);
  return result;
}

async function createTable(actor, storeId, input) {
  await verifyStoreAccess(actor, storeId);
  const prisma = getPrismaClient();
  const { tableNumber, capacity } = input;
  
  if (typeof tableNumber !== "number") {
    throw createHttpError(400, "tableNumber is required and must be a number");
  }
  
  // Check if tableNumber already exists for this store
  const existing = await prisma.table.findUnique({
    where: {
      storeId_tableNumber: {
        storeId,
        tableNumber
      }
    }
  });
  
  if (existing) {
    throw createHttpError(409, `Table number ${tableNumber} already exists`);
  }
  
  const created = await prisma.table.create({
    data: {
      storeId,
      tableNumber,
      capacity: capacity ? parseInt(capacity, 10) : 4
    }
  });
  invalidateTablesCache(storeId);
  return created;
}

async function updateTable(actor, storeId, tableId, input) {
  await verifyStoreAccess(actor, storeId);
  const prisma = getPrismaClient();
  
  const table = await prisma.table.findUnique({ where: { id: tableId } });
  if (!table || table.storeId !== storeId) {
    throw createHttpError(404, "Table not found");
  }

  const updateData = {};
  if (input.tableNumber !== undefined) {
    const num = parseInt(input.tableNumber, 10);
    if (isNaN(num)) throw createHttpError(400, "tableNumber must be a valid number");
    if (num !== table.tableNumber) {
      const existing = await prisma.table.findUnique({
        where: { storeId_tableNumber: { storeId, tableNumber: num } }
      });
      if (existing) throw createHttpError(409, `Table number ${num} already exists`);
      updateData.tableNumber = num;
    }
  }

  if (input.capacity !== undefined) {
    const cap = parseInt(input.capacity, 10);
    if (isNaN(cap) || cap < 1) throw createHttpError(400, "capacity must be at least 1");
    updateData.capacity = cap;
  }

  if (input.isActive !== undefined) {
    updateData.isActive = Boolean(input.isActive);
  }

  const updated = await prisma.table.update({
    where: { id: tableId },
    data: updateData
  });
  invalidateTablesCache(storeId);
  return updated;
}

async function deleteTable(actor, storeId, tableId) {
  await verifyStoreAccess(actor, storeId);
  const prisma = getPrismaClient();
  
  const table = await prisma.table.findUnique({ where: { id: tableId } });
  if (!table || table.storeId !== storeId) {
    throw createHttpError(404, "Table not found");
  }
  
  // Alternatively, just mark isActive = false if you want soft delete
  const res = await prisma.table.delete({
    where: { id: tableId }
  });
  invalidateTablesCache(storeId);
  return res;
}

async function terminateTableSession(actor, storeId, tableId) {
  await verifyStoreAccess(actor, storeId);
  const prisma = getPrismaClient();

  const activeSession = await prisma.tableSession.findFirst({
    where: {
      storeId,
      tableId,
      status: 'ACTIVE'
    }
  });

  if (!activeSession) {
    throw createHttpError(404, "No active dining session found for this table");
  }

  // Releasing a table must never record money that wasn't collected
  const unpaid = await prisma.order.findMany({
    where: {
      tableSessionId: activeSession.id,
      status: { notIn: ['SETTLED', 'CANCELLED'] },
      paidAt: null
    },
    select: { id: true, totalAmount: true }
  });
  if (unpaid.length > 0) {
    const due = unpaid.reduce((sum, o) => sum + o.totalAmount, 0);
    throw createHttpError(409, `Table has ${unpaid.length} unpaid order(s) worth ₹${due}. Collect payment or cancel them before releasing the table.`);
  }

  const session = await prisma.tableSession.update({
    where: { id: activeSession.id },
    data: { status: 'SETTLED' }
  });
  broadcastToStore(storeId, 'TABLE_UPDATED', { tableId, tableSessionId: session.id });
  invalidateTablesCache(storeId);
  return { success: true, message: "Table session terminated and table released successfully", session };
}

const RELEASE_ROLES = ['STORE_MANAGER', 'TENANT_ADMIN', 'SUPER_ADMIN'];
const OPEN_ORDER_STATUSES = ['DRAFT', 'PENDING_VERIFICATION', 'PENDING_PAYMENT', 'PROCESSING', 'READY', 'SERVED'];

/**
 * A manager frees one or more tables no matter what state they are stuck in, so service can go on.
 * - the table's open bill is closed and its PIN reset
 * - unpaid orders still on the table are cancelled with the manager's reason (they show under
 *   Leakages); paid orders and recorded payments are left exactly as they are
 * - half-finished payment attempts (an open QR) are withdrawn
 * A reason is required whenever something unpaid would be cancelled.
 *
 * @param {object} input
 * @param {string[]} input.tableIds
 * @param {string} [input.reason]
 * @returns {Promise<{ released: Array<{ tableId: string, tableNumber: number, cancelledOrders: number, cancelledAmount: number }> }>}
 */
async function releaseTables(actor, storeId, input = {}) {
  if (!actor || !RELEASE_ROLES.includes(actor.role)) throw createHttpError(403, "Only managers can release tables");
  await verifyStoreAccess(actor, storeId);
  const prisma = getPrismaClient();

  const tableIds = [...new Set(Array.isArray(input.tableIds) ? input.tableIds.map(String) : [])].slice(0, 200);
  if (tableIds.length === 0) throw createHttpError(400, "Choose at least one table to release");
  const reason = typeof input.reason === 'string' ? input.reason.trim().slice(0, 160) : '';

  const [tables, sessions, unpaid] = await Promise.all([
    prisma.table.findMany({ where: { storeId, id: { in: tableIds } }, select: { id: true, tableNumber: true } }),
    prisma.tableSession.findMany({ where: { storeId, tableId: { in: tableIds }, status: 'ACTIVE' }, select: { id: true, tableId: true } }),
    // Every unpaid open order at these tables, including ones left behind on a bill that was already closed
    prisma.order.findMany({
      where: { storeId, tableId: { in: tableIds }, paidAt: null, status: { in: OPEN_ORDER_STATUSES } },
      select: { id: true, tableId: true, totalAmount: true }
    })
  ]);
  if (tables.length === 0) throw createHttpError(404, "Those tables aren't in this store");
  if (unpaid.length > 0 && reason.length < 3) {
    const due = unpaid.reduce((sum, o) => sum + o.totalAmount, 0);
    throw createHttpError(400, `${unpaid.length} unpaid ${unpaid.length === 1 ? 'order' : 'orders'} worth ₹${due} would be cancelled. Give a reason to release anyway.`, { code: "REASON_REQUIRED" });
  }

  const { updateOrderStatus } = require("../orders/order-service");
  const { cancelPendingPaymentsFor } = require("../payments/payment-service");
  const { logOrderEvent } = require("../audit/audit-service");

  const released = [];
  for (const table of tables) {
    const mine = unpaid.filter(o => o.tableId === table.id);
    let cancelledOrders = 0;
    let cancelledAmount = 0;
    for (const order of mine) {
      // As the system, so an order in any state can be closed; the manager is still recorded as who did it
      await updateOrderStatus(actor, storeId, order.id, 'CANCELLED', true, { reason: `Table released: ${reason}` });
      await prisma.order.updateMany({ where: { id: order.id, cancelledById: null }, data: { cancelledById: actor.id } });
      cancelledOrders += 1;
      cancelledAmount += order.totalAmount;
    }

    const tableSessions = sessions.filter(s => s.tableId === table.id);
    for (const session of tableSessions) {
      await cancelPendingPaymentsFor(storeId, { tableSessionId: session.id }).catch(() => {});
      await prisma.tableSession.updateMany({ where: { id: session.id, status: 'ACTIVE' }, data: { status: 'SETTLED' } });
      await logOrderEvent({
        storeId,
        tableSessionId: session.id,
        type: 'TABLE_RELEASED',
        actor,
        reason: reason || null,
        amountBefore: cancelledAmount,
        amountAfter: 0,
        data: { table: table.tableNumber, cancelledOrders }
      });
    }

    if (tableSessions.length > 0 || cancelledOrders > 0) {
      released.push({ tableId: table.id, tableNumber: table.tableNumber, cancelledOrders, cancelledAmount });
      broadcastToStore(storeId, 'TABLE_UPDATED', { tableId: table.id });
    }
  }
  invalidateTablesCache(storeId);
  return { released };
}

module.exports = {
  releaseTables,
  getTables,
  createTable,
  updateTable,
  deleteTable,
  terminateTableSession
};
