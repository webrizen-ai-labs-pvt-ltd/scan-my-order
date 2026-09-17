const { getPrismaClient } = require('../../lib/prisma');

async function runTableReconciliationJob({ storeId, tenantId, params = {} }) {
  const prisma = getPrismaClient();
  const idleMinutes = Number(params.idleMinutes) || 45;
  const reservationGraceMinutes = Number(params.reservationGraceMinutes) || 45;

  const sessionCutoff = new Date();
  sessionCutoff.setMinutes(sessionCutoff.getMinutes() - idleMinutes);

  const reservationCutoff = new Date();
  reservationCutoff.setMinutes(reservationCutoff.getMinutes() - reservationGraceMinutes);

  let sessionsClosedCount = 0;
  let reservationsNoShowCount = 0;

  // 1. Reconcile lingering active table sessions
  const sessionWhere = {
    status: 'ACTIVE',
    updatedAt: { lt: sessionCutoff }
  };
  if (storeId) {
    sessionWhere.storeId = storeId;
  } else if (tenantId) {
    sessionWhere.store = { tenantId };
  }

  const activeSessions = await prisma.tableSession.findMany({
    where: sessionWhere,
    include: {
      orders: {
        select: { id: true, status: true }
      }
    }
  });

  const sessionIdsToClose = [];
  for (const session of activeSessions) {
    // If no orders or all orders are SETTLED or CANCELLED
    const hasActiveOrders = session.orders.some(o => 
      !['SETTLED', 'CANCELLED'].includes(o.status)
    );
    if (!hasActiveOrders) {
      sessionIdsToClose.push(session.id);
    }
  }

  if (sessionIdsToClose.length > 0) {
    const res = await prisma.tableSession.updateMany({
      where: { id: { in: sessionIdsToClose } },
      data: { status: 'SETTLED' }
    });
    sessionsClosedCount = res.count;
  }

  // 2. Reconcile overdue reservations
  if (prisma.tableReservation) {
    try {
      const resWhere = {
        status: 'CONFIRMED',
        startsAt: { lt: reservationCutoff }
      };
      if (storeId) {
        resWhere.storeId = storeId;
      } else if (tenantId) {
        resWhere.store = { tenantId };
      }

      const overdueRes = await prisma.tableReservation.updateMany({
        where: resWhere,
        data: { status: 'NO_SHOW' }
      });
      reservationsNoShowCount = overdueRes.count;
    } catch (e) {
      console.warn('[Table Reconciliation] TableReservation reconciliation skipped:', e.message || e);
    }
  }

  const summary = `Reconciled ${sessionsClosedCount} inactive table session(s) and flagged ${reservationsNoShowCount} overdue reservation(s) as No-Show.`;

  return {
    sessionsClosedCount,
    reservationsNoShowCount,
    summary
  };
}

module.exports = {
  runTableReconciliationJob
};
