const { getPrismaClient } = require('../../lib/prisma');
const { sendMail } = require('../../lib/mailer');

async function runLowStockAlertJob({ storeId, tenantId, params = {} }) {
  const prisma = getPrismaClient();

  const storeWhere = storeId ? { id: storeId } : (tenantId ? { tenantId } : {});
  const stores = await prisma.store.findMany({
    where: storeWhere,
    select: {
      id: true,
      name: true,
      contactEmail: true,
      tenantId: true
    }
  });

  let totalLowStockCount = 0;
  let emailsDispatched = 0;
  const storeReports = [];

  for (const store of stores) {
    const rawMaterials = await prisma.rawMaterial.findMany({
      where: {
        storeId: store.id
      },
      select: {
        id: true,
        name: true,
        unit: true,
        currentStock: true,
        lowStockThreshold: true
      }
    });

    const depletedItems = rawMaterials.filter(
      item => item.currentStock <= item.lowStockThreshold
    );

    if (depletedItems.length === 0) {
      continue;
    }

    totalLowStockCount += depletedItems.length;

    // Resolve recipients
    const recipientSet = new Set();
    if (params.recipientEmails) {
      params.recipientEmails
        .split(',')
        .map(e => e.trim())
        .filter(Boolean)
        .forEach(e => recipientSet.add(e));
    }
    if (store.contactEmail) {
      recipientSet.add(store.contactEmail);
    }

    // Also fetch STORE_MANAGER emails for this store
    const managers = await prisma.user.findMany({
      where: {
        storeId: store.id,
        role: 'STORE_MANAGER',
        status: 'ACTIVE'
      },
      select: { email: true }
    });
    managers.forEach(m => recipientSet.add(m.email));

    const recipientsList = Array.from(recipientSet);

    // Build email alert HTML
    const rowsHtml = depletedItems.map(item => `
      <tr style="border-bottom: 1px solid #e4e4e7;">
        <td style="padding: 10px 14px; font-weight: 600; color: #18181b;">${item.name}</td>
        <td style="padding: 10px 14px; color: #ef4444; font-weight: 700;">${item.currentStock} ${item.unit}</td>
        <td style="padding: 10px 14px; color: #71717a;">${item.lowStockThreshold} ${item.unit}</td>
        <td style="padding: 10px 14px;">
          <span style="background: #fee2e2; color: #991b1b; padding: 2px 8px; border-radius: 4px; font-size: 12px; font-weight: 600;">
            ${item.currentStock === 0 ? 'OUT OF STOCK' : 'LOW STOCK'}
          </span>
        </td>
      </tr>
    `).join('');

    const emailHtml = `
      <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 24px; border: 1px solid #e4e4e7; border-radius: 8px;">
        <div style="margin-bottom: 20px;">
          <h2 style="color: #dc2626; margin: 0 0 6px 0;">⚠️ Low Stock Inventory Alert</h2>
          <p style="color: #52525b; margin: 0; font-size: 14px;">Store: <strong>${store.name}</strong> | Automated Stock Monitor</p>
        </div>
        <p style="font-size: 14px; color: #3f3f46; line-height: 1.5;">
          The automated inventory monitor detected <strong>${depletedItems.length}</strong> ingredient(s) that have reached or fallen below their minimum stock threshold. Please review and replenish before shift rushes:
        </p>
        <table style="width: 100%; border-collapse: collapse; margin: 18px 0; font-size: 13px;">
          <thead>
            <tr style="background: #f4f4f5; text-align: left; color: #71717a; font-size: 12px; text-transform: uppercase;">
              <th style="padding: 10px 14px;">Ingredient</th>
              <th style="padding: 10px 14px;">Current</th>
              <th style="padding: 10px 14px;">Min Threshold</th>
              <th style="padding: 10px 14px;">Status</th>
            </tr>
          </thead>
          <tbody>
            ${rowsHtml}
          </tbody>
        </table>
        <p style="font-size: 12px; color: #a1a1aa; margin-top: 24px;">
          Sent automatically by ScanMyOrder Operations Platform.
        </p>
      </div>
    `;

    let emailSent = false;
    if (recipientsList.length > 0) {
      try {
        await sendMail({
          to: recipientsList.join(', '),
          subject: `[Inventory Alert] ${depletedItems.length} Low Stock Item(s) - ${store.name}`,
          html: emailHtml
        });
        emailSent = true;
        emailsDispatched += recipientsList.length;
      } catch (mailErr) {
        console.warn(`[LowStockAlertJob] Failed sending email for store ${store.id}:`, mailErr.message);
      }
    }

    storeReports.push({
      storeId: store.id,
      storeName: store.name,
      lowStockCount: depletedItems.length,
      depletedItems: depletedItems.map(i => `${i.name} (${i.currentStock}/${i.lowStockThreshold} ${i.unit})`),
      recipients: recipientsList,
      emailSent
    });
  }

  const summary = totalLowStockCount > 0
    ? `Flagged ${totalLowStockCount} depleted raw material(s) across ${storeReports.length} store(s). Dispatched ${emailsDispatched} alert email(s).`
    : 'All raw material inventory levels are healthy above safety thresholds.';

  return {
    totalLowStockCount,
    emailsDispatched,
    storeReports,
    summary
  };
}

module.exports = {
  runLowStockAlertJob
};
