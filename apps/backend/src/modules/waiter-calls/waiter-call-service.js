const { getPrismaClient } = require("../../lib/prisma");
const { createHttpError } = require("../../middleware/error-handler");
const { broadcastToStore } = require("../orders/sse-service");
const dispatchEngine = require("./waiter-dispatch-engine");

// Helper to safely map customer call types to DB enum (WATER, BILL, CALL_WAITER)
function mapToDbCallType(type) {
  if (type === 'WATER' || type === 'BILL') return type;
  return 'CALL_WAITER';
}

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

  // Anti-Spam Filter: Check if a call is already active for this table within last 60 seconds
  const existingCall = await prisma.waiterCall.findFirst({
    where: {
      storeId,
      tableId,
      status: { in: ['PENDING', 'ACKNOWLEDGED'] }
    },
    include: {
      table: { select: { tableNumber: true } }
    },
    orderBy: { createdAt: 'desc' }
  });

  if (existingCall) {
    const dispatch = dispatchEngine.getActiveDispatch(existingCall.id);
    return {
      success: true,
      message: existingCall.status === 'ACKNOWLEDGED'
        ? "A waiter has acknowledged and is on the way."
        : "A waiter is already being paged for your table.",
      call: existingCall,
      dispatch: dispatch ? {
        assignedWaiterName: dispatch.assignedWaiterName,
        status: dispatch.status,
        escalationLevel: dispatch.escalationLevel,
        assignedAt: dispatch.assignedAt
      } : null
    };
  }

  // Create call record in DB
  const call = await prisma.waiterCall.create({
    data: {
      storeId,
      tableId,
      type: dbType,
      status: 'PENDING'
    },
    include: {
      table: { select: { tableNumber: true } }
    }
  });

  // Run the Intelligent Dispatch Engine (with 60-second escalation timer)
  const dispatchState = await dispatchEngine.dispatchCall(call, call.table?.tableNumber, note || type);

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
    include: {
      resolvedBy: { select: { name: true } }
    },
    orderBy: { createdAt: 'desc' }
  });

  if (!activeCall) return { hasActiveCall: false, tableNumber: table.tableNumber };

  const dispatch = dispatchEngine.getActiveDispatch(activeCall.id);

  return {
    hasActiveCall: true,
    callId: activeCall.id,
    tableId: table.id,
    tableNumber: table.tableNumber,
    type: activeCall.type,
    status: activeCall.status,
    createdAt: activeCall.createdAt,
    assignedWaiterName: dispatch?.assignedWaiterName || activeCall.resolvedBy?.name || null,
    escalationLevel: dispatch?.escalationLevel || 0,
    note: dispatch?.note || ''
  };
}

/**
 * Cancel an active call by customer or staff
 */
async function cancelWaiterCall(storeId, callId) {
  const prisma = getPrismaClient();

  const call = await prisma.waiterCall.findUnique({
    where: { id: callId }
  });

  if (!call || call.storeId !== storeId) {
    throw createHttpError(404, "Waiter call not found");
  }

  // Delete or mark resolved
  await prisma.waiterCall.delete({
    where: { id: callId }
  });

  dispatchEngine.cancelDispatch(callId);

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
      resolvedBy: { select: { id: true, name: true } }
    },
    orderBy: { createdAt: 'desc' }
  });

  // Augment with active dispatch engine state
  return calls.map(c => {
    const dispatch = dispatchEngine.getActiveDispatch(c.id);
    let remainingSeconds = 60;
    if (dispatch?.assignedAt) {
      const elapsed = Math.floor((Date.now() - new Date(dispatch.assignedAt).getTime()) / 1000);
      remainingSeconds = Math.max(0, 60 - elapsed);
    }

    return {
      ...c,
      assignedWaiterId: dispatch?.assignedWaiterId || c.resolvedById || null,
      assignedWaiterName: dispatch?.assignedWaiterName || c.resolvedBy?.name || null,
      escalationLevel: dispatch?.escalationLevel || 0,
      note: dispatch?.note || '',
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

  const updatedCall = await prisma.waiterCall.update({
    where: { id: callId },
    data: {
      status: 'ACKNOWLEDGED',
      resolvedById: actor.id
    },
    include: {
      table: { select: { tableNumber: true } },
      resolvedBy: { select: { name: true } }
    }
  });

  // Stop 60s timer and record acknowledgment in dispatch engine
  dispatchEngine.acknowledgeDispatch(callId, actor.id, actor.name);

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

  const updatedCall = await prisma.waiterCall.update({
    where: { id: callId },
    data: {
      status: 'RESOLVED',
      resolvedById: actorId || call.resolvedById
    }
  });

  // Clear dispatch tracking and record waiter idle start
  dispatchEngine.resolveDispatch(callId, actorId || call.resolvedById);

  // Always broadcast resolved event to store screens (live floor, dashboard, waiter tasks)
  broadcastToStore(storeId, "WAITER_CALL_RESOLVED", {
    callId,
    tableId: call.tableId,
    resolvedById: actorId || call.resolvedById,
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
