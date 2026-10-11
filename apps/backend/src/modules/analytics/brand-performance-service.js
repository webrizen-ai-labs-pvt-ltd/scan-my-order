const { getPrismaClient } = require("../../lib/prisma");
const { createHttpError } = require("../../middleware/error-handler");

const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000;
const DAY_MS = 86400000;
const PERIODS = [7, 30, 90];

// Same meaning of "a sale" as the sales report: not cancelled, and money was taken
const isSale = (o) => o.status !== "CANCELLED" && (Boolean(o.paidAt) || o.status === "SETTLED" || Boolean(o.paymentMethod));
const saleDate = (o) => o.paidAt || o.createdAt;

/** The UTC instant today starts in India */
function istTodayStart() {
  const ist = new Date(Date.now() + IST_OFFSET_MS);
  return new Date(Date.UTC(ist.getUTCFullYear(), ist.getUTCMonth(), ist.getUTCDate()) - IST_OFFSET_MS);
}
const istDayKey = (date) => new Date(date.getTime() + IST_OFFSET_MS).toISOString().slice(0, 10);

/** Change from `before` to `now` in percent; null when there was nothing before to compare with */
const growth = (now, before) => (before > 0 ? Math.round(((now - before) / before) * 1000) / 10 : null);

const emptyStats = () => ({ sales: 0, orders: 0, qrOrders: 0 });

/**
 * How every brand is doing, for the platform owner: sales, orders and average bill over the last
 * N days (India time, today included), each compared with the N days before, plus a day-by-day trend.
 *
 * @param {object} query days: 7, 30 or 90 (default 30)
 */
async function getBrandPerformance(actor, query = {}) {
  if (actor.role !== "SUPER_ADMIN") throw createHttpError(403, "Only the platform admin can see brand performance");
  const days = PERIODS.includes(Number(query.days)) ? Number(query.days) : 30;
  const prisma = getPrismaClient();

  const end = new Date(istTodayStart().getTime() + DAY_MS); // end of today
  const start = new Date(end.getTime() - days * DAY_MS);
  const prevStart = new Date(start.getTime() - days * DAY_MS);

  const [tenants, orders] = await Promise.all([
    prisma.tenant.findMany({
      orderBy: { name: "asc" },
      select: {
        id: true, name: true, logo: true, status: true, createdAt: true,
        stores: { select: { id: true } },
        subscription: { select: { status: true, plan: { select: { name: true } } } }
      }
    }),
    prisma.order.findMany({
      where: {
        status: { not: "CANCELLED" },
        OR: [
          { paidAt: { gte: prevStart, lt: end } },
          { paidAt: null, createdAt: { gte: prevStart, lt: end } }
        ]
      },
      select: {
        storeId: true, origin: true, status: true, paymentMethod: true, paidAt: true, createdAt: true,
        totalAmount: true, customerPhone: true, customerId: true
      }
    })
  ]);

  const tenantOfStore = new Map();
  for (const t of tenants) for (const s of t.stores) tenantOfStore.set(s.id, t.id);
  const dayKeys = Array.from({ length: days }, (_, i) => istDayKey(new Date(start.getTime() + i * DAY_MS)));
  const dayIndex = new Map(dayKeys.map((k, i) => [k, i]));

  const perBrand = new Map(tenants.map(t => [t.id, { now: emptyStats(), before: emptyStats(), trend: new Array(days).fill(0), customers: new Set(), lastSaleAt: null }]));
  const platformTrend = dayKeys.map(date => ({ date, sales: 0, orders: 0 }));

  for (const o of orders) {
    if (!isSale(o)) continue;
    const brand = perBrand.get(tenantOfStore.get(o.storeId));
    if (!brand) continue;
    const at = saleDate(o);
    if (at < prevStart || at >= end) continue;

    const bucket = at >= start ? brand.now : brand.before;
    bucket.sales += o.totalAmount;
    bucket.orders += 1;
    if (o.origin === "QR_MENU") bucket.qrOrders += 1;

    if (at >= start) {
      const i = dayIndex.get(istDayKey(at));
      if (i !== undefined) {
        brand.trend[i] += o.totalAmount;
        platformTrend[i].sales += o.totalAmount;
        platformTrend[i].orders += 1;
      }
      const who = o.customerPhone || o.customerId;
      if (who) brand.customers.add(who);
      if (!brand.lastSaleAt || at > brand.lastSaleAt) brand.lastSaleAt = at;
    }
  }

  const brands = tenants.map(t => {
    const b = perBrand.get(t.id);
    const isNew = t.createdAt >= start;
    return {
      id: t.id,
      name: t.name,
      logo: t.logo,
      status: t.status,
      plan: t.subscription?.plan?.name || null,
      stores: t.stores.length,
      sales: b.now.sales,
      prevSales: b.before.sales,
      salesGrowth: growth(b.now.sales, b.before.sales),
      orders: b.now.orders,
      prevOrders: b.before.orders,
      ordersGrowth: growth(b.now.orders, b.before.orders),
      averageBill: b.now.orders > 0 ? Math.round(b.now.sales / b.now.orders) : 0,
      qrShare: b.now.orders > 0 ? Math.round((b.now.qrOrders / b.now.orders) * 100) : 0,
      customers: b.customers.size,
      lastSaleAt: b.lastSaleAt,
      trend: b.trend,
      // GROWING / FALLING need a previous period to compare with; NEW joined in this period; QUIET sold nothing
      movement: b.now.sales === 0 ? "QUIET" : b.before.sales === 0 ? (isNew ? "NEW" : "STARTED") : b.now.sales >= b.before.sales ? "GROWING" : "FALLING"
    };
  });

  const sum = (key) => brands.reduce((total, b) => total + b[key], 0);
  const sales = sum("sales");
  const prevSales = sum("prevSales");
  const orderCount = sum("orders");
  const prevOrders = sum("prevOrders");
  return {
    days,
    from: start,
    to: new Date(end.getTime() - 1),
    totals: {
      sales,
      prevSales,
      salesGrowth: growth(sales, prevSales),
      orders: orderCount,
      prevOrders,
      ordersGrowth: growth(orderCount, prevOrders),
      averageBill: orderCount > 0 ? Math.round(sales / orderCount) : 0,
      prevAverageBill: prevOrders > 0 ? Math.round(prevSales / prevOrders) : 0,
      brands: brands.length,
      sellingBrands: brands.filter(b => b.sales > 0).length,
      growingBrands: brands.filter(b => b.movement === "GROWING").length,
      fallingBrands: brands.filter(b => b.movement === "FALLING").length
    },
    trend: platformTrend,
    brands
  };
}

module.exports = { getBrandPerformance };
