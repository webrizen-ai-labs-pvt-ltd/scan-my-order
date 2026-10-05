const { getPrismaClient } = require("../../lib/prisma");
const { createHttpError } = require("../../middleware/error-handler");
const { broadcastToStore } = require("../orders/sse-service");
const { sendNotification } = require("../notifications/notification-service");
const dispatchEngine = require("./waiter-dispatch-engine");
const { CALL_TYPE_LABELS, callTypeLabel } = require("./call-types");

// Helper to safely map customer call types to DB enum (WATER, BILL, CALL_WAITER)
function mapToDbCallType(type) {
  return Object.prototype.hasOwnProperty.call(CALL_TYPE_LABELS, type) ? type : 'CALL_WAITER';
}

/** Dispatch details stored on the call (include `assignedWaiter` and `resolvedBy` names) */
function dispatchView(call) {
  return {
    assignedWaiterId: call.assignedWaiterId || call.resolvedById || null,
    assignedWaiterName: call.assignedWaiter?.name || call.resolvedBy?.name || null,
    escalationLevel: call.escalationLevel || 0,
    assignedAt: call.assignedAt || call.createdAt,
    status: call.status
  };
}

const DISPATCH_INCLUDE = {
  assignedWaiter: { select: { id: true, name: true } },
  resolvedBy: { select: { id: true, name: true } }
};

// --- Public (QR Menu) ---

async function createWaiterCall(storeId, input) {
  const prisma = getPrismaClient();
  let { tableId, tableNumber, type, note } = input;

  // Resolve tableId from tableNumber if not passed directly
  if (!tableId && tableNumber != null) {
    const tbl = await prisma.table.findFirst({
      where: {
        storeId,
        tableNumber: parseInt(tableNumber, 10),
        isActive: true
      }
    });
    if (!tbl) throw createHttpError(404, `Table ${tableNumber} not found in this store`);
    tableId = tbl.id;
  }

  if (!tableId) {
    throw createHttpError(400, "tableId or valid tableNumber is required");
  }

  const dbType = mapToDbCallType(type);
  note = typeof note === 'string' ? note.trim().slice(0, 100) : '';

  // Anti-Spam Filter: Check if a call is already active for this table within last 60 seconds
  const existingCall = await prisma.waiterCall.findFirst({
    where: {
      storeId,
      tableId,
      status: { in: ['PENDING', 'ACKNOWLEDGED'] }
    },
    include: {
      table: { select: { tableNumber: true } },
      ...DISPATCH_INCLUDE
    },
    orderBy: { createdAt: 'desc' }
  });

  if (existingCall) {
    const { assignedWaiterName, status, escalationLevel, assignedAt } = dispatchView(existingCall);
    return {
      success: true,
      message: existingCall.status === 'ACKNOWLEDGED'
        ? "A waiter has acknowledged and is on the way."
        : "A waiter is already being paged for your table.",
      call: existingCall,
      dispatch: { assignedWaiterName, status, escalationLevel, assignedAt }
    };
  }

  // Create call record in DB
  const call = await prisma.waiterCall.create({
    data: {
      storeId,
      tableId,
      type: dbType,
      note: note || null,
      status: 'PENDING'
    },
    include: {
      table: { select: { tableNumber: true } }
    }
  });

  // Run the Intelligent Dispatch Engine (with 60-second escalation timer)
  const dispatchState = await dispatchEngine.dispatchCall(call, call.table?.tableNumber, note);

  // Broadcast to store staff
  broadcastToStore(storeId, "WAITER_CALL_CREATED", {
    ...call,
    dispatch: {
      assignedWaiterId: dispatchState.assignedWaiterId,
      assignedWaiterName: dispatchState.assignedWaiterName,
      escalationLevel: dispatchState.escalationLevel,
      note: dispatchState.note,
      assignedAt: dispatchState.assignedAt
    }
  });

  const tblNumber = call.table?.tableNumber || '';
  sendNotification({
    storeId,
    type: 'WAITER_CALL',
    title: `Table ${tblNumber} Request`,
    body: `Customer requested: ${callTypeLabel(dbType)}${note ? ` (${note})` : ''}`,
    data: {
      callId: call.id,
      tableId: call.tableId,
      tableNumber: tblNumber,
      sound: 'notification.mp3',
      url: '/waiter'
    },
    target: dispatchState.assignedWaiterId
      ? { userId: dispatchState.assignedWaiterId, role: 'WAITER', storeId }
      : { role: 'WAITER', storeId }
  }).catch(() => {});

  return {
    success: true,
    message: dispatchState.assignedWaiterName
      ? `Waiter ${dispatchState.assignedWaiterName} has been assigned to your table.`
      : "Our team has been notified and the next available server is on the way.",
    call,
    dispatch: {
      assignedWaiterName: dispatchState.assignedWaiterName,
      status: dispatchState.status,
      escalationLevel: dispatchState.escalationLevel,
      assignedAt: dispatchState.assignedAt
    }
  };
}

/**
 * Get active call status for customer table
 */
async function getTableCallStatus(storeId, tableIdentifier) {
  const prisma = getPrismaClient();

  let whereTable = { storeId };
  if (isNaN(tableIdentifier)) {
    whereTable.id = tableIdentifier;
  } else {
    whereTable.tableNumber = parseInt(tableIdentifier, 10);
  }

  const table = await prisma.table.findFirst({
    where: whereTable,
    select: { id: true, tableNumber: true }
  });

  if (!table) return { hasActiveCall: false };

  const activeCall = await prisma.waiterCall.findFirst({
    where: {
      storeId,
      tableId: table.id,
      status: { in: ['PENDING', 'ACKNOWLEDGED'] }
    },
    include: DISPATCH_INCLUDE,
    orderBy: { createdAt: 'desc' }
  });

  if (!activeCall) return { hasActiveCall: false, tableNumber: table.tableNumber };

  const dispatch = dispatchView(activeCall);

  return {
    hasActiveCall: true,
    callId: activeCall.id,
    tableId: table.id,
    tableNumber: table.tableNumber,
    type: activeCall.type,
    status: activeCall.status,
    createdAt: activeCall.createdAt,
    assignedWaiterName: dispatch.assignedWaiterName,
    escalationLevel: dispatch.escalationLevel,
    note: activeCall.note || ''
  };
}

/**
 * Cancel an active call by customer or staff
 */
async function cancelWaiterCall(storeId, callId) {
  const prisma = getPrismaClient();

  const call = await prisma.waiterCall.findUnique({
    where: { id: callId },
    include: { table: { select: { tableNumber: true } } }
  });

  if (!call || call.storeId !== storeId) {
    throw createHttpError(404, "Waiter call not found");
  }

  // Cancelled calls aren't kept (deleteMany: a second cancel is harmless)
  const removed = await prisma.waiterCall.deleteMany({ where: { id: callId, storeId } });
  if (removed.count > 0) {
    broadcastToStore(storeId, "WAITER_CALL_CANCELLED", {
      callId,
      tableId: call.tableId,
      tableNumber: call.table?.tableNumber,
      status: 'CANCELLED'
    });
  }

  return { success: true, message: "Call request cancelled" };
}

// --- Staff (Waiter/Manager) ---

async function getActiveCalls(storeId) {
  const prisma = getPrismaClient();
  const calls = await prisma.waiterCall.findMany({
    where: {
      storeId,
      status: { in: ['PENDING', 'ACKNOWLEDGED'] }
    },
    include: {
      table: { select: { id: true, tableNumber: true, capacity: true } },
      ...DISPATCH_INCLUDE
    },
    orderBy: { createdAt: 'desc' }
  });

  return calls.map(c => {
    const dispatch = dispatchView(c);
    // Seconds the paged waiter has left before it moves on
    const remainingSeconds = c.escalateAt ? Math.max(0, Math.ceil((new Date(c.escalateAt).getTime() - Date.now()) / 1000)) : 0;
    return {
      ...c,
      assignedWaiterId: dispatch.assignedWaiterId,
      assignedWaiterName: dispatch.assignedWaiterName,
      escalationLevel: dispatch.escalationLevel,
      assignedAt: dispatch.assignedAt,
      note: c.note || '',
      remainingSeconds
    };
  });
}

async function acknowledgeCall(storeId, callId, actor) {
  const prisma = getPrismaClient();

  const call = await prisma.waiterCall.findUnique({
    where: { id: callId },
    include: { table: { select: { tableNumber: true } } }
  });

  if (!call || call.storeId !== storeId) {
    throw createHttpError(404, "Waiter call not found");
  }

  if (call.status !== 'PENDING') {
    return { success: true, message: "Call is already acknowledged or resolved", call };
  }

  // Only the first waiter to tap gets it; this also stops the escalation countdown
  const claim = await prisma.waiterCall.updateMany({
    where: { id: callId, status: 'PENDING' },
    data: { status: 'ACKNOWLEDGED', resolvedById: actor.id, assignedWaiterId: actor.id, escalateAt: null }
  });
  if (claim.count === 0) {
    return { success: true, message: "Call is already acknowledged or resolved", call };
  }

  const updatedCall = await prisma.waiterCall.findUnique({
    where: { id: callId },
    include: {
      table: { select: { tableNumber: true } },
      resolvedBy: { select: { name: true } }
    }
  });

  // Broadcast acknowledgment to store
  broadcastToStore(storeId, "WAITER_CALL_ACKNOWLEDGED", {
    callId,
    tableId: call.tableId,
    tableNumber: updatedCall.table?.tableNumber,
    assignedWaiterId: actor.id,
    assignedWaiterName: actor.name,
    status: 'ACKNOWLEDGED'
  });

  return updatedCall;
}

async function resolveCall(storeId, callId, actorId) {
  const prisma = getPrismaClient();

  const call = await prisma.waiterCall.findUnique({
    where: { id: callId }
  });

  if (!call || call.storeId !== storeId) {
    throw createHttpError(404, "Waiter call not found");
  }

  if (call.status === 'RESOLVED') return call;

  const resolverId = actorId || call.resolvedById;
  const claim = await prisma.waiterCall.updateMany({
    where: { id: callId, status: { in: ['PENDING', 'ACKNOWLEDGED'] } },
    data: { status: 'RESOLVED', resolvedById: resolverId, escalateAt: null }
  });
  const updatedCall = await prisma.waiterCall.findUnique({
    where: { id: callId },
    include: { table: { select: { tableNumber: true } } }
  });
  if (claim.count === 0) return updatedCall;

  // Their idle time starts now (idle waiters are paged first)
  if (resolverId) {
    await dispatchEngine.recordWaiterCompleted(storeId, resolverId).catch(err => console.error('[Waiter calls] presence update failed:', err.message));
  }

  // Store screens (live floor, dashboard, waiter tasks)
  broadcastToStore(storeId, "WAITER_CALL_RESOLVED", {
    callId,
    tableId: call.tableId,
    tableNumber: updatedCall?.table?.tableNumber,
    resolverId,
    resolvedById: resolverId,
    status: 'RESOLVED'
  });

  return updatedCall;
}

module.exports = {
  createWaiterCall,
  getTableCallStatus,
  cancelWaiterCall,
  getActiveCalls,
  acknowledgeCall,
  resolveCall,
  setWaiterAvailability: dispatchEngine.setWaiterAvailability,
  getWaiterAvailability: dispatchEngine.getWaiterAvailability
};
