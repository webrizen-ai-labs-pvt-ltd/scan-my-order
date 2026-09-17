const { getPrismaClient } = require("../../lib/prisma");
const { broadcastToStore } = require("../orders/sse-service");

/**
 * In-memory active dispatch tracking for waiter calls
 * key: callId -> {
 *   callId,
 *   storeId,
 *   tableId,
 *   tableNumber,
 *   type,
 *   note,
 *   assignedWaiterId: string | null,
 *   assignedWaiterName: string | null,
 *   escalationLevel: number, // 0 = primary, 1 = escalated, 2 = manager
 *   attemptedWaiterIds: string[],
 *   assignedAt: Date,
 *   timeoutTimerRef: NodeJS.Timeout | null,
 *   status: 'PENDING' | 'ACKNOWLEDGED' | 'RESOLVED' | 'CANCELLED'
 * }
 */
const activeDispatches = new Map();

/**
 * Waiter availability state per store
 * key: `${storeId}:${waiterId}` -> { status: 'AVAILABLE' | 'BUSY', lastResolvedAt: Date }
 */
const waiterAvailabilityMap = new Map();

// Helper to get waiter key
const getWaiterKey = (storeId, waiterId) => `${storeId}:${waiterId}`;

/**
 * Set a waiter's current availability
 */
function setWaiterAvailability(storeId, waiterId, status) {
  const key = getWaiterKey(storeId, waiterId);
  const existing = waiterAvailabilityMap.get(key) || { lastResolvedAt: new Date() };
  waiterAvailabilityMap.set(key, {
    ...existing,
    status: status === 'BUSY' ? 'BUSY' : 'AVAILABLE'
  });

  broadcastToStore(storeId, "WAITER_AVAILABILITY_CHANGED", {
    waiterId,
    status: waiterAvailabilityMap.get(key).status
  });

  return waiterAvailabilityMap.get(key);
}

/**
 * Get a waiter's current availability (defaults to AVAILABLE if logged in / not marked BUSY)
 */
function getWaiterAvailability(storeId, waiterId) {
  const key = getWaiterKey(storeId, waiterId);
  return waiterAvailabilityMap.get(key) || { status: 'AVAILABLE', lastResolvedAt: new Date(0) };
}

/**
 * Record that a waiter finished a service task to update idle time
 */
function recordWaiterCompleted(storeId, waiterId) {
  const key = getWaiterKey(storeId, waiterId);
  const existing = waiterAvailabilityMap.get(key) || { status: 'AVAILABLE' };
  waiterAvailabilityMap.set(key, {
    ...existing,
    lastResolvedAt: new Date()
  });
}

/**
 * Score and find the best available waiter for a table call
 *
 * Scoring Formula:
 * Score = (PendingCalls * 40) + (ActiveOrders * 20) - (TableAffinityBonus 30) - (IdleMinutes * 2)
 * The waiter with the lowest score is chosen!
 */
async function findBestWaiter(storeId, tableId, excludedWaiterIds = []) {
  const prisma = getPrismaClient();

  // 1. Fetch all active waiters in this store
  const activeWaiters = await prisma.user.findMany({
    where: {
      storeId,
      role: 'WAITER',
      status: 'ACTIVE'
    },
    select: {
      id: true,
      name: true,
      email: true,
      lastLoginAt: true
    }
  });

  if (!activeWaiters || activeWaiters.length === 0) {
    return null;
  }

  // 2. Filter out excluded waiters (already timed out on this call) and busy waiters
  const candidates = activeWaiters.filter(w => {
    if (excludedWaiterIds.includes(w.id)) return false;
    const avail = getWaiterAvailability(storeId, w.id);
    return avail.status === 'AVAILABLE';
  });

  if (candidates.length === 0) {
    return null;
  }

  // 3. Find if there is a waiter who previously served / verified an order at this table (Table Affinity)
  let affinityWaiterId = null;
  try {
    const recentTableOrder = await prisma.order.findFirst({
      where: {
        storeId,
        tableId,
        status: { in: ['PROCESSING', 'READY', 'SERVED'] }
      },
      orderBy: { createdAt: 'desc' },
      select: { staffId: true }
    });
    if (recentTableOrder && recentTableOrder.staffId) {
      affinityWaiterId = recentTableOrder.staffId;
    }
  } catch (err) {
    // Ignore affinity lookup failure
  }

  // 4. Count active pending calls currently assigned to each waiter
  const pendingCallsPerWaiter = new Map();
  for (const [_, dispatch] of activeDispatches.entries()) {
    if (dispatch.storeId === storeId && dispatch.status === 'PENDING' && dispatch.assignedWaiterId) {
      const current = pendingCallsPerWaiter.get(dispatch.assignedWaiterId) || 0;
      pendingCallsPerWaiter.set(dispatch.assignedWaiterId, current + 1);
    }
  }

  // 5. Score candidates
  const scoredWaiters = await Promise.all(candidates.map(async (waiter) => {
    // Active orders assigned to this waiter
    const activeOrdersCount = await prisma.order.count({
      where: {
        storeId,
        staffId: waiter.id,
        status: { in: ['PROCESSING', 'READY'] }
      }
    });

    const pendingCalls = pendingCallsPerWaiter.get(waiter.id) || 0;
    const isAffinity = affinityWaiterId === waiter.id;

    // Idle minutes calculation
    const avail = getWaiterAvailability(storeId, waiter.id);
    const lastActive = avail.lastResolvedAt > new Date(0) ? avail.lastResolvedAt : (waiter.lastLoginAt || new Date(0));
    const idleMinutes = Math.min(Math.max(Math.floor((Date.now() - new Date(lastActive).getTime()) / 60000), 0), 120);

    // Scoring formula: Lower is better
    const score = (pendingCalls * 40) + (activeOrdersCount * 20) - (isAffinity ? 30 : 0) - (idleMinutes * 2);

    return {
      waiter,
      score,
      pendingCalls,
      activeOrdersCount,
      isAffinity,
      idleMinutes
    };
  }));

  // Sort ascending by score
  scoredWaiters.sort((a, b) => a.score - b.score);

  return scoredWaiters[0]?.waiter || null;
}

/**
 * Dispatch a waiter call with automatic 60-second escalation timer
 */
async function dispatchCall(call, tableNumber, note = '') {
  const storeId = call.storeId;
  const tableId = call.tableId;

  // Clear any old dispatch for this call
  if (activeDispatches.has(call.id)) {
    const old = activeDispatches.get(call.id);
    if (old.timeoutTimerRef) clearTimeout(old.timeoutTimerRef);
  }

  const bestWaiter = await findBestWaiter(storeId, tableId, []);

  const dispatchState = {
    callId: call.id,
    storeId,
    tableId,
    tableNumber,
    type: call.type,
    note: note || '',
    assignedWaiterId: bestWaiter ? bestWaiter.id : null,
    assignedWaiterName: bestWaiter ? bestWaiter.name : null,
    escalationLevel: 0,
    attemptedWaiterIds: bestWaiter ? [bestWaiter.id] : [],
    assignedAt: new Date(),
    timeoutTimerRef: null,
    status: 'PENDING'
  };

  // Schedule 60s escalation timer if a waiter was assigned
  if (bestWaiter) {
    dispatchState.timeoutTimerRef = setTimeout(() => {
      handleCallTimeout(call.id);
    }, 60000); // 60 seconds
  } else {
    // No waiter available immediately -> Escalate to Store Manager / Lead Staff right away
    dispatchState.escalationLevel = 2; // Floor Manager queue
  }

  activeDispatches.set(call.id, dispatchState);

  // Broadcast assignment via SSE to store tablets
  broadcastToStore(storeId, "WAITER_CALL_DISPATCHED", {
    callId: call.id,
    tableId,
    tableNumber,
    type: call.type,
    note,
    assignedWaiterId: dispatchState.assignedWaiterId,
    assignedWaiterName: dispatchState.assignedWaiterName,
    escalationLevel: dispatchState.escalationLevel,
    isManagerEscalation: !bestWaiter,
    assignedAt: dispatchState.assignedAt
  });

  return dispatchState;
}

/**
 * Handle 60s timeout without acknowledgment: Escalate to next waiter or manager
 */
async function handleCallTimeout(callId) {
  const dispatch = activeDispatches.get(callId);
  if (!dispatch || dispatch.status !== 'PENDING') return;

  const { storeId, tableId, tableNumber, type, note, attemptedWaiterIds } = dispatch;

  // Find next best waiter excluding previously attempted non-responsive waiters
  const nextWaiter = await findBestWaiter(storeId, tableId, attemptedWaiterIds);

  if (nextWaiter) {
    // Escalate to next waiter
    dispatch.assignedWaiterId = nextWaiter.id;
    dispatch.assignedWaiterName = nextWaiter.name;
    dispatch.attemptedWaiterIds.push(nextWaiter.id);
    dispatch.escalationLevel += 1;
    dispatch.assignedAt = new Date();

    // Reset 60s timer for the new waiter
    dispatch.timeoutTimerRef = setTimeout(() => {
      handleCallTimeout(callId);
    }, 60000);

    broadcastToStore(storeId, "WAITER_CALL_ESCALATED", {
      callId,
      tableId,
      tableNumber,
      type,
      note,
      previousWaiterId: attemptedWaiterIds[attemptedWaiterIds.length - 2],
      assignedWaiterId: nextWaiter.id,
      assignedWaiterName: nextWaiter.name,
      escalationLevel: dispatch.escalationLevel,
      assignedAt: dispatch.assignedAt
    });
  } else {
    // All waiters tried or none available -> Escalate to Store Manager / Floor Supervisor
    dispatch.assignedWaiterId = null;
    dispatch.assignedWaiterName = null;
    dispatch.escalationLevel = 2; // Manager Alert

    broadcastToStore(storeId, "WAITER_CALL_ESCALATED_MANAGER", {
      callId,
      tableId,
      tableNumber,
      type,
      note,
      escalationLevel: 2,
      message: `Urgent: Table ${tableNumber} has called for ${type} with no waiter response. Manager attention required.`
    });
  }
}

/**
 * Acknowledge a call by the assigned (or responding) waiter
 */
function acknowledgeDispatch(callId, waiterId, waiterName) {
  const dispatch = activeDispatches.get(callId);
  if (dispatch) {
    if (dispatch.timeoutTimerRef) {
      clearTimeout(dispatch.timeoutTimerRef);
      dispatch.timeoutTimerRef = null;
    }
    dispatch.status = 'ACKNOWLEDGED';
    dispatch.assignedWaiterId = waiterId;
    dispatch.assignedWaiterName = waiterName;

    broadcastToStore(dispatch.storeId, "WAITER_CALL_ACKNOWLEDGED", {
      callId,
      tableNumber: dispatch.tableNumber,
      assignedWaiterId: waiterId,
      assignedWaiterName: waiterName,
      status: 'ACKNOWLEDGED'
    });
  }
  return dispatch;
}

/**
 * Resolve a call (waiter finished assisting table)
 */
function resolveDispatch(callId, resolverId) {
  const dispatch = activeDispatches.get(callId);
  if (dispatch) {
    if (dispatch.timeoutTimerRef) {
      clearTimeout(dispatch.timeoutTimerRef);
    }
    dispatch.status = 'RESOLVED';
    if (resolverId) {
      recordWaiterCompleted(dispatch.storeId, resolverId);
    }
    activeDispatches.delete(callId);

    broadcastToStore(dispatch.storeId, "WAITER_CALL_RESOLVED", {
      callId,
      tableId: dispatch.tableId,
      tableNumber: dispatch.tableNumber,
      resolverId,
      status: 'RESOLVED'
    });
  }
  return dispatch;
}

/**
 * Cancel a dispatch (customer or staff cancelled)
 */
function cancelDispatch(callId) {
  const dispatch = activeDispatches.get(callId);
  if (dispatch) {
    if (dispatch.timeoutTimerRef) {
      clearTimeout(dispatch.timeoutTimerRef);
    }
    dispatch.status = 'CANCELLED';
    activeDispatches.delete(callId);

    broadcastToStore(dispatch.storeId, "WAITER_CALL_CANCELLED", {
      callId,
      tableId: dispatch.tableId,
      tableNumber: dispatch.tableNumber,
      status: 'CANCELLED'
    });
  }
  return dispatch;
}

/**
 * Get active dispatch state for a call or table
 */
function getActiveDispatch(callId) {
  return activeDispatches.get(callId) || null;
}

function getActiveDispatchForTable(storeId, tableId) {
  for (const [_, dispatch] of activeDispatches.entries()) {
    if (dispatch.storeId === storeId && dispatch.tableId === tableId && (dispatch.status === 'PENDING' || dispatch.status === 'ACKNOWLEDGED')) {
      return dispatch;
    }
  }
  return null;
}

module.exports = {
  findBestWaiter,
  dispatchCall,
  handleCallTimeout,
  acknowledgeDispatch,
  resolveDispatch,
  cancelDispatch,
  getActiveDispatch,
  getActiveDispatchForTable,
  setWaiterAvailability,
  getWaiterAvailability
};
