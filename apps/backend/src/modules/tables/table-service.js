const { getPrismaClient } = require("../../lib/prisma");
const { createHttpError } = require("../../middleware/error-handler");
const { verifyStoreAccess } = require("../menu/menu-service");

async function getTables(actor, storeId) {
  await verifyStoreAccess(actor, storeId);
  const prisma = getPrismaClient();
  
  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
  const todayEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);

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
      },
      reservations: {
        where: {
          status: { in: ['CONFIRMED', 'SEATED'] },
          startsAt: { lte: todayEnd },
          endsAt: { gte: todayStart }
        },
        orderBy: { startsAt: 'asc' }
      }
    },
    orderBy: { tableNumber: 'asc' }
  });

  return rawTables.map(tbl => {
    const activeOrder = tbl.orders[0] || null;
    const activeSession = tbl.sessions?.[0] || null;
    const isOccupied = Boolean(activeOrder || activeSession);

    // Check if table is currently reserved (within 45 min buffer or right now)
    const currentOrNextReservation = (tbl.reservations || []).find(r => new Date(r.endsAt).getTime() >= now.getTime()) || null;
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
      activePin: activeSession?.pin || null,
      createdAt: tbl.createdAt,
      updatedAt: tbl.updatedAt
    };
  });
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
  
  return await prisma.table.create({
    data: {
      storeId,
      tableNumber,
      capacity: capacity ? parseInt(capacity, 10) : 4
    }
  });
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

  return await prisma.table.update({
    where: { id: tableId },
    data: updateData
  });
}

async function deleteTable(actor, storeId, tableId) {
  await verifyStoreAccess(actor, storeId);
  const prisma = getPrismaClient();
  
  const table = await prisma.table.findUnique({ where: { id: tableId } });
  if (!table || table.storeId !== storeId) {
    throw createHttpError(404, "Table not found");
  }
  
  // Alternatively, just mark isActive = false if you want soft delete
  return await prisma.table.delete({
    where: { id: tableId }
  });
}

module.exports = {
  getTables,
  createTable,
  updateTable,
  deleteTable
};
