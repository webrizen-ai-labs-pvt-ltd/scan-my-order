const { getPrismaClient } = require('../../lib/prisma');

async function runRetentionCleanupJob({ storeId, tenantId, params = {} }) {
  const prisma = getPrismaClient();
  const retentionDays = Number(params.retentionDays) || 30;

  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - retentionDays);

  const whereClause = {
    status: 'CANCELLED',
    updatedAt: { lt: cutoffDate }
  };

  if (storeId) {
    whereClause.storeId = storeId;
  } else if (tenantId) {
    whereClause.store = { tenantId };
  }

  const result = await prisma.order.deleteMany({
    where: whereClause
  });

  const summary = result.count > 0
    ? `Permanently purged ${result.count} cancelled order(s) older than ${retentionDays} days.`
    : `No cancelled orders older than ${retentionDays} days found to clean up.`;

  return {
    deletedCount: result.count,
    retentionDays,
    summary
  };
}

module.exports = {
  runRetentionCleanupJob
};
