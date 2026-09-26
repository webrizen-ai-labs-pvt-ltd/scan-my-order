const { getPrismaClient } = require("../../lib/prisma");
const { createHttpError } = require("../../middleware/error-handler");
const { verifyStoreAccess } = require("../menu/menu-service");
const { userRoles } = require("../../constants/roles");
const { broadcastToStore } = require("../orders/sse-service");
const { invalidateTablesCache } = require("../../lib/cache");
const { buildUpiIntent, UPI_ID_PATTERN } = require("@smo/shared/pricing");
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
// Don't hammer Razorpay when several screens poll the same payment
const REFRESH_THROTTLE_MS = 3000;
const lastRefreshAt = new Map();

// Lazy to avoid a require cycle with order-service
const orderService = () => require("../orders/order-service");
const { logOrderEvent } = require("../audit/audit-service");
const CHANNEL_LABEL = { RAZORPAY: "Razorpay", UPI_OFFLINE: "UPI (own QR)", CASH: "Cash" };

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
    paidAt: p.paidAt,
    expiresAt: p.expiresAt,
    createdAt: p.createdAt
  };
}

const paymentInclude = {
  orderBy: { createdAt: "asc" },
  include: { collectedBy: { select: { id: true, name: true } } }
};

/**
 * Resolves what is being paid for: a single order or a whole table session.
 * The total is always computed on the server from the orders themselves.
 */
async function loadTarget(prisma, storeId, ref) {
  if (ref.orderId) {
    const order = await prisma.order.findUnique({
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
      onlineAmount: tender.onlineAmount
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
  if (target.isSettled || target.isCancelled) return summarize(target);

  const paid = target.payments.filter(p => p.status === "PAID");
  const paidAmount = paid.reduce((s, p) => s + p.amount, 0);
  if (paidAmount < target.totalAmount) return summarize(target);

  // Bill is covered: withdraw any QR still waiting so the guest can't pay twice
  const stillPending = target.payments.filter(p => p.status === "PENDING");
  for (const p of stillPending) {
    await withdrawPayment(storeId, p);
  }

  const cashAmount = paid.filter(p => p.channel === "CASH").reduce((s, p) => s + p.amount, 0);
  const onlineAmount = paidAmount - cashAmount;
  const paymentMethod = cashAmount > 0 && onlineAmount > 0 ? "SPLIT" : cashAmount > 0 ? "CASH" : "ONLINE";

  await logOrderEvent({
    storeId,
    orderId: target.kind === "ORDER" ? target.id : null,
    tableSessionId: target.kind === "TABLE_SESSION" ? target.id : null,
    type: "BILL_SETTLED",
    source: "SYSTEM",
    amountAfter: target.totalAmount,
    data: { paymentMethod, cashAmount, onlineAmount, orders: target.orders.map(o => o.id) }
  });

  if (target.kind === "ORDER") {
    await markOrderPaid(storeId, target.orders[0], { paymentMethod, cashAmount, onlineAmount });
  } else {
    const cashShares = allocate(cashAmount, target.orders);
    const onlineShares = allocate(onlineAmount, target.orders);
    for (let i = 0; i < target.orders.length; i++) {
      const cash = cashShares[i];
      const online = onlineShares[i];
      await markOrderPaid(storeId, target.orders[i], {
        paymentMethod: cash > 0 && online > 0 ? "SPLIT" : cash > 0 ? "CASH" : "ONLINE",
        cashAmount: cash,
        onlineAmount: online
      });
    }

    const session = await prisma.tableSession.update({
      where: { id: target.id },
      data: { status: "SETTLED", paymentMethod, cashAmount, onlineAmount },
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

  return broadcastSummary(storeId, ref);
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

async function getPaymentSummary(actor, storeId, ref) {
  assertCanCollect(actor);
  await verifyStoreAccess(actor, storeId);
  const prisma = getPrismaClient();

  let target = await loadTarget(prisma, storeId, ref);
  if (await refreshPendingForTarget(target)) {
    target = await loadTarget(prisma, storeId, ref);
  }

  const store = await loadStore(prisma, storeId);
  const rp = await getTenantRazorpay(store.tenantId);
  const qrStatus = rp ? await getQrCodesStatus(store.tenantId, rp) : null;
  const offlineUpi = resolveOfflineUpi(store);

  return {
    ...summarize(target),
    channels: {
      RAZORPAY: {
        enabled: Boolean(rp && qrStatus?.enabled),
        reason: !rp ? 'Razorpay keys are not set up for this brand.' : qrStatus?.reason || null
      },
      UPI_OFFLINE: { enabled: Boolean(offlineUpi), vpa: offlineUpi?.vpa || null, payeeName: offlineUpi?.payeeName || null },
      CASH: { enabled: true }
    }
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
  if (payment.status !== "PENDING") throw createHttpError(409, `Payment is already ${payment.status.toLowerCase()}`);

  await markPaymentPaid(payment.id, { collectedById: actor.id });
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
  if (payment.status !== "PENDING") throw createHttpError(409, `Payment is already ${payment.status.toLowerCase()}`);

  const outcome = await withdrawPayment(storeId, payment);
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
  for (const p of pending) await withdrawPayment(storeId, p);
}

function isValidUpiId(value) {
  return UPI_ID_PATTERN.test(String(value || "").trim());
}

module.exports = {
  getPaymentSummary,
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
