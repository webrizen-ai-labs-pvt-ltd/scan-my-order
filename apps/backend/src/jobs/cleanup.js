const cron = require('node-cron');
const { getPrismaClient } = require('../lib/prisma');

async function runCleanup(tenantId = null) {
  const prisma = getPrismaClient();
  
  // Calculate date 30 days ago
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
  
  const whereClause = {
    status: 'CANCELLED',
    updatedAt: {
      lt: thirtyDaysAgo
    }
  };
  
  if (tenantId) {
    whereClause.store = {
      tenantId: tenantId
    };
  }
  
  try {
    const result = await prisma.order.deleteMany({
      where: whereClause
    });
    
    if (result.count > 0) {
      console.log(`[Cleanup Job] Deleted ${result.count} cancelled orders older than 30 days.`);
    }
    return result.count;
  } catch (error) {
    console.error("[Cleanup Job] Error deleting old cancelled orders:", error);
    throw error;
  }
}

function startJobs() {
  // Run everyday at midnight
  cron.schedule('0 0 * * *', async () => {
    console.log('[Cleanup Job] Running daily cancelled order cleanup...');
    await runCleanup();
  });
  
  console.log('[Cleanup Job] Cron jobs scheduled.');
}

module.exports = {
  startJobs,
  runCleanup
};
