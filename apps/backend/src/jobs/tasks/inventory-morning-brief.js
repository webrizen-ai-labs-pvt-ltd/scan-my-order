const { getPrismaClient } = require('../../lib/prisma');
const { sendNotification } = require('../../modules/notifications/notification-service');
const { getMorningBrief } = require('../../modules/inventory/insights-service');

/**
 * Tells the managers and owners of stores on Advanced inventory what the store room needs
 * today: expired stock, things running low, licences to renew and what the records warn about.
 * A store with nothing to look at gets no notification.
 */
async function runInventoryMorningBriefJob({ storeId, tenantId }) {
  const prisma = getPrismaClient();
  const stores = await prisma.store.findMany({
    where: { ...(storeId ? { id: storeId } : tenantId ? { tenantId } : {}), inventoryMode: 'ADVANCED', status: 'ACTIVE' },
    select: { id: true, name: true }
  });

  const reports = [];
  for (const store of stores) {
    try {
      const brief = await getMorningBrief(store.id);
      if (brief) {
        await sendNotification({
          storeId: store.id,
          type: 'INVENTORY_BRIEF',
          title: brief.title,
          body: brief.body,
          data: { url: '/dashboard/inventory', sound: 'notification.mp3' },
          target: { roles: ['STORE_MANAGER', 'TENANT_ADMIN'], storeId: store.id }
        });
      }
      reports.push({ storeId: store.id, storeName: store.name, items: brief ? brief.items : [] });
    } catch (err) {
      console.warn(`[InventoryMorningBriefJob] Store ${store.id} failed:`, err.message);
      reports.push({ storeId: store.id, storeName: store.name, error: err.message });
    }
  }

  const told = reports.filter(r => r.items?.length > 0).length;
  return {
    storeReports: reports,
    summary: stores.length === 0
      ? 'No store here runs Advanced inventory.'
      : told === 0 ? 'Nothing needed attention.' : `Sent the morning brief to ${told} store(s).`
  };
}

module.exports = { runInventoryMorningBriefJob };
