const { getPrismaClient } = require("../../lib/prisma");
const { createHttpError } = require("../../middleware/error-handler");
const { verifyStoreAccess } = require("../menu/menu-service");

const VIEWER_ROLES = ["STORE_MANAGER", "TENANT_ADMIN", "SUPER_ADMIN"];

// Human-readable labels, also used for filters and CSV
const EVENT_LABELS = {
  ORDER_CREATED: "Order created",
  STATUS_CHANGED: "Status changed",
  ORDER_CANCELLED: "Order cancelled",
  ORDER_RECALLED: "Recalled to kitchen",
  ITEMS_EDITED: "Items edited",
  ITEMS_REJECTED: "Kitchen rejected items",
  COMPLIMENTARY_GIVEN: "Complimentary food given",
  ITEM_READY: "Item marked ready",
  ITEM_UNREADY: "Item ready undone",
  DELAY_ANNOUNCED: "Delay announced",
  PAYMENT_STARTED: "Payment started",
  PAYMENT_RECEIVED: "Payment received",
  PAYMENT_CONFIRMED: "Payment confirmed by staff",
  PAYMENT_WITHDRAWN: "Payment withdrawn",
  BILL_SETTLED: "Bill settled",
  BILL_ON_DUES: "Put on dues",
  OVERPAID: "Paid more than the bill",
  PROMO_APPLIED: "Promo code applied",
  PROMO_REMOVED: "Promo code removed",
  DUES_REPAID: "Dues paid back",
  DUES_REDUCED: "Dues reduced",
  REFUND_ISSUED: "Refund issued",
  REFUND_FAILED: "Refund failed",
  INVOICE_ISSUED: "Invoice issued",
  INVOICE_CANCELLED: "Invoice cancelled",
  CREDIT_NOTE_ISSUED: "Credit note issued",
  INVOICE_EMAILED: "Invoice emailed",
  INVOICE_DETAILS_SET: "Corporate invoice requested",
  INVOICE_DETAILS_CLEARED: "Corporate invoice request removed",
};

/**
 * Where an action came from, based on who did it.
 */
function sourceFor(actor, fallback = "SYSTEM") {
  if (!actor) return fallback;
  if (actor.role === "KITCHEN_STAFF") return "KDS";
  if (actor.role === "WAITER") return "WAITER";
  if (actor.role === "CUSTOMER") return "QR_MENU";
  return "POS";
}

/**
 * Appends an audit entry. Never throws: a logging problem must not undo or block the action itself.
 *
 * @param {object} entry
 * @param {string} entry.storeId
 * @param {string} [entry.orderId]
 * @param {string} [entry.tableSessionId]
 * @param {string} entry.type One of EVENT_LABELS keys
 * @param {object} [entry.actor] User who did it (null for guests/system)
 * @param {string} [entry.source] Overrides the source derived from the actor
 * @param {string} [entry.reason]
 * @param {number} [entry.amountBefore]
 * @param {number} [entry.amountAfter]
 * @param {object} [entry.data]
 */
async function logOrderEvent(entry) {
  try {
    await getPrismaClient().orderEvent.create({
      data: {
        storeId: entry.storeId,
        orderId: entry.orderId || null,
        tableSessionId: entry.tableSessionId || null,
        type: entry.type,
        source: entry.source || sourceFor(entry.actor),
        actorId: entry.actor?.id || null,
        actorName: entry.actor ? (entry.actor.name || entry.actor.email || null) : null,
        actorRole: entry.actor?.role || null,
        reason: entry.reason ? String(entry.reason).slice(0, 500) : null,
        amountBefore: Number.isFinite(entry.amountBefore) ? Math.round(entry.amountBefore) : null,
        amountAfter: Number.isFinite(entry.amountAfter) ? Math.round(entry.amountAfter) : null,
        data: entry.data ?? undefined
      }
    });
  } catch (error) {
    console.error(`[Audit] Could not record ${entry.type} for order ${entry.orderId || entry.tableSessionId}:`, error.message);
  }
}

/** Compact "2× Paneer Tikka @ ₹240" lines for before/after snapshots */
function describeItems(items = []) {
  return items
    .filter(i => i.status !== "REJECTED")
    .map(i => ({
      name: i.displayName || i.customName || i.menuItem?.name || "Item",
      quantity: i.quantity,
      price: i.priceAtOrder
    }));
}

function serializeEvent(e) {
  return {
    id: e.id,
    orderId: e.orderId,
    tableSessionId: e.tableSessionId,
    type: e.type,
    label: EVENT_LABELS[e.type] || e.type,
    source: e.source,
    actorId: e.actorId,
    actorName: e.actorName || (e.source === "QR_MENU" ? "Guest" : e.source === "SYSTEM" || e.source === "WEBHOOK" ? "System" : "Unknown"),
    actorRole: e.actorRole,
    reason: e.reason,
    amountBefore: e.amountBefore,
    amountAfter: e.amountAfter,
    data: e.data,
    createdAt: e.createdAt
  };
}

async function assertViewer(actor, storeId) {
  if (!VIEWER_ROLES.includes(actor.role)) {
    throw createHttpError(403, "Only managers and owners can view the audit log");
  }
  await verifyStoreAccess(actor, storeId);
}

/**
 * Full history of one order, including table-bill events (payments, settlement) for its session.
 */
async function getOrderAudit(actor, storeId, orderId) {
  await assertViewer(actor, storeId);
  const prisma = getPrismaClient();
  const order = await prisma.order.findUnique({ where: { id: orderId }, select: { storeId: true, tableSessionId: true } });
  if (!order || order.storeId !== storeId) throw createHttpError(404, "Order not found");

  const events = await prisma.orderEvent.findMany({
    where: {
      storeId,
      OR: [{ orderId }, ...(order.tableSessionId ? [{ tableSessionId: order.tableSessionId, orderId: null }] : [])]
    },
    orderBy: { createdAt: "asc" }
  });

  const edits = events.filter(e => e.type === "ITEMS_EDITED");
  const editsBy = {};
  for (const e of edits) {
    const name = e.actorName || "Unknown";
    editsBy[name] = (editsBy[name] || 0) + 1;
  }

  return {
    orderId,
    events: events.map(serializeEvent),
    summary: { totalEvents: events.length, editCount: edits.length, editsBy }
  };
}

function buildStoreFilter(storeId, query = {}) {
  const where = { storeId };
  if (query.type) where.type = { in: String(query.type).split(",").map(t => t.trim()).filter(Boolean) };
  if (query.actorId) where.actorId = query.actorId;
  if (query.orderId) where.orderId = { contains: String(query.orderId).trim(), mode: "insensitive" };
  if (query.from || query.to) {
    where.createdAt = {};
    if (query.from) where.createdAt.gte = new Date(query.from);
    if (query.to) where.createdAt.lte = new Date(query.to);
  }
  return where;
}

/**
 * Store-wide audit log with filters, plus per-person counts of the actions that matter most.
 */
async function listStoreAudit(actor, storeId, query = {}) {
  await assertViewer(actor, storeId);
  const prisma = getPrismaClient();
  const where = buildStoreFilter(storeId, query);
  const page = Math.max(1, parseInt(query.page, 10) || 1);
  const limit = Math.min(200, Math.max(10, parseInt(query.limit, 10) || 50));

  const [total, events, byActor] = await Promise.all([
    prisma.orderEvent.count({ where }),
    prisma.orderEvent.findMany({ where, orderBy: { createdAt: "desc" }, skip: (page - 1) * limit, take: limit }),
    prisma.orderEvent.groupBy({
      by: ["actorId", "actorName", "actorRole", "type"],
      where: { ...where, type: { in: ["ITEMS_EDITED", "ORDER_CANCELLED", "ITEMS_REJECTED", "REFUND_ISSUED", "INVOICE_CANCELLED", "PAYMENT_CONFIRMED"] } },
      _count: { _all: true }
    })
  ]);

  const people = new Map();
  for (const row of byActor) {
    const key = row.actorId || `system:${row.actorName || "System"}`;
    if (!people.has(key)) {
      people.set(key, { actorId: row.actorId, actorName: row.actorName || "System", actorRole: row.actorRole, counts: {} });
    }
    people.get(key).counts[row.type] = row._count._all;
  }

  return {
    events: events.map(serializeEvent),
    pagination: { total, page, limit, pages: Math.ceil(total / limit) },
    byPerson: [...people.values()].sort((a, b) =>
      Object.values(b.counts).reduce((x, y) => x + y, 0) - Object.values(a.counts).reduce((x, y) => x + y, 0)),
    eventTypes: EVENT_LABELS
  };
}

// Things that happened to an order after it was placed and cost (or may cost) the store money.
// kind: "lost" = money gone, "risk" = money not collected yet, "watch" = worth a look, no amount lost by itself
const LEAK_CATEGORIES = [
  { key: "CANCELLED", kind: "lost", label: "Cancelled orders", hint: "Orders cancelled by staff after they were placed" },
  { key: "REJECTED", kind: "lost", label: "Kitchen couldn't make", hint: "Items the kitchen rejected and took off the bill" },
  { key: "COMPLIMENTARY", kind: "lost", label: "Complimentary food", hint: "Free food given in place of something that went wrong" },
  { key: "EDITED", kind: "lost", label: "Bills edited", hint: "Items changed after the order was placed; the amount is how much bills went down" },
  { key: "DISCOUNT", kind: "lost", label: "Discounts by staff", hint: "Promo codes staff added to a bill after it was placed" },
  { key: "REFUND", kind: "lost", label: "Refunds", hint: "Money given back to guests" },
  { key: "DUES_REDUCED", kind: "lost", label: "Dues written down", hint: "Dues reduced without being paid" },
  { key: "DUES", kind: "risk", label: "Put on dues", hint: "Bills left unpaid, to be collected later" },
  { key: "PAYMENT_WITHDRAWN", kind: "watch", label: "Payments withdrawn", hint: "A payment was started, then marked as not received" },
  { key: "INVOICE_CANCELLED", kind: "watch", label: "Invoices cancelled", hint: "A tax invoice was cancelled after being issued" }
];
const LEAK_EVENT_TYPES = [
  "ORDER_CANCELLED", "ITEMS_REJECTED", "COMPLIMENTARY_GIVEN", "ITEMS_EDITED", "PROMO_APPLIED",
  "REFUND_ISSUED", "DUES_REDUCED", "BILL_ON_DUES", "PAYMENT_WITHDRAWN", "INVOICE_CANCELLED"
];

const drop = (e) => Math.max(0, (e.amountBefore || 0) - (e.amountAfter || 0));

/** Which leakage an audit entry is and how much money it involves; null when it isn't one. */
function classifyLeak(e) {
  switch (e.type) {
    case "ORDER_CANCELLED":
      // Guests abandoning an unpaid order, and timeouts, aren't leakage
      if (!e.actorId) return null;
      // A whole order rejected by the kitchen is counted once, under rejections
      if ((e.reason || "").startsWith("Rejected by kitchen")) return null;
      return { category: "CANCELLED", amount: e.amountBefore || 0, afterKitchen: ["PROCESSING", "READY", "SERVED"].includes(e.data?.from) };
    case "ITEMS_REJECTED":
      return { category: "REJECTED", amount: e.data?.wholeOrder ? (e.amountBefore || 0) : drop(e) };
    case "COMPLIMENTARY_GIVEN":
      return { category: "COMPLIMENTARY", amount: e.amountBefore || 0 };
    case "ITEMS_EDITED":
      return { category: "EDITED", amount: drop(e) };
    case "PROMO_APPLIED":
      return e.actorId && e.source !== "QR_MENU" ? { category: "DISCOUNT", amount: drop(e) } : null;
    case "REFUND_ISSUED":
      return { category: "REFUND", amount: drop(e) };
    case "DUES_REDUCED":
      return { category: "DUES_REDUCED", amount: drop(e) };
    case "BILL_ON_DUES":
      return { category: "DUES", amount: e.amountAfter || 0 };
    case "PAYMENT_WITHDRAWN":
      return { category: "PAYMENT_WITHDRAWN", amount: e.amountAfter || 0 };
    case "INVOICE_CANCELLED":
      return { category: "INVOICE_CANCELLED", amount: 0 };
    default:
      return null;
  }
}

/**
 * Leakage report: everything unusual that happened to orders after they were placed, in a date range,
 * with totals per kind and per staff member.
 *
 * @param {object} query from, to (ISO dates; defaults to today), category (optional)
 */
async function listLeakages(actor, storeId, query = {}) {
  await assertViewer(actor, storeId);
  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);
  const from = query.from ? new Date(query.from) : startOfToday;
  const to = query.to ? new Date(query.to) : new Date();
  if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime())) throw createHttpError(400, "Invalid date range");

  const MAX = 5000;
  const rows = await getPrismaClient().orderEvent.findMany({
    where: { storeId, type: { in: LEAK_EVENT_TYPES }, createdAt: { gte: from, lte: to } },
    orderBy: { createdAt: "desc" },
    take: MAX
  });

  const totals = new Map(LEAK_CATEGORIES.map(c => [c.key, { ...c, count: 0, amount: 0 }]));
  const people = new Map();
  const events = [];
  for (const row of rows) {
    const leak = classifyLeak(row);
    if (!leak) continue;
    const bucket = totals.get(leak.category);
    bucket.count += 1;
    bucket.amount += leak.amount;

    const event = { ...serializeEvent(row), category: leak.category, kind: bucket.kind, leakAmount: leak.amount, afterKitchen: Boolean(leak.afterKitchen) };
    const personKey = row.actorId || `name:${event.actorName}`;
    if (!people.has(personKey)) {
      people.set(personKey, { actorId: row.actorId, actorName: event.actorName, actorRole: row.actorRole, count: 0, lostAmount: 0, counts: {} });
    }
    const person = people.get(personKey);
    person.count += 1;
    person.counts[leak.category] = (person.counts[leak.category] || 0) + 1;
    if (bucket.kind === "lost") person.lostAmount += leak.amount;

    if (!query.category || query.category === leak.category) events.push(event);
  }

  const categories = [...totals.values()];
  return {
    from,
    to,
    truncated: rows.length === MAX,
    summary: {
      lostAmount: categories.filter(c => c.kind === "lost").reduce((sum, c) => sum + c.amount, 0),
      riskAmount: categories.filter(c => c.kind === "risk").reduce((sum, c) => sum + c.amount, 0),
      count: categories.reduce((sum, c) => sum + c.count, 0)
    },
    categories,
    byPerson: [...people.values()].sort((a, b) => b.lostAmount - a.lostAmount || b.count - a.count),
    events: events.slice(0, 500)
  };
}

const csvCell = (value) => {
  if (value === null || value === undefined) return "";
  const text = typeof value === "object" ? JSON.stringify(value) : String(value);
  return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
};

/**
 * CSV of the filtered audit log (up to 20,000 rows).
 */
async function exportStoreAuditCsv(actor, storeId, query = {}) {
  await assertViewer(actor, storeId);
  const events = await getPrismaClient().orderEvent.findMany({
    where: buildStoreFilter(storeId, query),
    orderBy: { createdAt: "asc" },
    take: 20000
  });
  const header = ["Time", "Order", "Table bill", "Action", "Source", "By", "Role", "Reason", "Amount before", "Amount after", "Details"];
  const rows = events.map(e => [
    e.createdAt.toISOString(),
    e.orderId,
    e.tableSessionId,
    EVENT_LABELS[e.type] || e.type,
    e.source,
    e.actorName,
    e.actorRole,
    e.reason,
    e.amountBefore,
    e.amountAfter,
    e.data
  ].map(csvCell).join(","));
  return [header.join(","), ...rows].join("\n");
}

module.exports = {
  EVENT_LABELS,
  logOrderEvent,
  describeItems,
  sourceFor,
  getOrderAudit,
  listStoreAudit,
  listLeakages,
  exportStoreAuditCsv
};
