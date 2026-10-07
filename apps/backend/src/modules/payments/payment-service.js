const { getPrismaClient } = require("../../lib/prisma");
const { createHttpError } = require("../../middleware/error-handler");
const { verifyStoreAccess } = require("../menu/menu-service");
const { userRoles } = require("../../constants/roles");
const { broadcastToStore, broadcastToCustomer } = require("../orders/sse-service");
const { invalidateTablesCache } = require("../../lib/cache");
const { buildUpiIntent, UPI_ID_PATTERN } = require("@smo/shared/pricing");
const { cleanPhone, cleanEmail } = require("../../lib/contact");
const {
  getQrCodesStatus,
  getTenantRazorpay,
  requireTenantRazorpay,
  createCollection,
  fetchCollectionStatus,
  closeCollection,
  isCheckoutSignatureValid,
  describeRazorpayError
} = require("./razorpay-gateway");

const CHANNELS = ["RAZORPAY", "UPI_OFFLINE", "CASH"];
const COLLECTOR_ROLES = [
  userRoles.superAdmin,
  userRoles.tenantAdmin,
  userRoles.storeManager,
  userRoles.cashier,
  userRoles.waiter
];
// Guests' UPI payments to the store's own ID are confirmed by these roles only (not waiters)
const GUEST_UPI_CONFIRM_ROLES = [userRoles.superAdmin, userRoles.tenantAdmin, userRoles.storeManager, userRoles.cashier];
// Don't hammer Razorpay when several screens poll the same payment
const REFRESH_THROTTLE_MS = 3000;
const lastRefreshAt = new Map();

// Lazy to avoid a require cycle with order-service
const orderService = () => require("../orders/order-service");
const { logOrderEvent } = require("../audit/audit-service");
const CHANNEL_LABEL = { RAZORPAY: "Razorpay", UPI_OFFLINE: "UPI (own QR)", CASH: "Cash", DUES: "Dues" };

function assertCanCollect(actor) {
  if (!actor || !COLLECTOR_ROLES.includes(actor.role)) {
    throw createHttpError(403, "Only cashiers, waiters and managers can collect payments");
  }
}

function shortRef(id) {
  return id.slice(-6).toUpperCase();
}

function toWholeRupees(value, field) {
  const n = Number(value);
  if (!Number.isFinite(n) || !Number.isInteger(n) || n <= 0) {
    throw createHttpError(400, `${field} must be a whole number of rupees greater than 0`);
  }
  return n;
}

async function loadStore(prisma, storeId) {
  const store = await prisma.store.findUnique({
    relationLoadStrategy: "join",
    where: { id: storeId },
    select: {
      id: true,
      name: true,
      tenantId: true,
      offlineUpiId: true,
      offlineUpiPayeeName: true,
      tenant: { select: { name: true, offlineUpiId: true, offlineUpiPayeeName: true } }
    }
  });
  if (!store) throw createHttpError(404, "Store not found");
  return store;
}

function resolveOfflineUpi(store) {
  if (store.offlineUpiId) {
    return { vpa: store.offlineUpiId, payeeName: store.offlineUpiPayeeName || store.name };
  }
  if (store.tenant?.offlineUpiId) {
    return { vpa: store.tenant.offlineUpiId, payeeName: store.tenant.offlineUpiPayeeName || store.tenant.name };
  }
  return null;
}

function serializePayment(p) {
  return {
    id: p.id,
    orderId: p.orderId,
    tableSessionId: p.tableSessionId,
    channel: p.channel,
    status: p.status,
    amount: p.amount,
    providerKind: p.providerKind,
    providerPaymentId: p.providerPaymentId,
    qrImageUrl: p.qrImageUrl,
    qrPayload: p.qrPayload,
    cashTendered: p.cashTendered,
    changeDue: p.changeDue,
    collectedBy: p.collectedBy ? { id: p.collectedBy.id, name: p.collectedBy.name } : null,
    duesAccount: p.duesAccount ? { id: p.duesAccount.id, name: p.duesAccount.name } : null,
    paidAt: p.paidAt,
    expiresAt: p.expiresAt,
    fromGuest: Boolean(p.fromGuest),
    guestClaimedAt: p.guestClaimedAt || null,
    guestReference: p.guestReference || null,
    createdAt: p.createdAt
  };
}

const paymentInclude = {
  orderBy: { createdAt: "asc" },
  include: {
    collectedBy: { select: { id: true, name: true } },
    duesAccount: { select: { id: true, name: true } }
  }
};

/**
 * Resolves what is being paid for: a single order or a whole table session.
 * The total is always computed on the server from the orders themselves.
 */
async function loadTarget(prisma, storeId, ref) {
  if (ref.orderId) {
    const order = await prisma.order.findUnique({
      relationLoadStrategy: "join",
      where: { id: ref.orderId },
      include: { table: true, payments: paymentInclude }
    });
    if (!order || order.storeId !== storeId) throw createHttpError(404, "Order not found");

    const blockers = order.status === "PENDING_VERIFICATION"
      ? [{ id: order.id, reason: "Waiting for waiter verification" }]
      : [];

    return {
      kind: "ORDER",
      id: order.id,
      storeId,
      label: `Order #${shortRef(order.id)}`,
      tableNumber: order.table?.tableNumber ?? null,
      totalAmount: order.totalAmount,
      isSettled: order.status === "SETTLED" || Boolean(order.paidAt),
      isCancelled: order.status === "CANCELLED",
      payments: order.payments,
      orders: [order],
      blockers
    };
  }

  if (ref.tableSessionId) {
    const session = await prisma.tableSession.findUnique({
      relationLoadStrategy: "join",
      where: { id: ref.tableSessionId },
      include: {
        table: true,
        payments: paymentInclude,
        orders: { orderBy: { createdAt: "asc" } }
      }
    });
    if (!session || session.storeId !== storeId) throw createHttpError(404, "Table session not found");

    const isSettled = session.status === "SETTLED";
    // Orders already paid on their own (e.g. prepaid QR orders) are not part of the table bill
    const billOrders = isSettled
      ? []
      : session.orders.filter(o => !["CANCELLED", "SETTLED"].includes(o.status) && !o.paidAt);
    const totalAmount = isSettled
      ? session.payments.filter(p => p.status === "PAID").reduce((s, p) => s + p.amount, 0)
      : billOrders.reduce((s, o) => s + o.totalAmount, 0);

    return {
      kind: "TABLE_SESSION",
      id: session.id,
      storeId,
      label: `Table ${session.table?.tableNumber ?? ""} bill`,
      tableNumber: session.table?.tableNumber ?? null,
      totalAmount,
      isSettled,
      isCancelled: session.status === "CANCELLED",
      payments: session.payments,
      orders: billOrders,
      blockers: billOrders
        .filter(o => o.status === "PENDING_VERIFICATION")
        .map(o => ({ id: o.id, reason: `Order #${shortRef(o.id)} is waiting for waiter verification` }))
    };
  }

  throw createHttpError(400, "orderId or tableSessionId is required");
}

function summarize(target) {
  const paidAmount = target.payments.filter(p => p.status === "PAID").reduce((s, p) => s + p.amount, 0);
  const pendingAmount = target.payments.filter(p => p.status === "PENDING").reduce((s, p) => s + p.amount, 0);
  return {
    kind: target.kind,
    id: target.id,
    label: target.label,
    tableNumber: target.tableNumber,
    totalAmount: target.totalAmount,
    paidAmount,
    pendingAmount,
    dueAmount: Math.max(0, target.totalAmount - paidAmount),
    isSettled: target.isSettled,
    isCancelled: target.isCancelled,
    blockers: target.blockers,
    orders: target.orders.map(o => ({ id: o.id, status: o.status, totalAmount: o.totalAmount })),
    payments: target.payments.map(serializePayment)
  };
}

function targetRef(payment) {
  return payment.tableSessionId ? { tableSessionId: payment.tableSessionId } : { orderId: payment.orderId };
}

async function broadcastSummary(storeId, ref) {
  try {
    const target = await loadTarget(getPrismaClient(), storeId, ref);
    const summary = summarize(target);
    broadcastToStore(storeId, "PAYMENT_UPDATED", summary);
    return summary;
  } catch (error) {
    console.warn("[Payments] summary broadcast failed:", error.message);
    return null;
  }
}

/** One word for how a bill was paid: a single channel, or SPLIT when mixed */
function methodFor(cash, online, dues) {
  const used = [cash > 0 && "CASH", online > 0 && "ONLINE", dues > 0 && "DUES"].filter(Boolean);
  if (used.length > 1) return "SPLIT";
  return used[0] || "ONLINE";
}

/**
 * Splits an amount across orders in proportion to their totals (remainder on the last order).
 */
function allocate(amount, orders) {
  const total = orders.reduce((s, o) => s + o.totalAmount, 0);
  let remaining = amount;
  return orders.map((o, i) => {
    if (i === orders.length - 1) return remaining;
    const share = total > 0 ? Math.round((amount * o.totalAmount) / total) : 0;
    remaining -= share;
    return share;
  });
}

/**
 * Marks one order as paid and moves it along its lifecycle:
 * unpaid prepaid → kitchen, served → settled, cooking → settles automatically when served.
 */
async function markOrderPaid(storeId, order, tender) {
  const prisma = getPrismaClient();
  await prisma.order.update({
    where: { id: order.id },
    data: {
      paidAt: new Date(),
      paymentMethod: tender.paymentMethod,
      cashAmount: tender.cashAmount,
      onlineAmount: tender.onlineAmount,
      duesAmount: tender.duesAmount || 0
    }
  });

  const { updateOrderStatus, getOrderById } = orderService();
  if (["DRAFT", "PENDING_PAYMENT"].includes(order.status)) {
    await updateOrderStatus(null, storeId, order.id, "PROCESSING", true);
  } else if (order.status === "SERVED") {
    await updateOrderStatus(null, storeId, order.id, "SETTLED", true);
  } else {
    broadcastToStore(storeId, "ORDER_UPDATED", await getOrderById(storeId, order.id));
  }
  invalidateTablesCache(storeId);
}

/**
 * Settles the order/session once PAID payments cover the total. Safe to call repeatedly.
 */
async function applySettlement(storeId, ref) {
  const prisma = getPrismaClient();
  const target = await loadTarget(prisma, storeId, ref);
  if (target.isSettled) {
    // A payment that lands after the bill was settled (e.g. a QR paid at the last second)
    await flagOverpayment(storeId, ref);
    return summarize(target);
  }
  if (target.isCancelled) return summarize(target);

  const paid = target.payments.filter(p => p.status === "PAID");
  const paidAmount = paid.reduce((s, p) => s + p.amount, 0);
  if (paidAmount < target.totalAmount) return summarize(target);

  // Claim the settlement first: if two payments complete together, only one caller settles the
  // bill (one invoice number, one cashback credit, one "bill settled" entry)
  const claimed = target.kind === "ORDER"
    ? await prisma.order.updateMany({ where: { id: target.id, paidAt: null, status: { not: "CANCELLED" } }, data: { paidAt: new Date() } })
    : await prisma.tableSession.updateMany({ where: { id: target.id, status: "ACTIVE" }, data: { status: "SETTLED" } });
  if (claimed.count === 0) return broadcastSummary(storeId, ref);

  // Bill is covered: withdraw any QR still waiting so the guest can't pay twice
  const stillPending = target.payments.filter(p => p.status === "PENDING");
  for (const p of stillPending) {
    await withdrawPayment(storeId, p);
  }

  const cashAmount = paid.filter(p => p.channel === "CASH").reduce((s, p) => s + p.amount, 0);
  const duesAmount = paid.filter(p => p.channel === "DUES").reduce((s, p) => s + p.amount, 0);
  const onlineAmount = paidAmount - cashAmount - duesAmount;
  const paymentMethod = methodFor(cashAmount, onlineAmount, duesAmount);

  await logOrderEvent({
    storeId,
    orderId: target.kind === "ORDER" ? target.id : null,
    tableSessionId: target.kind === "TABLE_SESSION" ? target.id : null,
    type: "BILL_SETTLED",
    source: "SYSTEM",
    amountAfter: target.totalAmount,
    data: { paymentMethod, cashAmount, onlineAmount, duesAmount, orders: target.orders.map(o => o.id) }
  });

  if (target.kind === "ORDER") {
    await markOrderPaid(storeId, target.orders[0], { paymentMethod, cashAmount, onlineAmount, duesAmount });
  } else {
    const cashShares = allocate(cashAmount, target.orders);
    const onlineShares = allocate(onlineAmount, target.orders);
    const duesShares = allocate(duesAmount, target.orders);
    for (let i = 0; i < target.orders.length; i++) {
      await markOrderPaid(storeId, target.orders[i], {
        paymentMethod: methodFor(cashShares[i], onlineShares[i], duesShares[i]),
        cashAmount: cashShares[i],
        onlineAmount: onlineShares[i],
        duesAmount: duesShares[i]
      });
    }

    const session = await prisma.tableSession.update({
      where: { id: target.id },
      data: { status: "SETTLED", paymentMethod, cashAmount, onlineAmount, duesAmount },
      include: { table: true }
    });
    broadcastToStore(storeId, "TABLE_SESSION_SETTLED", { tableSessionId: session.id, tableId: session.tableId });
    invalidateTablesCache(storeId);

    try {
      const { creditOrderCashback } = require("../loyalty/loyalty-service");
      for (const order of target.orders) await creditOrderCashback(order.id);
    } catch (error) {
      console.error("[Payments] cashback on session settle:", error.message);
    }
  }

  // Numbered GST invoice for the paid bill (never blocks settlement)
  const { issueStandardInvoice } = require("../invoices/invoice-service");
  await issueStandardInvoice(storeId, ref).catch(err => console.error("[Invoices] could not issue invoice:", err.message));

  await flagOverpayment(storeId, ref);
  return broadcastSummary(storeId, ref);
}

/**
 * Money received beyond what the bill (and refunds already owed) explain becomes a refund due on the
 * order, so staff see it in the refund banners instead of it going unnoticed.
 * Safe to call repeatedly: only the unexplained part is added each time.
 */
async function flagOverpayment(storeId, ref) {
  const prisma = getPrismaClient();
  try {
    const paymentWhere = ref.orderId ? { orderId: ref.orderId } : { tableSessionId: ref.tableSessionId };
    const paid = await prisma.payment.aggregate({ where: { ...paymentWhere, status: "PAID" }, _sum: { amount: true } });
    const received = paid._sum.amount || 0;
    if (received <= 0) return;

    // The orders this money was for: the order itself, or the table's orders not paid on their own
    let orders;
    if (ref.orderId) {
      orders = await prisma.order.findMany({ where: { id: ref.orderId }, select: { id: true, totalAmount: true, refundDue: true, status: true, createdAt: true } });
    } else {
      const all = await prisma.order.findMany({
        where: { tableSessionId: ref.tableSessionId },
        select: { id: true, totalAmount: true, refundDue: true, status: true, createdAt: true, payments: { where: { status: "PAID" }, select: { id: true } } }
      });
      orders = all.filter(o => o.payments.length === 0);
    }
    if (orders.length === 0) return;

    const ids = orders.map(o => o.id);
    const billed = orders.filter(o => o.status !== "CANCELLED").reduce((s, o) => s + o.totalAmount, 0);
    const owedBack = orders.reduce((s, o) => s + (o.refundDue || 0), 0);
    const refunded = await prisma.refund.aggregate({ where: { orderId: { in: ids }, status: { in: ["PENDING", "PROCESSED"] } }, _sum: { amount: true } });
    const extra = received - billed - owedBack - (refunded._sum.amount || 0);
    if (extra <= 0) return;

    // Put it on the latest order of the bill, where the refund screens will show it
    const target = [...orders].sort((a, b) => b.createdAt - a.createdAt)[0];
    await prisma.order.update({ where: { id: target.id }, data: { refundDue: { increment: extra } } });
    await logOrderEvent({
      storeId,
      orderId: target.id,
      tableSessionId: ref.tableSessionId || null,
      type: "OVERPAID",
      source: "SYSTEM",
      amountAfter: extra,
      data: { received, billed }
    });
    broadcastToStore(storeId, "ORDER_UPDATED", { id: target.id, refundDue: (target.refundDue || 0) + extra });
    console.warn(`[Payments] Overpaid by ₹${extra} on ${ref.orderId ? "order " + ref.orderId : "table bill " + ref.tableSessionId}`);
  } catch (error) {
    console.error("[Payments] overpayment check failed:", error.message);
  }
}

// Cashiers and managers can put a bill on dues (a note and the guest's details are required)
const DUES_ROLES = [userRoles.superAdmin, userRoles.tenantAdmin, userRoles.storeManager, userRoles.cashier];

/** Who ate: a name plus at least one way to reach them */
function cleanGuest(input = {}) {
  const name = String(input.name || "").trim().slice(0, 80);
  if (name.length < 2) throw createHttpError(400, "Enter the guest's name");
  const phone = cleanPhone(input.phone, "phone number");
  const whatsapp = cleanPhone(input.whatsapp, "WhatsApp number");
  const email = cleanEmail(input.email);
  if (!phone && !whatsapp && !email) throw createHttpError(400, "Add the guest's phone, WhatsApp or email");
  return { name, phone, whatsapp, email };
}

/**
 * Closes the rest of a bill on credit: the amount still due is recorded as a DUES payment owed by a
 * dues account (the owner by default). The bill settles like any paid bill — it counts as a sale,
 * gets its GST invoice and goes to the kitchen — and the money is collected later on the Dues page.
 *
 * @param {{orderId?: string, tableSessionId?: string}} ref
 * @param {{ accountId?: string, guest: object, note: string }} input
 */
async function putBillOnDues(actor, storeId, ref, input = {}) {
  if (!actor || !DUES_ROLES.includes(actor.role)) {
    throw createHttpError(403, "Only cashiers and managers can put a bill on dues");
  }
  await verifyStoreAccess(actor, storeId);
  const note = String(input.note || "").trim().slice(0, 200);
  if (note.length < 3) throw createHttpError(400, "Add a note: why is this bill going on dues?");
  const guest = cleanGuest(input.guest);

  const prisma = getPrismaClient();
  const store = await prisma.store.findUnique({ where: { id: storeId }, select: { tenantId: true } });
  const { resolveDuesAccount } = require("../dues/dues-service");
  const account = await resolveDuesAccount(store.tenantId, input.accountId);

  const target = await loadTarget(prisma, storeId, ref);
  if (target.isSettled) throw createHttpError(409, "This bill is already paid");
  if (target.isCancelled) throw createHttpError(409, "This bill was cancelled");
  if (target.blockers.length > 0) throw createHttpError(409, target.blockers[0].reason);

  // A QR still on screen must not also take the guest's money
  for (const p of target.payments.filter(p => p.status === "PENDING")) {
    await withdrawPayment(storeId, p);
  }
  const paidAmount = target.payments.filter(p => p.status === "PAID").reduce((s, p) => s + p.amount, 0);
  const amount = target.totalAmount - paidAmount;
  if (amount <= 0) throw createHttpError(409, "Nothing is left to pay on this bill");

  const now = new Date();
  const payment = await prisma.payment.create({
    data: {
      storeId,
      ...(target.kind === "ORDER" ? { orderId: target.id } : { tableSessionId: target.id }),
      channel: "DUES",
      status: "PAID",
      amount,
      duesAccountId: account.id,
      duesGuest: guest,
      duesNote: note,
      collectedById: actor.id,
      paidAt: now
    }
  });

  await logOrderEvent({
    storeId,
    orderId: target.kind === "ORDER" ? target.id : null,
    tableSessionId: target.kind === "TABLE_SESSION" ? target.id : null,
    type: "BILL_ON_DUES",
    actor,
    reason: note,
    amountAfter: amount,
    data: { account: account.name, accountId: account.id, guest: guest.name, paymentId: payment.id }
  });

  return applySettlement(storeId, ref);
}

/**
 * Records a payment as PAID exactly once and settles the bill if covered.
 * @param {string[]} fromStatuses statuses that may transition to PAID
 */
async function markPaymentPaid(paymentId, { providerPaymentId = null, collectedById = null, fromStatuses = ["PENDING"] } = {}) {
  const prisma = getPrismaClient();
  const data = { status: "PAID", paidAt: new Date() };
  if (collectedById) data.collectedById = collectedById;

  let result;
  try {
    result = await prisma.payment.updateMany({
      where: { id: paymentId, status: { in: fromStatuses } },
      data: providerPaymentId ? { ...data, providerPaymentId } : data
    });
  } catch (error) {
    if (error.code !== "P2002") throw error;
    // providerPaymentId already recorded elsewhere — keep the payment, drop the duplicate reference
    result = await prisma.payment.updateMany({ where: { id: paymentId, status: { in: fromStatuses } }, data });
  }
  if (result.count === 0) return false;

  const payment = await prisma.payment.findUnique({ where: { id: paymentId } });
  if (payment.channel === "RAZORPAY") {
    await logOrderEvent({
      storeId: payment.storeId,
      orderId: payment.orderId,
      tableSessionId: payment.tableSessionId,
      type: "PAYMENT_RECEIVED",
      source: "SYSTEM",
      amountAfter: payment.amount,
      data: { channel: payment.channel, paymentId: payment.id, providerPaymentId: payment.providerPaymentId }
    });
  }
  await applySettlement(payment.storeId, targetRef(payment));
  await broadcastSummary(payment.storeId, targetRef(payment));
  return true;
}

/**
 * Cancels a pending payment. Razorpay collections are closed first and re-checked,
 * so a guest who paid at the last second is still recorded as PAID.
 */
async function withdrawPayment(storeId, payment) {
  const prisma = getPrismaClient();
  if (payment.channel === "RAZORPAY" && payment.providerRef) {
    const store = await loadStore(prisma, storeId);
    const rp = await getTenantRazorpay(store.tenantId);
    if (rp) {
      await closeCollection(rp, payment);
      try {
        const status = await fetchCollectionStatus(rp, payment);
        if (status.paid) {
          await prisma.payment.updateMany({
            where: { id: payment.id, status: "PENDING" },
            data: { status: "PAID", paidAt: new Date(), providerPaymentId: status.providerPaymentId || null }
          });
          return "PAID";
        }
      } catch (error) {
        console.warn("[Payments] re-check on withdraw failed:", describeRazorpayError(error));
      }
    }
  }
  await prisma.payment.updateMany({ where: { id: payment.id, status: "PENDING" }, data: { status: "CANCELLED" } });
  return "CANCELLED";
}

/**
 * Polls Razorpay for a pending gateway payment. Only the server decides a payment is paid.
 */
async function refreshPayment(payment, { force = false } = {}) {
  if (payment.channel !== "RAZORPAY" || payment.status !== "PENDING" || !payment.providerRef) return payment;

  const now = Date.now();
  if (!force && now - (lastRefreshAt.get(payment.id) || 0) < REFRESH_THROTTLE_MS) return payment;
  lastRefreshAt.set(payment.id, now);

  const prisma = getPrismaClient();
  try {
    const store = await loadStore(prisma, payment.storeId);
    const rp = await getTenantRazorpay(store.tenantId);
    if (!rp) return payment;

    const status = await fetchCollectionStatus(rp, payment);
    if (status.paid) {
      await markPaymentPaid(payment.id, { providerPaymentId: status.providerPaymentId });
    } else if (status.closed || (payment.expiresAt && payment.expiresAt.getTime() < now - 60_000)) {
      await prisma.payment.updateMany({ where: { id: payment.id, status: "PENDING" }, data: { status: "EXPIRED" } });
      await broadcastSummary(payment.storeId, targetRef(payment));
    }
  } catch (error) {
    console.warn(`[Payments] status check failed for ${payment.id}:`, describeRazorpayError(error));
  }
  return prisma.payment.findUnique({ where: { id: payment.id } });
}

async function refreshPendingForTarget(target) {
  const pending = target.payments.filter(p => p.status === "PENDING" && p.channel === "RAZORPAY");
  for (const p of pending) await refreshPayment(p);
  return pending.length > 0;
}

// ─── Staff API ────────────────────────────────────────────────────────────────

// Which ways this store can take money right now. Depends only on the store's
// settings, so the POS can ask before a bill exists (paying for a cart being built).
async function resolvePaymentChannels(store) {
  const rp = await getTenantRazorpay(store.tenantId);
  const qrStatus = rp ? await getQrCodesStatus(store.tenantId, rp) : null;
  const offlineUpi = resolveOfflineUpi(store);

  return {
    RAZORPAY: {
      enabled: Boolean(rp && qrStatus?.enabled),
      reason: !rp ? 'Razorpay keys are not set up for this brand.' : qrStatus?.reason || null
    },
    UPI_OFFLINE: { enabled: Boolean(offlineUpi), vpa: offlineUpi?.vpa || null, payeeName: offlineUpi?.payeeName || null },
    CASH: { enabled: true }
  };
}

async function getPaymentChannels(actor, storeId) {
  assertCanCollect(actor);
  await verifyStoreAccess(actor, storeId);
  const store = await loadStore(getPrismaClient(), storeId);
  return { channels: await resolvePaymentChannels(store) };
}

async function getPaymentSummary(actor, storeId, ref) {
  assertCanCollect(actor);
  await verifyStoreAccess(actor, storeId);
  const prisma = getPrismaClient();

  // Bill and store settings load side by side
  let [target, store] = await Promise.all([loadTarget(prisma, storeId, ref), loadStore(prisma, storeId)]);
  if (await refreshPendingForTarget(target)) {
    target = await loadTarget(prisma, storeId, ref);
  }

  return {
    ...summarize(target),
    channels: await resolvePaymentChannels(store)
  };
}

async function createPayment(actor, storeId, input = {}) {
  assertCanCollect(actor);
  await verifyStoreAccess(actor, storeId);
  const prisma = getPrismaClient();

  const channel = input.channel;
  if (!CHANNELS.includes(channel)) {
    throw createHttpError(400, `channel must be one of ${CHANNELS.join(", ")}`);
  }
  const amount = toWholeRupees(input.amount, "amount");
  const ref = input.tableSessionId ? { tableSessionId: input.tableSessionId } : { orderId: input.orderId };

  const target = await loadTarget(prisma, storeId, ref);
  if (target.isCancelled) throw createHttpError(409, "This bill was cancelled");
  if (target.isSettled) throw createHttpError(409, "This bill is already paid");
  if (target.blockers.length > 0) {
    throw createHttpError(409, target.blockers.map(b => b.reason).join("; "), { blockers: target.blockers });
  }

  const paidAmount = target.payments.filter(p => p.status === "PAID").reduce((s, p) => s + p.amount, 0);
  const dueAmount = target.totalAmount - paidAmount;
  if (dueAmount <= 0) throw createHttpError(409, "Nothing left to pay on this bill");
  if (amount > dueAmount) {
    throw createHttpError(400, `Amount ₹${amount} is more than the ₹${dueAmount} still due`);
  }

  const store = await loadStore(prisma, storeId);
  const base = {
    storeId,
    orderId: ref.orderId || null,
    tableSessionId: ref.tableSessionId || null,
    channel,
    amount
  };
  const note = target.tableNumber ? `${store.name} T${target.tableNumber} ${target.label}` : `${store.name} ${target.label}`;

  let payment;
  if (channel === "CASH") {
    const tendered = input.cashTendered === undefined || input.cashTendered === null || input.cashTendered === ""
      ? amount
      : toWholeRupees(input.cashTendered, "cashTendered");
    if (tendered < amount) throw createHttpError(400, `Cash received ₹${tendered} is less than ₹${amount}`);

    payment = await prisma.payment.create({
      data: {
        ...base,
        status: "PAID",
        paidAt: new Date(),
        cashTendered: tendered,
        changeDue: tendered - amount,
        collectedById: actor.id
      }
    });
  } else if (channel === "UPI_OFFLINE") {
    const upi = resolveOfflineUpi(store);
    if (!upi) {
      throw createHttpError(400, "No UPI ID is set for offline collection. Add one under Brand Setup → Payments.");
    }
    payment = await prisma.payment.create({
      data: {
        ...base,
        qrPayload: buildUpiIntent({ vpa: upi.vpa, payeeName: upi.payeeName, amount, note: note.slice(0, 50) })
      }
    });
  } else {
    const rp = await requireTenantRazorpay(store.tenantId);
    payment = await prisma.payment.create({ data: base });
    try {
      const collection = await createCollection(rp, {
        tenantId: store.tenantId,
        paymentId: payment.id,
        amount,
        description: note.slice(0, 80),
        notes: { store_id: storeId, order_id: ref.orderId || "", table_session_id: ref.tableSessionId || "" }
      });
      payment = await prisma.payment.update({ where: { id: payment.id }, data: collection });
    } catch (error) {
      await prisma.payment.update({ where: { id: payment.id }, data: { status: "FAILED" } });
      throw error;
    }
  }

  await logOrderEvent({
    storeId,
    orderId: ref.orderId || null,
    tableSessionId: ref.tableSessionId || null,
    type: payment.status === "PAID" ? "PAYMENT_RECEIVED" : "PAYMENT_STARTED",
    actor,
    amountAfter: amount,
    data: {
      channel: payment.channel,
      label: CHANNEL_LABEL[payment.channel],
      paymentId: payment.id,
      ...(payment.channel === "CASH" ? { cashTendered: payment.cashTendered, changeDue: payment.changeDue } : {})
    }
  });

  const summary = payment.status === "PAID"
    ? await applySettlement(storeId, ref)
    : await broadcastSummary(storeId, ref);

  return { payment: serializePayment(payment), summary };
}

async function loadPaymentForStore(prisma, storeId, paymentId) {
  const payment = await prisma.payment.findUnique({ where: { id: paymentId } });
  if (!payment || payment.storeId !== storeId) throw createHttpError(404, "Payment not found");
  return payment;
}

async function getPayment(actor, storeId, paymentId) {
  assertCanCollect(actor);
  await verifyStoreAccess(actor, storeId);
  const prisma = getPrismaClient();
  const payment = await refreshPayment(await loadPaymentForStore(prisma, storeId, paymentId));
  const summary = summarize(await loadTarget(prisma, storeId, targetRef(payment)));
  return { payment: serializePayment(payment), summary };
}

async function confirmOfflinePayment(actor, storeId, paymentId) {
  assertCanCollect(actor);
  await verifyStoreAccess(actor, storeId);
  const prisma = getPrismaClient();
  const payment = await loadPaymentForStore(prisma, storeId, paymentId);

  if (payment.channel !== "UPI_OFFLINE") {
    throw createHttpError(400, "Only offline UPI payments are confirmed by staff. Razorpay payments are verified automatically.");
  }
  assertCanConfirmGuestUpi(actor, payment);
  if (payment.status !== "PENDING") throw createHttpError(409, `Payment is already ${payment.status.toLowerCase()}`);

  await markPaymentPaid(payment.id, { collectedById: actor.id });
  if (payment.fromGuest) await tellGuestAboutPayment(payment, "PAID");
  await logOrderEvent({
    storeId,
    orderId: payment.orderId,
    tableSessionId: payment.tableSessionId,
    type: "PAYMENT_CONFIRMED",
    actor,
    amountAfter: payment.amount,
    data: { channel: payment.channel, paymentId: payment.id }
  });
  return getPayment(actor, storeId, paymentId);
}

async function cancelPayment(actor, storeId, paymentId) {
  assertCanCollect(actor);
  await verifyStoreAccess(actor, storeId);
  const prisma = getPrismaClient();
  const payment = await loadPaymentForStore(prisma, storeId, paymentId);
  assertCanConfirmGuestUpi(actor, payment);
  if (payment.status !== "PENDING") throw createHttpError(409, `Payment is already ${payment.status.toLowerCase()}`);

  const outcome = await withdrawPayment(storeId, payment);
  if (payment.fromGuest) await tellGuestAboutPayment(payment, outcome === "PAID" ? "PAID" : "NOT_RECEIVED");
  await logOrderEvent({
    storeId,
    orderId: payment.orderId,
    tableSessionId: payment.tableSessionId,
    type: outcome === "PAID" ? "PAYMENT_RECEIVED" : "PAYMENT_WITHDRAWN",
    actor,
    amountAfter: payment.amount,
    data: { channel: payment.channel, paymentId: payment.id, paidJustBeforeCancel: outcome === "PAID" }
  });
  if (outcome === "PAID") {
    await applySettlement(storeId, targetRef(payment));
  }
  await broadcastSummary(storeId, targetRef(payment));
  return getPayment(actor, storeId, paymentId);
}

// ─── Guests paying by UPI to the store's own ID (menu app) ──────────────────────

function assertCanConfirmGuestUpi(actor, payment) {
  if (payment.fromGuest && !GUEST_UPI_CONFIRM_ROLES.includes(actor?.role)) {
    throw createHttpError(403, "Only cashiers and managers can confirm or reject a guest's UPI payment");
  }
}

/** Live update for the guest's order screen after staff confirm or reject their UPI payment */
async function tellGuestAboutPayment(payment, outcome) {
  if (!payment.orderId) return;
  const order = await getPrismaClient().order.findUnique({ where: { id: payment.orderId }, select: { id: true, customerId: true, sessionId: true } });
  const event = { orderId: payment.orderId, paymentId: payment.id, outcome };
  if (order?.customerId) broadcastToCustomer(order.customerId, "GUEST_PAYMENT_UPDATED", event);
  if (order?.sessionId) broadcastToCustomer(order.sessionId, "GUEST_PAYMENT_UPDATED", event);
  broadcastToStore(payment.storeId, "GUEST_UPI_UPDATED", event);
}

/** Can guests pay this store by UPI to its own ID? */
async function storeTakesGuestUpi(storeId) {
  return Boolean(resolveOfflineUpi(await loadStore(getPrismaClient(), storeId)));
}

/**
 * A guest chose "Pay by UPI": a pending payment on the store's own UPI ID with the order code in
 * the note, so staff can match it in their UPI app. Staff confirm it (or not) on the POS.
 */
async function createGuestUpiPayment(order) {
  const prisma = getPrismaClient();
  const store = await loadStore(prisma, order.storeId);
  const upi = resolveOfflineUpi(store);
  if (!upi) throw createHttpError(400, "This store hasn't set up UPI payments yet. Please pay at the counter.");

  const code = `SMO-${shortRef(order.id)}`;
  const payment = await prisma.payment.create({
    data: {
      storeId: order.storeId,
      orderId: order.id,
      channel: "UPI_OFFLINE",
      amount: order.totalAmount,
      fromGuest: true,
      qrPayload: buildUpiIntent({ vpa: upi.vpa, payeeName: upi.payeeName, amount: order.totalAmount, note: `${code} ${store.name}`.slice(0, 50) })
    }
  });
  await logOrderEvent({
    storeId: order.storeId,
    orderId: order.id,
    type: "PAYMENT_STARTED",
    source: "QR_MENU",
    amountAfter: payment.amount,
    data: { channel: "UPI_OFFLINE", label: "UPI (guest, store's own ID)", paymentId: payment.id, code }
  });
  broadcastToStore(order.storeId, "GUEST_UPI_UPDATED", { orderId: order.id, paymentId: payment.id, outcome: "STARTED" });
  return guestUpiView(payment, upi);
}

/** What the guest's phone needs to pay, and where the payment stands */
function guestUpiView(payment, upi = null) {
  return {
    paymentId: payment.id,
    status: payment.status,
    amount: payment.amount,
    qrPayload: payment.status === "PENDING" ? payment.qrPayload : null,
    code: payment.orderId ? `SMO-${shortRef(payment.orderId)}` : null,
    payeeName: upi?.payeeName || null,
    vpa: upi?.vpa || null,
    claimedAt: payment.guestClaimedAt || null
  };
}

const UPI_REFERENCE = /^\d{12}$/;

/**
 * The guest says they've paid. Optional: the 12-digit UPI reference from their app, which staff
 * see next to the payment; the same reference can't be used twice at a store.
 * @param {{ sessionId?: string, customerId?: string }} guest who is asking (must own the order)
 */
async function claimGuestUpiPayment(storeId, orderId, guest, input = {}) {
  const prisma = getPrismaClient();
  const order = await prisma.order.findUnique({ where: { id: orderId }, select: { id: true, storeId: true, sessionId: true, customerId: true, table: { select: { tableNumber: true } }, pickupNumber: true } });
  const owns = order && order.storeId === storeId
    && ((guest.sessionId && order.sessionId === guest.sessionId) || (guest.customerId && order.customerId === guest.customerId));
  if (!owns) throw createHttpError(404, "Order not found");

  const payment = await prisma.payment.findFirst({
    where: { orderId, fromGuest: true, channel: "UPI_OFFLINE" },
    orderBy: { createdAt: "desc" }
  });
  if (!payment) throw createHttpError(404, "There's no UPI payment on this order");
  if (payment.status === "PAID") return guestUpiView(payment);
  if (payment.status !== "PENDING") throw createHttpError(409, "This payment was closed. Please pay at the counter.");

  let reference = null;
  if (input.reference !== undefined && input.reference !== null && String(input.reference).trim() !== '') {
    reference = String(input.reference).replace(/\s/g, '');
    if (!UPI_REFERENCE.test(reference)) throw createHttpError(400, "The UPI reference number has 12 digits. You can also leave it empty.");
    const used = await prisma.payment.findFirst({
      where: { storeId, guestReference: reference, id: { not: payment.id }, status: { in: ["PENDING", "PAID"] } },
      select: { id: true }
    });
    if (used) throw createHttpError(409, "That UPI reference number was already used for another payment");
  }

  const updated = await prisma.payment.update({
    where: { id: payment.id },
    data: { guestClaimedAt: payment.guestClaimedAt || new Date(), ...(reference ? { guestReference: reference } : {}) }
  });

  const place = order.table ? `Table ${order.table.tableNumber}` : order.pickupNumber != null ? `Pickup #${order.pickupNumber}` : `Order #${shortRef(orderId)}`;
  broadcastToStore(storeId, "GUEST_UPI_UPDATED", { orderId, paymentId: payment.id, outcome: "CLAIMED" });
  const { sendNotification } = require("../notifications/notification-service");
  sendNotification({
    storeId,
    type: "GUEST_UPI_CLAIMED",
    title: `${place}: UPI payment to confirm`,
    body: `Guest says they paid ₹${payment.amount} (SMO-${shortRef(orderId)}${reference ? `, ref …${reference.slice(-4)}` : ''}). Check your UPI app and confirm on the POS.`,
    data: { orderId, paymentId: payment.id, sound: "notification.mp3", url: "/dashboard/pos" },
    target: { roles: ["CASHIER", "STORE_MANAGER"], storeId }
  }).catch(() => {});

  return guestUpiView(updated);
}

/** Guest UPI payments waiting for a cashier, oldest first */
async function listGuestUpiPayments(actor, storeId) {
  if (!GUEST_UPI_CONFIRM_ROLES.includes(actor?.role)) {
    throw createHttpError(403, "Only cashiers and managers confirm guest UPI payments");
  }
  await verifyStoreAccess(actor, storeId);
  const payments = await getPrismaClient().payment.findMany({
    where: { storeId, fromGuest: true, channel: "UPI_OFFLINE", status: "PENDING" },
    orderBy: { createdAt: "asc" },
    take: 50,
    include: {
      order: {
        select: { id: true, status: true, pickupNumber: true, customerName: true, customerPhone: true, table: { select: { tableNumber: true } } }
      }
    }
  });
  return payments.map(p => ({
    ...serializePayment(p),
    code: p.orderId ? `SMO-${shortRef(p.orderId)}` : null,
    order: p.order
  }));
}

// ─── Customer checkout (menu app) ────────────────────────────────────────────

/**
 * Creates the Razorpay order for a prepaid QR-menu order and records it as a pending payment.
 */
async function createCheckoutForOrder(order) {
  const prisma = getPrismaClient();
  const store = await loadStore(prisma, order.storeId);
  const rp = await requireTenantRazorpay(store.tenantId);

  let rpOrder;
  try {
    rpOrder = await rp.client.orders.create({
      amount: order.totalAmount * 100,
      currency: "INR",
      receipt: order.id,
      notes: { order_id: order.id, store_id: order.storeId }
    });
  } catch (error) {
    throw createHttpError(502, `Razorpay could not create the payment: ${describeRazorpayError(error)}`);
  }

  await prisma.payment.create({
    data: {
      storeId: order.storeId,
      orderId: order.id,
      channel: "RAZORPAY",
      amount: order.totalAmount,
      providerKind: "ORDER",
      providerRef: rpOrder.id
    }
  });

  return { ...rpOrder, key: rp.keyId };
}

/**
 * Called by the customer after Razorpay Checkout returns. The signature (or, failing that,
 * Razorpay's own order status) is checked on the server — the client's word is never trusted.
 */
async function verifyCheckoutPayment(storeId, orderId, input = {}) {
  const prisma = getPrismaClient();
  const order = await prisma.order.findUnique({ where: { id: orderId } });
  if (!order || order.storeId !== storeId) throw createHttpError(404, "Order not found");

  const pending = await prisma.payment.findMany({
    where: { orderId, channel: "RAZORPAY", providerKind: "ORDER", status: { in: ["PENDING", "EXPIRED"] } }
  });

  const signed = input.razorpay_order_id && pending.find(p => p.providerRef === input.razorpay_order_id);
  if (signed) {
    const store = await loadStore(prisma, storeId);
    const rp = await getTenantRazorpay(store.tenantId);
    if (rp && isCheckoutSignatureValid(rp.keySecret, {
      orderId: input.razorpay_order_id,
      paymentId: input.razorpay_payment_id,
      signature: input.razorpay_signature
    })) {
      await markPaymentPaid(signed.id, { providerPaymentId: input.razorpay_payment_id, fromStatuses: ["PENDING", "EXPIRED"] });
    }
  }

  for (const p of pending) await refreshPayment(p, { force: true });

  const fresh = await prisma.order.findUnique({ where: { id: orderId } });
  const paid = Boolean(fresh.paidAt) || fresh.status === "SETTLED";
  return {
    success: paid,
    status: fresh.status,
    message: paid ? "Payment confirmed" : "Payment not received yet"
  };
}

// ─── Razorpay webhook (optional fast path) ───────────────────────────────────

function extractWebhookRefs(payload) {
  const event = payload?.event;
  const p = payload?.payload || {};
  if (event === "qr_code.credited") {
    return { providerRef: p.qr_code?.entity?.id, providerPaymentId: p.payment?.entity?.id };
  }
  if (event === "payment_link.paid") {
    return { providerRef: p.payment_link?.entity?.id, providerPaymentId: p.payment?.entity?.id };
  }
  if (event === "payment.captured" || event === "order.paid") {
    return { providerRef: p.payment?.entity?.order_id || p.order?.entity?.id, providerPaymentId: p.payment?.entity?.id };
  }
  return {};
}

async function handleRazorpayWebhook(tenantId, rawBody, signature) {
  const prisma = getPrismaClient();
  const gateway = await prisma.tenantPaymentGateway.findUnique({
    where: { tenantId_provider: { tenantId, provider: "RAZORPAY" } }
  });
  if (!gateway || !gateway.webhookSecret) {
    throw createHttpError(400, "Webhook secret is not configured for this tenant");
  }
  if (!rawBody || !signature) throw createHttpError(400, "Missing webhook body or signature");

  const { decrypt } = require("../../lib/encryption");
  const Razorpay = require("razorpay");
  if (!Razorpay.validateWebhookSignature(rawBody, signature, decrypt(gateway.webhookSecret))) {
    throw createHttpError(401, "Invalid webhook signature");
  }

  const payload = JSON.parse(rawBody);
  if (String(payload.event || '').startsWith('refund.')) {
    const { handleRefundWebhook } = require("./refund-service");
    return handleRefundWebhook(tenantId, payload);
  }
  const { providerRef, providerPaymentId } = extractWebhookRefs(payload);
  if (!providerRef) return { handled: false, event: payload.event };

  const payment = await prisma.payment.findUnique({
    where: { providerRef },
    include: { store: { select: { tenantId: true } } }
  });
  if (!payment || payment.store.tenantId !== tenantId) return { handled: false, event: payload.event };

  // Money arrived even if staff had withdrawn the QR — record it so nothing goes missing
  await markPaymentPaid(payment.id, { providerPaymentId, fromStatuses: ["PENDING", "EXPIRED", "CANCELLED"] });
  return { handled: true, event: payload.event };
}

// ─── Background reconciliation ───────────────────────────────────────────────

let reconcileTimer = null;

async function reconcilePendingPayments() {
  const prisma = getPrismaClient();
  const pending = await prisma.payment.findMany({
    where: {
      channel: "RAZORPAY",
      status: "PENDING",
      createdAt: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) }
    },
    orderBy: { createdAt: "asc" },
    take: 50
  });
  for (const p of pending) await refreshPayment(p, { force: true });
  const { reconcilePendingRefunds } = require("./refund-service");
  await reconcilePendingRefunds();
  return pending.length;
}

function startPaymentReconciler(intervalMs = 60_000) {
  if (reconcileTimer) return;
  reconcileTimer = setInterval(() => {
    reconcilePendingPayments().catch(error => console.warn("[Payments] reconcile failed:", error.message));
  }, intervalMs);
  if (reconcileTimer.unref) reconcileTimer.unref();
}

function stopPaymentReconciler() {
  if (reconcileTimer) clearInterval(reconcileTimer);
  reconcileTimer = null;
}

/**
 * Cancels pending payments on a bill (used when an order/session is cancelled).
 */
async function cancelPendingPaymentsFor(storeId, ref) {
  const prisma = getPrismaClient();
  const where = { status: "PENDING", ...(ref.orderId ? { orderId: ref.orderId } : { tableSessionId: ref.tableSessionId }) };
  const pending = await prisma.payment.findMany({ where });
  let paidLate = false;
  for (const p of pending) {
    if ((await withdrawPayment(storeId, p)) === "PAID") paidLate = true;
  }
  // The guest paid just before the QR was withdrawn: that money is owed back on a cancelled bill
  if (paidLate) await flagOverpayment(storeId, ref);
}

function isValidUpiId(value) {
  return UPI_ID_PATTERN.test(String(value || "").trim());
}

module.exports = {
  createGuestUpiPayment,
  claimGuestUpiPayment,
  listGuestUpiPayments,
  guestUpiView,
  storeTakesGuestUpi,
  resolveOfflineUpi,
  loadStore,
  putBillOnDues,
  getPaymentChannels,
  getPaymentSummary,
  broadcastSummary,
  createPayment,
  getPayment,
  confirmOfflinePayment,
  cancelPayment,
  createCheckoutForOrder,
  verifyCheckoutPayment,
  handleRazorpayWebhook,
  reconcilePendingPayments,
  startPaymentReconciler,
  stopPaymentReconciler,
  cancelPendingPaymentsFor,
  isValidUpiId
};
