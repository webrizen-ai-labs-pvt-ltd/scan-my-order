const { getPrismaClient } = require("../../lib/prisma");
const { createHttpError } = require("../../middleware/error-handler");
const { verifyStoreAccess } = require("../menu/menu-service");
const { broadcastToStore } = require("../orders/sse-service");
const { getTenantRazorpay, describeRazorpayError } = require("./razorpay-gateway");
const { logOrderEvent } = require("../audit/audit-service");

// A credit note reduces the invoiced amount, but only once the money has really been returned
async function creditNoteForRefund(order, refund, actor) {
  if (refund.status !== "PROCESSED") return;
  const { issueRefundCreditNote } = require("../invoices/invoice-service");
  await issueRefundCreditNote(order, refund, actor).catch(err => console.error("[Invoices] refund credit note failed:", err.message));
}

async function logRefund(actor, order, refund, type = "REFUND_ISSUED") {
  await logOrderEvent({
    storeId: order.storeId,
    orderId: order.id,
    tableSessionId: order.tableSessionId,
    type,
    actor,
    source: actor ? undefined : "SYSTEM",
    reason: refund.reason || refund.failureReason,
    amountBefore: order.refundDue,
    amountAfter: type === "REFUND_FAILED" ? order.refundDue : order.refundDue - refund.amount,
    data: { refundId: refund.id, method: refund.method, amount: refund.amount, status: refund.status, providerRefundId: refund.providerRefundId || null }
  });
}

const REFUND_ROLES = ["CASHIER", "STORE_MANAGER", "TENANT_ADMIN", "SUPER_ADMIN"];
// Sending money back through the gateway is limited to managers
const GATEWAY_REFUND_ROLES = ["STORE_MANAGER", "TENANT_ADMIN", "SUPER_ADMIN"];
// DUES: nothing is handed back; the amount comes off what the dues account owes
const METHODS = ["RAZORPAY", "CASH", "UPI_OFFLINE", "DUES"];

const RAZORPAY_STATUS = { processed: "PROCESSED", pending: "PENDING", failed: "FAILED" };

function serializeRefund(r) {
  return {
    id: r.id,
    orderId: r.orderId,
    paymentId: r.paymentId,
    method: r.method,
    status: r.status,
    amount: r.amount,
    reason: r.reason,
    providerRefundId: r.providerRefundId,
    failureReason: r.failureReason,
    processedBy: r.processedBy ? { id: r.processedBy.id, name: r.processedBy.name } : null,
    processedAt: r.processedAt,
    createdAt: r.createdAt
  };
}

async function loadOrder(prisma, storeId, orderId) {
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    include: { table: true, store: { select: { tenantId: true } } }
  });
  if (!order || order.storeId !== storeId) throw createHttpError(404, "Order not found");
  return order;
}

/**
 * Razorpay payments that paid for this order (directly or via its table bill), with the
 * amount still refundable on each.
 */
async function refundableGatewayPayments(prisma, order) {
  const where = {
    status: "PAID",
    channel: "RAZORPAY",
    providerPaymentId: { not: null },
    OR: [{ orderId: order.id }, ...(order.tableSessionId ? [{ tableSessionId: order.tableSessionId }] : [])]
  };
  const payments = await prisma.payment.findMany({
    where,
    orderBy: { paidAt: "asc" },
    include: { refunds: { where: { status: { in: ["PENDING", "PROCESSED"] } } } }
  });
  return payments
    .map(p => ({
      id: p.id,
      amount: p.amount,
      paidAt: p.paidAt,
      refundable: p.amount - p.refunds.reduce((s, r) => s + r.amount, 0)
    }))
    .filter(p => p.refundable > 0);
}

function broadcastRefund(storeId, order, refund) {
  broadcastToStore(storeId, "REFUND_UPDATED", {
    orderId: order.id,
    refundDue: order.refundDue,
    refund: refund ? serializeRefund(refund) : null
  });
}

/**
 * What the guest is owed and how it can be returned.
 */
async function getRefundOptions(actor, storeId, orderId) {
  if (!REFUND_ROLES.includes(actor.role)) throw createHttpError(403, "Only cashiers and managers can handle refunds");
  await verifyStoreAccess(actor, storeId);
  const prisma = getPrismaClient();
  const order = await loadOrder(prisma, storeId, orderId);
  const { openDuesForOrder } = require("../dues/dues-service");
  const [gatewayPayments, duesBills, refunds] = await Promise.all([
    refundableGatewayPayments(prisma, order),
    openDuesForOrder(prisma, order),
    prisma.refund.findMany({
      where: { orderId },
      orderBy: { createdAt: "desc" },
      include: { processedBy: { select: { id: true, name: true } } }
    })
  ]);
  return {
    orderId,
    tableNumber: order.table?.tableNumber ?? null,
    refundDue: order.refundDue,
    canRefundViaGateway: GATEWAY_REFUND_ROLES.includes(actor.role),
    gatewayPayments,
    duesBills,
    refunds: refunds.map(serializeRefund)
  };
}

/**
 * Takes `amount` off the order's refundDue, only if that much is still owed (no double refunds).
 */
async function reserveRefundDue(prisma, orderId, amount) {
  const result = await prisma.order.updateMany({
    where: { id: orderId, refundDue: { gte: amount } },
    data: { refundDue: { decrement: amount } }
  });
  if (result.count === 0) throw createHttpError(409, "That is more than is still owed on this order");
}

/**
 * Returns money to a guest.
 * - RAZORPAY: refunds through the tenant's Razorpay account against the original payment.
 * - CASH / UPI_OFFLINE: staff hand the money back and record it here.
 */
async function createRefund(actor, storeId, orderId, input = {}) {
  if (!REFUND_ROLES.includes(actor.role)) throw createHttpError(403, "Only cashiers and managers can handle refunds");
  await verifyStoreAccess(actor, storeId);

  const method = input.method;
  if (!METHODS.includes(method)) throw createHttpError(400, `method must be one of ${METHODS.join(", ")}`);
  const amount = Number(input.amount);
  if (!Number.isInteger(amount) || amount <= 0) throw createHttpError(400, "Refund amount must be a whole number of rupees");
  const reason = typeof input.note === "string" ? input.note.trim().slice(0, 200) : "";

  const prisma = getPrismaClient();
  const order = await loadOrder(prisma, storeId, orderId);
  if (amount > order.refundDue) {
    throw createHttpError(400, `Only ₹${order.refundDue} is owed on this order`);
  }

  // Reduce dues: lower what is owed on the order's dues bill (or its table bill's) instead of paying out
  let duesPaymentId = null;
  if (method === "DUES") {
    const { openDuesForOrder, reduceDuesBill } = require("../dues/dues-service");
    const bills = await openDuesForOrder(prisma, order);
    const bill = bills.find(b => b.id === input.paymentId) || (input.paymentId ? null : bills[0]);
    if (!bill) throw createHttpError(400, "This order has no dues left to reduce");
    if (amount > bill.outstanding) throw createHttpError(400, `Only ₹${bill.outstanding} is still owed on those dues`);
    await reserveRefundDue(prisma, orderId, amount);
    try {
      await reduceDuesBill(prisma, bill.id, amount);
    } catch (error) {
      await prisma.order.update({ where: { id: orderId }, data: { refundDue: { increment: amount } } });
      throw error;
    }
    duesPaymentId = bill.id;
  }

  if (method !== "RAZORPAY") {
    if (method !== "DUES") await reserveRefundDue(prisma, orderId, amount);
    const refund = await prisma.refund.create({
      data: {
        storeId,
        orderId,
        paymentId: duesPaymentId,
        method,
        status: "PROCESSED",
        amount,
        reason: reason || "Kitchen could not make paid items",
        processedById: actor.id,
        processedAt: new Date()
      },
      include: { processedBy: { select: { id: true, name: true } } }
    });
    broadcastRefund(storeId, { ...order, refundDue: order.refundDue - amount }, refund);
    await logRefund(actor, order, refund);
    await creditNoteForRefund(order, refund, actor);
    return getRefundOptions(actor, storeId, orderId);
  }

  if (!GATEWAY_REFUND_ROLES.includes(actor.role)) {
    throw createHttpError(403, "Only managers can send refunds through Razorpay");
  }
  const gatewayPayments = await refundableGatewayPayments(prisma, order);
  const source = gatewayPayments.find(p => p.id === input.paymentId) || (input.paymentId ? null : gatewayPayments[0]);
  if (!source) throw createHttpError(400, "No Razorpay payment on this order can be refunded");
  if (amount > source.refundable) {
    throw createHttpError(400, `Only ₹${source.refundable} of that Razorpay payment can still be refunded`);
  }
  const payment = await prisma.payment.findUnique({ where: { id: source.id } });
  const rp = await getTenantRazorpay(order.store.tenantId);
  if (!rp) throw createHttpError(400, "Razorpay keys are not set up for this brand");

  await reserveRefundDue(prisma, orderId, amount);
  let refund = await prisma.refund.create({
    data: {
      storeId,
      orderId,
      paymentId: payment.id,
      method: "RAZORPAY",
      status: "PENDING",
      amount,
      reason: reason || "Kitchen could not make paid items",
      processedById: actor.id
    }
  });

  try {
    const rpRefund = await rp.client.payments.refund(payment.providerPaymentId, {
      amount: amount * 100,
      speed: "normal",
      receipt: refund.id,
      notes: { order_id: orderId, smo_refund_id: refund.id, reason: (reason || "Items not served").slice(0, 200) }
    });
    const status = RAZORPAY_STATUS[rpRefund.status] || "PENDING";
    refund = await prisma.refund.update({
      where: { id: refund.id },
      data: {
        providerRefundId: rpRefund.id,
        status,
        processedAt: status === "PROCESSED" ? new Date() : null
      },
      include: { processedBy: { select: { id: true, name: true } } }
    });
  } catch (error) {
    const message = describeRazorpayError(error);
    await prisma.$transaction([
      prisma.refund.update({ where: { id: refund.id }, data: { status: "FAILED", failureReason: message } }),
      prisma.order.update({ where: { id: orderId }, data: { refundDue: { increment: amount } } })
    ]);
    throw createHttpError(502, `Razorpay could not process the refund: ${message}`);
  }

  broadcastRefund(storeId, { ...order, refundDue: order.refundDue - amount }, refund);
  await logRefund(actor, order, refund);
  await creditNoteForRefund(order, refund, actor);
  return getRefundOptions(actor, storeId, orderId);
}

/**
 * Applies a Razorpay refund status (from polling or a webhook). A failed refund
 * puts the amount back on the order's refundDue so staff can retry another way.
 */
async function applyGatewayRefundStatus(refund, razorpayStatus, failureReason = null) {
  const status = RAZORPAY_STATUS[razorpayStatus];
  if (!status || status === refund.status || refund.status !== "PENDING") return false;
  const prisma = getPrismaClient();
  const updated = await prisma.refund.updateMany({
    where: { id: refund.id, status: "PENDING" },
    data: {
      status,
      processedAt: status === "PROCESSED" ? new Date() : null,
      failureReason: status === "FAILED" ? (failureReason || "Refund failed at Razorpay") : null
    }
  });
  if (updated.count === 0) return false;
  if (status === "FAILED") {
    const failedOrder = await prisma.order.findUnique({ where: { id: refund.orderId } });
    if (failedOrder) await logRefund(null, failedOrder, { ...refund, status, failureReason }, "REFUND_FAILED");
    await prisma.order.update({ where: { id: refund.orderId }, data: { refundDue: { increment: refund.amount } } });
  }
  const order = await prisma.order.findUnique({ where: { id: refund.orderId } });
  broadcastRefund(refund.storeId, order, { ...refund, status });
  if (status === "PROCESSED") await creditNoteForRefund(order, { ...refund, status }, null);
  return true;
}

async function reconcilePendingRefunds() {
  const prisma = getPrismaClient();
  const pending = await prisma.refund.findMany({
    where: { method: "RAZORPAY", status: "PENDING", providerRefundId: { not: null } },
    include: { store: { select: { tenantId: true } } },
    take: 50
  });
  for (const refund of pending) {
    try {
      const rp = await getTenantRazorpay(refund.store.tenantId);
      if (!rp) continue;
      const remote = await rp.client.refunds.fetch(refund.providerRefundId);
      await applyGatewayRefundStatus(refund, remote.status, remote.error_description || null);
    } catch (error) {
      console.warn(`[Refunds] status check failed for ${refund.id}:`, describeRazorpayError(error));
    }
  }
  return pending.length;
}

/**
 * Razorpay webhook: refund.processed / refund.failed
 */
async function handleRefundWebhook(tenantId, payload) {
  const entity = payload?.payload?.refund?.entity;
  if (!entity?.id) return { handled: false };
  const prisma = getPrismaClient();
  const refund = await prisma.refund.findUnique({
    where: { providerRefundId: entity.id },
    include: { store: { select: { tenantId: true } } }
  });
  if (!refund || refund.store.tenantId !== tenantId) return { handled: false };
  await applyGatewayRefundStatus(refund, entity.status, entity.error_description || null);
  return { handled: true, event: payload.event };
}

module.exports = {
  getRefundOptions,
  createRefund,
  reconcilePendingRefunds,
  handleRefundWebhook
};
