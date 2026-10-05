const { getPrismaClient } = require('../../lib/prisma');

const STALE_STATUSES = ['DRAFT', 'PENDING_VERIFICATION', 'PENDING_PAYMENT'];

/**
 * Cancels orders that were never approved or paid. Each one goes through the normal cancel path:
 * waiting Razorpay QRs are closed at Razorpay (and re-checked, so a last-second payment is kept),
 * store credits are returned, the audit log is written and every screen hears about it.
 */
async function runStaleOrdersJob({ storeId, tenantId, params = {} }) {
  // Required lazily: the order and payment services load this job registry indirectly
  const { updateOrderStatus } = require('../../modules/orders/order-service');
  const { cancelPendingPaymentsFor } = require('../../modules/payments/payment-service');
  const prisma = getPrismaClient();
  const staleHours = Number(params.staleHours) || 2;

  const cutoffDate = new Date();
  cutoffDate.setHours(cutoffDate.getHours() - staleHours);

  const whereClause = {
    status: { in: STALE_STATUSES },
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
    select: { id: true, storeId: true }
  });

  if (staleOrders.length === 0) {
    return {
      expiredCount: 0,
      summary: `No stale orders found older than ${staleHours}h.`
    };
  }

  const reason = `Auto-cancelled: not approved or paid within ${staleHours}h`;
  let cancelled = 0;
  let skipped = 0;

  for (const order of staleOrders) {
    try {
      // Stop any QR / UPI request first; a guest who already paid keeps their order
      await cancelPendingPaymentsFor(order.storeId, { orderId: order.id });
      const fresh = await prisma.order.findUnique({ where: { id: order.id }, select: { status: true, paidAt: true } });
      const paid = await prisma.payment.count({ where: { orderId: order.id, status: 'PAID' } });
      if (!fresh || fresh.paidAt || paid > 0 || !STALE_STATUSES.includes(fresh.status)) {
        skipped++;
        continue;
      }
      await updateOrderStatus(null, order.storeId, order.id, 'CANCELLED', true, { reason });
      cancelled++;
    } catch (error) {
      // Changed by someone meanwhile, or a transient error: leave it for the next run
      console.warn(`[Jobs] stale order ${order.id} not cancelled:`, error.message);
      skipped++;
    }
  }

  return {
    expiredCount: cancelled,
    summary: `Automatically cancelled ${cancelled} abandoned order(s) older than ${staleHours}h${skipped ? `; ${skipped} left alone (paid or changed meanwhile)` : ''}.`
  };
}

module.exports = {
  runStaleOrdersJob
};
