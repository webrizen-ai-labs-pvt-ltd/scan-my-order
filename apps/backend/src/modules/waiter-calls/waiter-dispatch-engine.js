const { getPrismaClient } = require("../../lib/prisma");
const { broadcastToStore } = require("../orders/sse-service");
const { sendNotification } = require("../notifications/notification-service");
const { callTypeLabel } = require("./call-types");

/**
 * Waiter call dispatch. Everything lives on the WaiterCall row (assigned waiter, who was already
 * tried, escalation level, when it moves on), and waiter availability in WaiterPresence, so a
 * restart or a deploy never drops a call.
 *
 * Escalation: a sweeper looks for calls whose 60 s ran out every few seconds. Each escalation is
 * claimed with a conditional update, so it happens once even if two servers run during a deploy.
 */

const ANSWER_WITHIN_MS = 60 * 1000;
const SWEEP_EVERY_MS = 5 * 1000;
const MANAGER_LEVEL = 2;

/* ---------- waiter availability ---------- */

function presenceView(row) {
  return { status: row?.status || 'AVAILABLE', lastResolvedAt: row?.lastResolvedAt || new Date(0) };
}

/** Set a waiter's availability (Busy waiters aren't paged) */
async function setWaiterAvailability(storeId, waiterId, status) {
  const value = status === 'BUSY' ? 'BUSY' : 'AVAILABLE';
  const row = await getPrismaClient().waiterPresence.upsert({
    where: { storeId_userId: { storeId, userId: waiterId } },
    create: { storeId, userId: waiterId, status: value },
    update: { status: value }
  });
  broadcastToStore(storeId, "WAITER_AVAILABILITY_CHANGED", { waiterId, status: row.status });
  return presenceView(row);
}

/** A waiter's availability (Available unless they marked themselves Busy) */
async function getWaiterAvailability(storeId, waiterId) {
  const row = await getPrismaClient().waiterPresence.findUnique({
    where: { storeId_userId: { storeId, userId: waiterId } }
  });
  return presenceView(row);
}

/** A waiter finished a call: they've been idle since now */
async function recordWaiterCompleted(storeId, waiterId) {
  const now = new Date();
  await getPrismaClient().waiterPresence.upsert({
    where: { storeId_userId: { storeId, userId: waiterId } },
    create: { storeId, userId: waiterId, lastResolvedAt: now },
    update: { lastResolvedAt: now }
  });
}

/* ---------- choosing a waiter ---------- */

/**
 * The best available waiter for a table call (lowest score wins):
 * Score = (PendingCalls * 40) + (ActiveOrders * 20) - (TableAffinity 30) - (IdleMinutes * 2)
 */
async function findBestWaiter(storeId, tableId, excludedWaiterIds = []) {
  const prisma = getPrismaClient();

  const [activeWaiters, presence] = await Promise.all([
    prisma.user.findMany({
      where: { storeId, role: 'WAITER', status: 'ACTIVE' },
      select: { id: true, name: true, lastLoginAt: true }
    }),
    prisma.waiterPresence.findMany({ where: { storeId } })
  ]);
  const presenceByWaiter = new Map(presence.map(p => [p.userId, p]));

  const candidates = activeWaiters.filter(w =>
    !excludedWaiterIds.includes(w.id) && presenceByWaiter.get(w.id)?.status !== 'BUSY'
  );
  if (candidates.length === 0) return null;
  const candidateIds = candidates.map(w => w.id);

  const [recentTableOrder, pendingCalls, activeOrders] = await Promise.all([
    // Table affinity: whoever is already serving this table
    prisma.order.findFirst({
      where: { storeId, tableId, status: { in: ['PROCESSING', 'READY', 'SERVED'] } },
      orderBy: { createdAt: 'desc' },
      select: { staffId: true }
    }).catch(() => null),
    prisma.waiterCall.groupBy({
      by: ['assignedWaiterId'],
      where: { storeId, status: 'PENDING', assignedWaiterId: { in: candidateIds } },
      _count: { _all: true }
    }),
    prisma.order.groupBy({
      by: ['staffId'],
      where: { storeId, staffId: { in: candidateIds }, status: { in: ['PROCESSING', 'READY'] } },
      _count: { _all: true }
    })
  ]);
  const pendingByWaiter = new Map(pendingCalls.map(r => [r.assignedWaiterId, r._count._all]));
  const ordersByWaiter = new Map(activeOrders.map(r => [r.staffId, r._count._all]));
  const affinityWaiterId = recentTableOrder?.staffId || null;

  const scored = candidates.map((waiter) => {
    const lastActive = presenceByWaiter.get(waiter.id)?.lastResolvedAt || waiter.lastLoginAt || new Date(0);
    const idleMinutes = Math.min(Math.max(Math.floor((Date.now() - new Date(lastActive).getTime()) / 60000), 0), 120);
    const score = ((pendingByWaiter.get(waiter.id) || 0) * 40)
      + ((ordersByWaiter.get(waiter.id) || 0) * 20)
      - (affinityWaiterId === waiter.id ? 30 : 0)
      - (idleMinutes * 2);
    return { waiter, score };
  });
  scored.sort((a, b) => a.score - b.score);
  return scored[0]?.waiter || null;
}

/* ---------- dispatch and escalation ---------- */

/**
 * Page the best waiter for a new call (they have 60 s to answer), or put it straight in the
 * manager queue when nobody is available.
 */
async function dispatchCall(call, tableNumber, note = '') {
  const prisma = getPrismaClient();
  const best = await findBestWaiter(call.storeId, call.tableId, []);
  const now = new Date();

  const data = best
    ? { assignedWaiterId: best.id, assignedAt: now, escalationLevel: 0, attemptedWaiterIds: [best.id], escalateAt: new Date(now.getTime() + ANSWER_WITHIN_MS) }
    : { assignedWaiterId: null, assignedAt: now, escalationLevel: MANAGER_LEVEL, attemptedWaiterIds: [], escalateAt: null };
  await prisma.waiterCall.updateMany({ where: { id: call.id, status: 'PENDING' }, data });

  const state = {
    assignedWaiterId: data.assignedWaiterId,
    assignedWaiterName: best ? best.name : null,
    escalationLevel: data.escalationLevel,
    note: note || '',
    assignedAt: now,
    status: 'PENDING'
  };

  broadcastToStore(call.storeId, "WAITER_CALL_DISPATCHED", {
    callId: call.id,
    tableId: call.tableId,
    tableNumber,
    type: call.type,
    note,
    assignedWaiterId: state.assignedWaiterId,
    assignedWaiterName: state.assignedWaiterName,
    escalationLevel: state.escalationLevel,
    isManagerEscalation: !best,
    assignedAt: now
  });

  return state;
}

/** Nobody answered in time: page the next waiter, or the manager once everyone was tried */
async function escalateCall(call) {
  const prisma = getPrismaClient();
  const { id: callId, storeId, tableId, type } = call;
  const tableNumber = call.table?.tableNumber;
  const note = call.note || '';
  const attempted = call.attemptedWaiterIds || [];

  const next = await findBestWaiter(storeId, tableId, attempted);
  const now = new Date();
  const data = next
    ? { assignedWaiterId: next.id, assignedAt: now, escalationLevel: call.escalationLevel + 1, attemptedWaiterIds: [...attempted, next.id], escalateAt: new Date(now.getTime() + ANSWER_WITHIN_MS) }
    : { assignedWaiterId: null, escalationLevel: MANAGER_LEVEL, escalateAt: null };

  // Only if nobody acknowledged it, and no other server escalated it, since we read it
  const claim = await prisma.waiterCall.updateMany({
    where: { id: callId, status: 'PENDING', escalateAt: call.escalateAt },
    data
  });
  if (claim.count === 0) return;

  if (next) {
    broadcastToStore(storeId, "WAITER_CALL_ESCALATED", {
      callId,
      tableId,
      tableNumber,
      type,
      note,
      previousWaiterId: call.assignedWaiterId,
      assignedWaiterId: next.id,
      assignedWaiterName: next.name,
      escalationLevel: data.escalationLevel,
      assignedAt: now
    });
    sendNotification({
      storeId,
      type: 'WAITER_CALL',
      title: `Table ${tableNumber} Request`,
      body: `Customer requested: ${callTypeLabel(type)}${note ? ` (${note})` : ''}`,
      data: { callId, tableId, tableNumber, sound: 'notification.mp3', url: '/waiter' },
      target: { userId: next.id, role: 'WAITER', storeId }
    }).catch(() => {});
    return;
  }

  broadcastToStore(storeId, "WAITER_CALL_ESCALATED_MANAGER", {
    callId,
    tableId,
    tableNumber,
    type,
    note,
    escalationLevel: MANAGER_LEVEL,
    message: `Urgent: Table ${tableNumber} has called for ${callTypeLabel(type)} with no waiter response. Manager attention required.`
  });
  sendNotification({
    storeId,
    type: 'WAITER_CALL_ESCALATED_MANAGER',
    title: `Urgent: Table ${tableNumber} Unanswered`,
    body: `Table ${tableNumber} has been waiting for ${callTypeLabel(type)} without response. Immediate manager intervention needed.`,
    data: { callId, tableId, tableNumber, sound: 'notification.mp3', url: '/waiter' },
    target: { role: 'STORE_MANAGER', storeId }
  }).catch(() => {});
}

let sweepTimer = null;
let sweeping = false;

/** Escalates every call whose waiter didn't answer in time */
async function sweepDueEscalations() {
  if (sweeping) return;
  sweeping = true;
  try {
    const due = await getPrismaClient().waiterCall.findMany({
      where: { status: 'PENDING', escalateAt: { lte: new Date() } },
      include: { table: { select: { tableNumber: true } } },
      orderBy: { escalateAt: 'asc' },
      take: 50
    });
    for (const call of due) {
      await escalateCall(call).catch(err => console.error(`[Waiter calls] escalation failed for ${call.id}:`, err.message));
    }
  } catch (err) {
    console.error('[Waiter calls] escalation sweep failed:', err.message);
  } finally {
    sweeping = false;
  }
}

function startDispatchSweeper() {
  if (sweepTimer) return;
  sweepTimer = setInterval(sweepDueEscalations, SWEEP_EVERY_MS);
  sweepTimer.unref?.();
}

function stopDispatchSweeper() {
  clearInterval(sweepTimer);
  sweepTimer = null;
}

module.exports = {
  findBestWaiter,
  dispatchCall,
  escalateCall,
  sweepDueEscalations,
  startDispatchSweeper,
  stopDispatchSweeper,
  recordWaiterCompleted,
  setWaiterAvailability,
  getWaiterAvailability
};
