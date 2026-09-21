const { getPrismaClient } = require('../../lib/prisma');

async function runTableReconciliationJob({ storeId, tenantId, params = {} }) {
  const prisma = getPrismaClient();
  const idleMinutes = Number(params.idleMinutes) || 120; // 2 hours rolling inactivity
  const reservationGraceMinutes = Number(params.reservationGraceMinutes) || 45;

  const sessionCutoff = new Date();
  sessionCutoff.setMinutes(sessionCutoff.getMinutes() - idleMinutes);

  const reservationCutoff = new Date();
  reservationCutoff.setMinutes(reservationCutoff.getMinutes() - reservationGraceMinutes);

  let sessionsClosedCount = 0;
  let reservationsNoShowCount = 0;

  // 1. Reconcile lingering active table sessions older than 2 hours of no order placement
  const sessionWhere = {
    status: 'ACTIVE',
    OR: [
      { lastOrderAt: { lt: sessionCutoff } },
      { lastOrderAt: null, updatedAt: { lt: sessionCutoff } }
    ]
  };
  if (storeId) {
    sessionWhere.storeId = storeId;
  } else if (tenantId) {
    sessionWhere.store = { tenantId };
  }

  const inactiveSessions = await prisma.tableSession.findMany({
    where: sessionWhere,
    select: { id: true, storeId: true, tableId: true }
  });

  if (inactiveSessions.length > 0) {
    const sessionIdsToClose = inactiveSessions.map(s => s.id);
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
