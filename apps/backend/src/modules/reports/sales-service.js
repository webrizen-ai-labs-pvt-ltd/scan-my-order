const { getPrismaClient } = require("../../lib/prisma");
const { createHttpError } = require("../../middleware/error-handler");
const { userRoles } = require("../../constants/roles");

// Sales figures are for managers and owners
const REPORT_ROLES = [userRoles.superAdmin, userRoles.tenantAdmin, userRoles.storeManager];
const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;
const MAX_DAYS = 366;

/**
 * What counts as a sale: an order that isn't cancelled and was paid — it has a payment time, was
 * settled, or has a payment method recorded (older orders only have the last two).
 * Its date is when it was paid, or when it was ordered if the payment time wasn't recorded.
 * All dates are Indian time.
 */
const saleDate = (o) => o.paidAt || o.createdAt;
const isSale = (o) => o.status !== "CANCELLED" && (Boolean(o.paidAt) || o.status === "SETTLED" || Boolean(o.paymentMethod));

/** "YYYY-MM-DD" (IST) → the UTC instant that day starts */
function istDayStart(dateStr) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(dateStr || ""));
  if (!m) throw createHttpError(400, "Dates must look like 2026-09-27");
  return new Date(Date.UTC(+m[1], +m[2] - 1, +m[3]) - IST_OFFSET_MS);
}

/** IST calendar day key ("2026-09-27") and hour (0–23) of an instant */
function istParts(date) {
  const ist = new Date(new Date(date).getTime() + IST_OFFSET_MS);
  return { day: ist.toISOString().slice(0, 10), hour: ist.getUTCHours() };
}

const dayLabel = (key) => {
  const [y, m, d] = key.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d)).toLocaleDateString("en-IN", { day: "numeric", month: "short", timeZone: "UTC" });
};
const hourLabel = (h) => `${h % 12 === 0 ? 12 : h % 12} ${h < 12 ? "am" : "pm"}`;

/** Which stores the report covers. Store managers see their store; owners one store or all. */
async function resolveStores(actor, storeId) {
  if (!actor || !REPORT_ROLES.includes(actor.role)) throw createHttpError(403, "Only managers and owners can see sales");
  const prisma = getPrismaClient();
  if (actor.role === userRoles.superAdmin) {
    if (!storeId) throw createHttpError(400, "Choose a store");
    const store = await prisma.store.findUnique({ where: { id: storeId }, select: { id: true, name: true } });
    if (!store) throw createHttpError(404, "Store not found");
    return [store];
  }
  // Managers tied to one store only ever see that store
  const forcedStore = actor.role === userRoles.storeManager && actor.storeId ? actor.storeId : null;
  const stores = await prisma.store.findMany({
    where: { tenantId: actor.tenantId, ...(forcedStore ? { id: forcedStore } : storeId ? { id: storeId } : {}) },
    select: { id: true, name: true },
    orderBy: { name: "asc" }
  });
  if (stores.length === 0) throw createHttpError(404, "Store not found");
  return stores;
}

function emptyTotals() {
  return { grossSales: 0, discounts: 0, netSales: 0, tax: 0, totalSales: 0, bills: 0, avgBill: 0, itemsSold: 0 };
}

function addBill(t, o) {
  t.grossSales += o.subTotal;
  t.discounts += o.discountAmount + (o.walletDiscount || 0);
  t.tax += o.taxAmount;
  t.totalSales += o.totalAmount;
  t.bills += 1;
}

function finishTotals(t) {
  t.netSales = t.grossSales - t.discounts;
  t.avgBill = t.bills > 0 ? Math.round(t.totalSales / t.bills) : 0;
  return t;
}

/** Orders that could be sales in [start, end): paid in range, or unpaid-time orders placed in range */
async function loadOrders(prisma, storeIds, start, end) {
  const rows = await prisma.order.findMany({
    where: {
      storeId: { in: storeIds },
      OR: [
        { paidAt: { gte: start, lt: end } },
        { paidAt: null, createdAt: { gte: start, lt: end } }
      ]
    },
    select: {
      id: true, storeId: true, origin: true, type: true, status: true, paymentMethod: true,
      paidAt: true, createdAt: true, subTotal: true, discountAmount: true, walletDiscount: true,
      taxAmount: true, totalAmount: true, cashAmount: true, onlineAmount: true, duesAmount: true,
      refundDue: true, tableSessionId: true
    }
  });
  return rows;
}

/** How a bill was paid: recorded split, or the method alone on older orders */
function paymentSplit(o) {
  const recorded = (o.cashAmount || 0) + (o.onlineAmount || 0) + (o.duesAmount || 0);
  if (recorded > 0) return { cash: o.cashAmount || 0, online: o.onlineAmount || 0, dues: o.duesAmount || 0, unrecorded: 0 };
  if (o.paymentMethod === "CASH") return { cash: o.totalAmount, online: 0, dues: 0, unrecorded: 0 };
  if (o.paymentMethod === "ONLINE") return { cash: 0, online: o.totalAmount, dues: 0, unrecorded: 0 };
  if (o.paymentMethod === "DUES") return { cash: 0, online: 0, dues: o.totalAmount, unrecorded: 0 };
  return { cash: 0, online: 0, dues: 0, unrecorded: o.totalAmount };
}

/** Items sold on a set of bills, with category, from one grouped query */
async function itemsFor(prisma, orderIds) {
  if (orderIds.length === 0) return [];
  return prisma.$queryRaw`
    SELECT mi."id" AS "menuItemId", mi."name" AS "name", c."name" AS "category",
           SUM(oi."quantity")::int AS "quantity",
           SUM(oi."quantity" * oi."priceAtOrder")::int AS "sales"
    FROM "OrderItem" oi
    JOIN "MenuItem" mi ON mi."id" = oi."menuItemId"
    JOIN "MenuCategory" c ON c."id" = mi."categoryId"
    WHERE oi."orderId" = ANY(${orderIds}::text[]) AND oi."status"::text = 'ACTIVE'
    GROUP BY mi."id", mi."name", c."name"`;
}

/** Value of items the kitchen couldn't make, on orders placed in range */
async function rejectedFor(prisma, storeIds, start, end) {
  const [row] = await prisma.$queryRaw`
    SELECT COUNT(*)::int AS "count", COALESCE(SUM(oi."quantity" * oi."priceAtOrder"), 0)::int AS "value"
    FROM "OrderItem" oi JOIN "Order" o ON o."id" = oi."orderId"
    WHERE o."storeId" = ANY(${storeIds}::text[]) AND oi."status"::text = 'REJECTED'
      AND o."createdAt" >= ${start} AND o."createdAt" < ${end}`;
  return row || { count: 0, value: 0 };
}

async function refundsFor(prisma, orderIds) {
  if (orderIds.length === 0) return 0;
  const [row] = await prisma.$queryRaw`
    SELECT COALESCE(SUM("amount"), 0)::int AS "total" FROM "Refund"
    WHERE "orderId" = ANY(${orderIds}::text[]) AND "status"::text = 'PROCESSED'`;
  return row?.total || 0;
}

/**
 * Sales report for [from, to] (IST dates, inclusive), compared with the same number of days before.
 * @param {{ storeId?: string, from: string, to: string }} query
 */
async function getSalesReport(actor, query = {}) {
  const stores = await resolveStores(actor, query.storeId);
  const storeIds = stores.map(s => s.id);
  const start = istDayStart(query.from);
  const end = new Date(istDayStart(query.to).getTime() + DAY_MS);
  const days = Math.round((end - start) / DAY_MS);
  if (days < 1) throw createHttpError(400, "The end date must be on or after the start date");
  if (days > MAX_DAYS) throw createHttpError(400, "Choose a range of a year or less");
  const prevStart = new Date(start.getTime() - days * DAY_MS);

  const prisma = getPrismaClient();
  const [current, previous, rejected] = await Promise.all([
    loadOrders(prisma, storeIds, start, end),
    loadOrders(prisma, storeIds, prevStart, start),
    rejectedFor(prisma, storeIds, start, end)
  ]);

  const inRange = (o, a, b) => { const d = saleDate(o); return d >= a && d < b; };
  const sales = current.filter(o => isSale(o) && inRange(o, start, end));
  const prevSales = previous.filter(o => isSale(o) && inRange(o, prevStart, start));
  const cancelled = current.filter(o => o.status === "CANCELLED" && o.createdAt >= start && o.createdAt < end);
  const open = current.filter(o => !isSale(o) && o.status !== "CANCELLED" && o.createdAt >= start && o.createdAt < end);

  const saleIds = sales.map(o => o.id);
  const [items, refunds] = await Promise.all([itemsFor(prisma, saleIds), refundsFor(prisma, saleIds)]);

  // Totals
  const totals = emptyTotals();
  const prevTotals = emptyTotals();
  sales.forEach(o => addBill(totals, o));
  prevSales.forEach(o => addBill(prevTotals, o));
  totals.itemsSold = items.reduce((s, i) => s + i.quantity, 0);
  finishTotals(totals);
  finishTotals(prevTotals);
  prevTotals.itemsSold = null; // not counted for the comparison period

  // Money: how the bills were paid
  const payments = { cash: 0, online: 0, dues: 0, unrecorded: 0 };
  let refundsPending = 0;
  for (const o of sales) {
    const split = paymentSplit(o);
    payments.cash += split.cash;
    payments.online += split.online;
    payments.dues += split.dues;
    payments.unrecorded += split.unrecorded;
    refundsPending += o.refundDue || 0;
  }

  // Trend: by hour for a single day, else by day (every day shown, including empty ones)
  const byHour = days === 1;
  const trendMap = new Map();
  if (byHour) {
    for (let h = 0; h < 24; h++) trendMap.set(String(h), { key: String(h), label: hourLabel(h), sales: 0, bills: 0 });
  } else {
    for (let i = 0; i < days; i++) {
      const key = istParts(new Date(start.getTime() + i * DAY_MS)).day;
      trendMap.set(key, { key, label: dayLabel(key), sales: 0, bills: 0 });
    }
  }
  const hours = Array.from({ length: 24 }, (_, h) => ({ hour: h, label: hourLabel(h), sales: 0, bills: 0 }));
  const types = new Map();
  const sources = new Map();
  const perStore = new Map(stores.map(s => [s.id, { storeId: s.id, name: s.name, sales: 0, bills: 0 }]));

  for (const o of sales) {
    const { day, hour } = istParts(saleDate(o));
    const bucket = trendMap.get(byHour ? String(hour) : day);
    if (bucket) { bucket.sales += o.totalAmount; bucket.bills += 1; }
    hours[hour].sales += o.totalAmount;
    hours[hour].bills += 1;
    const t = types.get(o.type) || { key: o.type, sales: 0, bills: 0 };
    t.sales += o.totalAmount; t.bills += 1; types.set(o.type, t);
    const src = sources.get(o.origin) || { key: o.origin, sales: 0, bills: 0 };
    src.sales += o.totalAmount; src.bills += 1; sources.set(o.origin, src);
    const st = perStore.get(o.storeId);
    if (st) { st.sales += o.totalAmount; st.bills += 1; }
  }

  // Previous period on the same positions, for a faint comparison line
  const prevTrend = [];
  if (!byHour) {
    const prevBuckets = new Array(days).fill(0);
    for (const o of prevSales) {
      const idx = Math.floor((saleDate(o) - prevStart) / DAY_MS);
      if (idx >= 0 && idx < days) prevBuckets[idx] += o.totalAmount;
    }
    prevTrend.push(...prevBuckets);
  } else {
    const prevBuckets = new Array(24).fill(0);
    for (const o of prevSales) prevBuckets[istParts(saleDate(o)).hour] += o.totalAmount;
    prevTrend.push(...prevBuckets);
  }

  // Items and categories (item values are menu prices before discount and tax)
  const sortedItems = [...items].sort((a, b) => b.sales - a.sales || b.quantity - a.quantity);
  const categories = new Map();
  for (const i of items) {
    const c = categories.get(i.category) || { name: i.category, quantity: 0, sales: 0, items: 0 };
    c.quantity += i.quantity; c.sales += i.sales; c.items += 1;
    categories.set(i.category, c);
  }

  return {
    range: { from: query.from, to: query.to, days, groupBy: byHour ? "hour" : "day" },
    stores: stores.map(s => ({ id: s.id, name: s.name })),
    totals,
    previous: prevTotals,
    payments: { ...payments, refunds, refundsPending },
    trend: [...trendMap.values()],
    previousTrend: prevTrend,
    hours,
    byType: [...types.values()].sort((a, b) => b.sales - a.sales),
    bySource: [...sources.values()].sort((a, b) => b.sales - a.sales),
    byStore: stores.length > 1 ? [...perStore.values()].sort((a, b) => b.sales - a.sales) : [],
    items: sortedItems.map(i => ({ id: i.menuItemId, name: i.name, category: i.category, quantity: i.quantity, sales: i.sales })),
    categories: [...categories.values()].sort((a, b) => b.sales - a.sales),
    losses: {
      cancelledBills: cancelled.length,
      cancelledValue: cancelled.reduce((s, o) => s + o.totalAmount, 0),
      rejectedItems: rejected.count,
      rejectedValue: rejected.value,
      discounts: totals.discounts
    },
    open: { bills: open.length, value: open.reduce((s, o) => s + o.totalAmount, 0) }
  };
}

/** Every sale in the range, one row per bill, for the Excel export */
async function getSalesBills(actor, query = {}) {
  const stores = await resolveStores(actor, query.storeId);
  const storeName = new Map(stores.map(s => [s.id, s.name]));
  const start = istDayStart(query.from);
  const end = new Date(istDayStart(query.to).getTime() + DAY_MS);
  if ((end - start) / DAY_MS > MAX_DAYS) throw createHttpError(400, "Choose a range of a year or less");
  const prisma = getPrismaClient();
  const orders = (await loadOrders(prisma, stores.map(s => s.id), start, end))
    .filter(o => isSale(o) && saleDate(o) >= start && saleDate(o) < end)
    .sort((a, b) => saleDate(a) - saleDate(b));

  const ids = orders.map(o => o.id);
  const sessionIds = [...new Set(orders.map(o => o.tableSessionId).filter(Boolean))];
  const [invoices, tables] = await Promise.all([
    ids.length ? prisma.invoice.findMany({
      where: { status: "ISSUED", kind: { in: ["STANDARD", "CORPORATE"] }, OR: [{ orderId: { in: ids } }, ...(sessionIds.length ? [{ tableSessionId: { in: sessionIds } }] : [])] },
      select: { number: true, orderId: true, tableSessionId: true }
    }) : [],
    ids.length ? prisma.order.findMany({ where: { id: { in: ids } }, select: { id: true, table: { select: { tableNumber: true } } } }) : []
  ]);
  const invoiceFor = new Map();
  for (const inv of invoices) invoiceFor.set(inv.orderId || inv.tableSessionId, inv.number);
  const tableFor = new Map(tables.map(t => [t.id, t.table?.tableNumber ?? null]));

  return orders.map(o => {
    const split = paymentSplit(o);
    const ist = new Date(saleDate(o).getTime() + IST_OFFSET_MS);
    return {
      date: ist.toISOString().slice(0, 10),
      time: ist.toISOString().slice(11, 16),
      store: storeName.get(o.storeId),
      order: o.id.slice(-6).toUpperCase(),
      invoice: invoiceFor.get(o.id) || invoiceFor.get(o.tableSessionId) || "",
      table: tableFor.get(o.id) ?? "",
      type: o.type,
      source: o.origin,
      gross: o.subTotal,
      discount: o.discountAmount + (o.walletDiscount || 0),
      tax: o.taxAmount,
      total: o.totalAmount,
      cash: split.cash,
      online: split.online,
      dues: split.dues,
      notRecorded: split.unrecorded
    };
  });
}

module.exports = { getSalesReport, getSalesBills };
