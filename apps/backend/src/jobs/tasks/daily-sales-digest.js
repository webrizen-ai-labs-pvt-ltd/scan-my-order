const { getPrismaClient } = require('../../lib/prisma');
const { sendMail } = require('../../lib/mailer');

async function runDailySalesDigestJob({ storeId, tenantId, params = {} }) {
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

  const startOfDay = new Date();
  startOfDay.setHours(0, 0, 0, 0);

  const digests = [];

  for (const store of stores) {
    const orders = await prisma.order.findMany({
      where: {
        storeId: store.id,
        status: 'SETTLED',
        createdAt: { gte: startOfDay }
      },
      include: {
        items: {
          include: {
            menuItem: { select: { name: true } }
          }
        }
      }
    });

    const totalOrders = orders.length;
    let totalRevenue = 0;
    let totalSubtotal = 0;
    let totalTax = 0;
    let totalDiscount = 0;
    let cashSales = 0;
    let onlineSales = 0;

    const itemCounter = {};

    for (const order of orders) {
      totalRevenue += (order.totalAmount || 0);
      totalSubtotal += (order.subTotal || 0);
      totalTax += (order.taxAmount || 0);
      totalDiscount += (order.discountAmount || 0);
      cashSales += (order.cashAmount || 0);
      onlineSales += (order.onlineAmount || 0);

      for (const item of (order.items || [])) {
        const name = item.menuItem?.name || 'Unknown Item';
        itemCounter[name] = (itemCounter[name] || 0) + (item.quantity || 1);
      }
    }

    const topItems = Object.entries(itemCounter)
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);

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

    // Format currency (assuming INR paise or base currency)
    const formatCurr = (amount) => `₹${(amount / 100).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`;

    const topItemsHtml = topItems.length > 0
      ? topItems.map((it, idx) => `
          <li style="margin-bottom: 6px; color: #27272a; font-size: 13px;">
            <strong>#${idx + 1} ${it.name}</strong> &mdash; ${it.count} sold
          </li>
        `).join('')
      : '<p style="font-size: 13px; color: #71717a;">No items sold today.</p>';

    const digestHtml = `
      <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto; padding: 24px; border: 1px solid #e4e4e7; border-radius: 8px;">
        <div style="border-bottom: 2px solid #6366f1; padding-bottom: 12px; margin-bottom: 20px;">
          <h2 style="color: #1e1b4b; margin: 0 0 4px 0;">📊 Daily Operations & Sales Digest</h2>
          <p style="color: #64748b; margin: 0; font-size: 14px;">Store: <strong>${store.name}</strong> | ${new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'short', day: 'numeric' })}</p>
        </div>

        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-bottom: 20px;">
          <div style="background: #f8fafc; padding: 14px; border-radius: 6px; border: 1px solid #e2e8f0;">
            <div style="font-size: 12px; color: #64748b; text-transform: uppercase; font-weight: 600;">Total Revenue</div>
            <div style="font-size: 22px; font-weight: 700; color: #0f172a; margin-top: 4px;">${formatCurr(totalRevenue)}</div>
          </div>
          <div style="background: #f8fafc; padding: 14px; border-radius: 6px; border: 1px solid #e2e8f0;">
            <div style="font-size: 12px; color: #64748b; text-transform: uppercase; font-weight: 600;">Orders Settled</div>
            <div style="font-size: 22px; font-weight: 700; color: #0f172a; margin-top: 4px;">${totalOrders}</div>
          </div>
        </div>

        <table style="width: 100%; border-collapse: collapse; margin-bottom: 20px; font-size: 13px;">
          <tr style="border-bottom: 1px solid #f1f5f9;">
            <td style="padding: 8px 0; color: #64748b;">Subtotal</td>
            <td style="padding: 8px 0; text-align: right; font-weight: 600;">${formatCurr(totalSubtotal)}</td>
          </tr>
          <tr style="border-bottom: 1px solid #f1f5f9;">
            <td style="padding: 8px 0; color: #64748b;">Taxes Collected</td>
            <td style="padding: 8px 0; text-align: right; font-weight: 600;">${formatCurr(totalTax)}</td>
          </tr>
          <tr style="border-bottom: 1px solid #f1f5f9;">
            <td style="padding: 8px 0; color: #64748b;">Discounts Granted</td>
            <td style="padding: 8px 0; text-align: right; font-weight: 600; color: #dc2626;">-${formatCurr(totalDiscount)}</td>
          </tr>
          <tr style="border-bottom: 1px solid #f1f5f9;">
            <td style="padding: 8px 0; color: #64748b;">Cash Collections</td>
            <td style="padding: 8px 0; text-align: right; font-weight: 600;">${formatCurr(cashSales)}</td>
          </tr>
          <tr>
            <td style="padding: 8px 0; color: #64748b;">Online / UPI Payments</td>
            <td style="padding: 8px 0; text-align: right; font-weight: 600;">${formatCurr(onlineSales)}</td>
          </tr>
        </table>

        <div style="background: #fdf4ff; border: 1px solid #f0abfc; padding: 16px; border-radius: 6px; margin-bottom: 20px;">
          <h4 style="margin: 0 0 10px 0; color: #86198f; font-size: 14px;">🔥 Top 5 Best Sellers Today</h4>
          <ol style="margin: 0; padding-left: 20px;">
            ${topItemsHtml}
          </ol>
        </div>

        <p style="font-size: 12px; color: #94a3b8; margin: 0;">
          Generated automatically by ScanMyOrder End-of-Day Financial Digest.
        </p>
      </div>
    `;

    let emailSent = false;
    if (recipientsList.length > 0) {
      try {
        await sendMail({
          to: recipientsList.join(', '),
          subject: `[Daily Digest] ${store.name} - ${formatCurr(totalRevenue)} (${totalOrders} orders)`,
          html: digestHtml
        });
        emailSent = true;
      } catch (err) {
        console.warn(`[DailySalesDigestJob] Failed sending digest email for store ${store.id}:`, err.message);
      }
    }

    digests.push({
      storeId: store.id,
      storeName: store.name,
      totalOrders,
      totalRevenue,
      cashSales,
      onlineSales,
      topItems,
      recipients: recipientsList,
      emailSent
    });
  }

  const grandTotalRev = digests.reduce((acc, d) => acc + d.totalRevenue, 0);
  const grandTotalOrders = digests.reduce((acc, d) => acc + d.totalOrders, 0);
  const summary = `Generated sales digest for ${digests.length} store(s): ${grandTotalOrders} total order(s) settled, ₹${(grandTotalRev / 100).toFixed(2)} revenue.`;

  return {
    digests,
    grandTotalRev,
    grandTotalOrders,
    summary
  };
}

module.exports = {
  runDailySalesDigestJob
};
