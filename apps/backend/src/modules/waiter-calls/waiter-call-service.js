const { getPrismaClient } = require("../../lib/prisma");
const { createHttpError } = require("../../middleware/error-handler");
const { broadcastToStore } = require("../orders/sse-service");

// --- Public (QR Menu) ---

async function createWaiterCall(storeId, input) {
  const prisma = getPrismaClient();
  const { tableId, type } = input;

  if (!tableId || !type) {
    throw createHttpError(400, "tableId and type are required");
  }

  // Spam Filter: Check if a call of the same type is already pending or acknowledged for this table
  const existingCall = await prisma.waiterCall.findFirst({
    where: {
      storeId,
      tableId,
      type,
      status: {
        in: ['PENDING', 'ACKNOWLEDGED']
      }
    }
  });

  if (existingCall) {
    // We return a 200 OK so the frontend doesn't show an error, but we don't create a new DB record.
    return { success: true, message: "A waiter is on the way.", call: existingCall };
  }

  const call = await prisma.waiterCall.create({
    data: {
      storeId,
      tableId,
      type,
      status: 'PENDING'
    },
    include: {
      table: { select: { tableNumber: true } }
    }
  });

  // Broadcast to all staff that a new call has arrived
  broadcastToStore(storeId, "WAITER_CALL_CREATED", call);

  return { success: true, message: "A waiter is on the way.", call };
}

// --- Staff (Waiter/Manager) ---

async function getActiveCalls(storeId) {
  const prisma = getPrismaClient();
  return prisma.waiterCall.findMany({
    where: {
      storeId,
      status: {
        in: ['PENDING', 'ACKNOWLEDGED']
      }
    },
    include: {
      table: { select: { tableNumber: true } },
      resolvedBy: { select: { name: true } }
    },
    orderBy: { createdAt: 'desc' }
  });
}

async function acknowledgeCall(storeId, callId, actorId) {
  const prisma = getPrismaClient();
  
  const call = await prisma.waiterCall.findUnique({
    where: { id: callId }
  });

  if (!call || call.storeId !== storeId) {
    throw createHttpError(404, "Waiter call not found");
  }

  if (call.status !== 'PENDING') {
    throw createHttpError(400, "Call is already acknowledged or resolved");
  }

  const updatedCall = await prisma.waiterCall.update({
    where: { id: callId },
    data: {
      status: 'ACKNOWLEDGED',
      resolvedById: actorId
    },
    include: {
      table: { select: { tableNumber: true } },
      resolvedBy: { select: { name: true } }
    }
  });

  // Broadcast to other tablets so they gray out this call
  broadcastToStore(storeId, "WAITER_CALL_ACKNOWLEDGED", updatedCall);

  return updatedCall;
}

async function resolveCall(storeId, callId) {
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
      status: 'RESOLVED'
    }
  });

  // Broadcast to tablets so they remove this call entirely
  broadcastToStore(storeId, "WAITER_CALL_RESOLVED", updatedCall);

  return updatedCall;
}

module.exports = {
  createWaiterCall,
  getActiveCalls,
  acknowledgeCall,
  resolveCall
};
