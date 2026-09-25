const { getPrismaClient } = require('../../lib/prisma');

async function runStaleOrdersJob({ storeId, tenantId, params = {} }) {
  const prisma = getPrismaClient();
  const staleHours = Number(params.staleHours) || 2;
  
  const cutoffDate = new Date();
  cutoffDate.setHours(cutoffDate.getHours() - staleHours);

  const whereClause = {
    status: { in: ['DRAFT', 'PENDING_VERIFICATION', 'PENDING_PAYMENT'] },
    paidAt: null,
    createdAt: { lt: cutoffDate }
  };

  if (storeId) {
    whereClause.storeId = storeId;
  } else if (tenantId) {
    whereClause.store = { tenantId };
  }

  const staleOrders = await prisma.order.findMany({
    where: whereClause,
    select: { id: true, tableId: true, tableSessionId: true }
  });

  if (staleOrders.length === 0) {
    return {
      expiredCount: 0,
      summary: `No stale orders found older than ${staleHours}h.`
    };
  }

  const orderIds = staleOrders.map(o => o.id);

  // Abandoned checkouts: stop any QR / UPI request still waiting on these orders
  await prisma.payment.updateMany({
    where: { orderId: { in: orderIds }, status: 'PENDING' },
    data: { status: 'CANCELLED' }
  });

  const result = await prisma.order.updateMany({
    where: {
      id: { in: orderIds }
    },
    data: {
      status: 'CANCELLED',
      cancelReason: `Auto-cancelled: not approved or paid within ${staleHours}h`,
      cancelledAt: new Date()
    }
  });

  return {
    expiredCount: result.count,
    summary: `Automatically cancelled ${result.count} abandoned order(s) older than ${staleHours}h.`
  };
}

module.exports = {
  runStaleOrdersJob
};
