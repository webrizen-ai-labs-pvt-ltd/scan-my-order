const { getPrismaClient } = require('../../lib/prisma');

/**
 * Archives cancelled orders older than the retention window. They're hidden from Order History
 * but never deleted: cancelled orders can carry payments, refunds and invoices, which are
 * financial records the store must keep (GST rules expect about 6 years).
 */
async function runRetentionCleanupJob({ storeId, tenantId, params = {} }) {
  const prisma = getPrismaClient();
  const retentionDays = Number(params.retentionDays) || 30;

  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - retentionDays);

  const whereClause = {
    status: 'CANCELLED',
    archivedAt: null,
    updatedAt: { lt: cutoffDate }
  };

  if (storeId) {
    whereClause.storeId = storeId;
  } else if (tenantId) {
    whereClause.store = { tenantId };
  }

  const result = await prisma.order.updateMany({
    where: whereClause,
    data: { archivedAt: new Date() }
  });

  const summary = result.count > 0
    ? `Archived ${result.count} cancelled order(s) older than ${retentionDays} days. They're hidden from Order History but kept on record.`
    : `No cancelled orders older than ${retentionDays} days to archive.`;

  return {
    archivedCount: result.count,
    retentionDays,
    summary
  };
}

module.exports = {
  runRetentionCleanupJob
};
