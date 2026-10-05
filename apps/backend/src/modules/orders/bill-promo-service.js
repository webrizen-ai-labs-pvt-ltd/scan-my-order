const { getPrismaClient } = require("../../lib/prisma");
const { createHttpError } = require("../../middleware/error-handler");
const { verifyStoreAccess } = require("../menu/menu-service");
const { userRoles } = require("../../constants/roles");
const { computeOrderTotals, computePromoDiscount } = require("@smo/shared/pricing");
const { logOrderEvent } = require("../audit/audit-service");
const { broadcastToStore } = require("./sse-service");

/**
 * Promo codes added at checkout, to a bill that doesn't have one yet.
 *
 * - A single order: priced exactly as if the code had been entered when it was placed.
 * - A table bill: the code is checked against the whole unpaid bill (minimum order, max discount)
 *   and the discount is split across the table's unpaid orders in proportion to their subtotals.
 *   It is remembered on the session, so the split is redone when the table's orders change.
 *
 * Only before any payment is taken: a QR or part-payment already shows the old amount.
 */

// Waiters too (their bill sheet); every change is in the order's activity log with their name
const PROMO_ROLES = [userRoles.superAdmin, userRoles.tenantAdmin, userRoles.storeManager, userRoles.cashier, userRoles.waiter];

const OPEN_PAYMENT = { status: { in: ["PAID", "PENDING"] } };

function assertCanChangePromo(actor) {
  if (!PROMO_ROLES.includes(actor?.role)) {
    throw createHttpError(403, "Only staff serving or billing can change promo codes");
  }
}

async function findUsablePromo(prisma, storeId, code) {
  const clean = String(code || "").trim().toUpperCase();
  if (!clean) throw createHttpError(400, "Enter a promo code");
  const promo = await prisma.promoCode.findUnique({ where: { storeId_code: { storeId, code: clean } } });
  if (!promo || !promo.isActive || (promo.validUntil && promo.validUntil <= new Date())) {
    throw createHttpError(400, "Invalid or expired promo code");
  }
  return promo;
}

async function assertStackingAllowed(prisma, storeId, orders) {
  if (!orders.some(o => (o.walletDiscount || 0) > 0)) return;
  const store = await prisma.store.findUnique({ where: { id: storeId }, select: { loyaltyRules: true } });
  const raw = typeof store?.loyaltyRules === "string" ? JSON.parse(store.loyaltyRules) : (store?.loyaltyRules || {});
  if (raw.allowPromoStacking === false) {
    throw createHttpError(400, "This bill used store credits, and this store doesn't combine credits with promo codes.");
  }
}

/** New totals for an order with a fixed discount (tax at the rates it was placed with) */
function priceOrder(order, storeTaxRules, discount) {
  const taxRules = Array.isArray(order.taxRules) ? order.taxRules : (Array.isArray(storeTaxRules) ? storeTaxRules : []);
  return computeOrderTotals({
    subTotal: order.subTotal,
    promo: discount > 0 ? { discountType: "FLAT", discountValue: discount } : null,
    walletDiscount: order.walletDiscount,
    taxRules
  });
}

/** Splits a discount across orders by subtotal; whole rupees, the remainder goes to the largest */
function splitDiscount(discount, orders) {
  const total = orders.reduce((s, o) => s + o.subTotal, 0);
  if (total <= 0) return orders.map(() => 0);
  const shares = orders.map(o => Math.floor((discount * o.subTotal) / total));
  let rest = discount - shares.reduce((s, x) => s + x, 0);
  const bySize = orders.map((o, i) => i).sort((a, b) => orders[b].subTotal - orders[a].subTotal);
  for (let k = 0; rest > 0; k = (k + 1) % bySize.length, rest--) shares[bySize[k]] += 1;
  return shares;
}

/** Writes new totals; store credits that no longer fit the bill go back to the guest */
async function saveOrderTotals(tx, order, totals, promoCodeId) {
  await tx.order.update({
    where: { id: order.id },
    data: {
      promoCodeId,
      discountAmount: totals.discountAmount,
      walletDiscount: totals.walletDiscount,
      taxAmount: totals.taxAmount,
      totalAmount: totals.totalAmount
    }
  });
  const walletRefund = Math.max(0, (order.walletDiscount || 0) - totals.walletDiscount);
  if (walletRefund > 0 && order.customerId) {
    const { refundWalletCredits } = require("../loyalty/loyalty-service");
    await refundWalletCredits(tx, {
      customerId: order.customerId,
      storeId: order.storeId,
      orderId: order.id,
      amount: walletRefund,
      description: `Credits returned: promo applied to Order #${order.id.slice(-6).toUpperCase()}`
    });
  }
}

/** The orders a table bill is made of: not cancelled, settled or paid on their own */
async function loadTableBillOrders(db, tableSessionId) {
  const orders = await db.order.findMany({
    where: { tableSessionId, status: { notIn: ["CANCELLED", "SETTLED"] }, paidAt: null },
    orderBy: { createdAt: "asc" }
  });
  return orders;
}

async function announce(storeId, ref, orderIds) {
  for (const id of orderIds) broadcastToStore(storeId, "ORDER_UPDATED", { id });
  const { broadcastSummary } = require("../payments/payment-service");
  await broadcastSummary(storeId, ref);
}

/* ---------- apply ---------- */

/**
 * @param {{ orderId?: string, tableSessionId?: string, code: string }} input
 */
async function applyBillPromo(actor, storeId, input = {}) {
  await verifyStoreAccess(actor, storeId);
  assertCanChangePromo(actor);
  const prisma = getPrismaClient();
  const promo = await findUsablePromo(prisma, storeId, input.code);
  const store = await prisma.store.findUnique({ where: { id: storeId }, select: { taxRules: true } });

  if (input.orderId) {
    const order = await prisma.order.findUnique({
      where: { id: input.orderId },
      include: { tableSession: { select: { promoCodeId: true } }, _count: { select: { payments: { where: OPEN_PAYMENT } } } }
    });
    if (!order || order.storeId !== storeId) throw createHttpError(404, "Order not found");
    if (order.paidAt || ["SETTLED", "CANCELLED"].includes(order.status)) throw createHttpError(409, "This bill is already closed");
    if (order.promoCodeId) throw createHttpError(409, "This order already has a promo code");
    if (order.tableSession?.promoCodeId) throw createHttpError(409, "This table's bill already has a promo code");
    if (order._count.payments > 0) throw createHttpError(409, "A payment has already been started on this bill, so a promo code can't be added now");
    if (order.subTotal < promo.minOrderValue) throw createHttpError(400, `This code needs a minimum order of ₹${promo.minOrderValue}`);
    await assertStackingAllowed(prisma, storeId, [order]);

    const totals = priceOrder(order, store.taxRules, computePromoDiscount(order.subTotal, promo));
    await prisma.$transaction(async (tx) => {
      // Only if nobody applied a code or took payment meanwhile
      const claim = await tx.order.updateMany({ where: { id: order.id, promoCodeId: null, paidAt: null }, data: { promoCodeId: promo.id } });
      if (claim.count === 0) throw createHttpError(409, "This bill just changed. Please try again.");
      await saveOrderTotals(tx, order, totals, promo.id);
    });

    await logOrderEvent({
      storeId, orderId: order.id, type: "PROMO_APPLIED", actor,
      amountBefore: order.totalAmount, amountAfter: totals.totalAmount,
      data: { code: promo.code, discount: totals.discountAmount }
    });
    await announce(storeId, { orderId: order.id }, [order.id]);
    return { code: promo.code, discountAmount: totals.discountAmount, totalAmount: totals.totalAmount };
  }

  if (input.tableSessionId) {
    const session = await prisma.tableSession.findUnique({
      where: { id: input.tableSessionId },
      include: { _count: { select: { payments: { where: OPEN_PAYMENT } } } }
    });
    if (!session || session.storeId !== storeId) throw createHttpError(404, "Table session not found");
    if (session.status !== "ACTIVE") throw createHttpError(409, "This bill is already closed");
    if (session.promoCodeId) throw createHttpError(409, "This table's bill already has a promo code");
    if (session._count.payments > 0) throw createHttpError(409, "A payment has already been started on this bill, so a promo code can't be added now");

    const orders = await loadTableBillOrders(prisma, session.id);
    if (orders.length === 0) throw createHttpError(409, "There's nothing unpaid on this table");
    if (orders.some(o => o.promoCodeId)) throw createHttpError(409, "An order on this table already has a promo code");
    const orderPayments = await prisma.payment.count({ where: { orderId: { in: orders.map(o => o.id) }, ...OPEN_PAYMENT } });
    if (orderPayments > 0) throw createHttpError(409, "A payment has already been started on this bill, so a promo code can't be added now");

    const subTotal = orders.reduce((s, o) => s + o.subTotal, 0);
    if (subTotal < promo.minOrderValue) throw createHttpError(400, `This code needs a minimum order of ₹${promo.minOrderValue}`);
    await assertStackingAllowed(prisma, storeId, orders);

    const discount = computePromoDiscount(subTotal, promo);
    const shares = splitDiscount(discount, orders);
    const before = orders.reduce((s, o) => s + o.totalAmount, 0);
    let after = 0;
    await prisma.$transaction(async (tx) => {
      const claim = await tx.tableSession.updateMany({ where: { id: session.id, status: "ACTIVE", promoCodeId: null }, data: { promoCodeId: promo.id } });
      if (claim.count === 0) throw createHttpError(409, "This bill just changed. Please try again.");
      for (let i = 0; i < orders.length; i++) {
        const totals = priceOrder(orders[i], store.taxRules, shares[i]);
        after += totals.totalAmount;
        await saveOrderTotals(tx, orders[i], totals, promo.id);
      }
    }, { timeout: 20000 });

    await logOrderEvent({
      storeId, tableSessionId: session.id, type: "PROMO_APPLIED", actor,
      amountBefore: before, amountAfter: after,
      data: { code: promo.code, discount, orders: orders.map(o => o.id) }
    });
    await announce(storeId, { tableSessionId: session.id }, orders.map(o => o.id));
    return { code: promo.code, discountAmount: discount, totalAmount: after };
  }

  throw createHttpError(400, "orderId or tableSessionId is required");
}

/* ---------- remove ---------- */

/** Takes a promo off a bill that hasn't been paid yet */
async function removeBillPromo(actor, storeId, input = {}) {
  await verifyStoreAccess(actor, storeId);
  assertCanChangePromo(actor);
  const prisma = getPrismaClient();
  const store = await prisma.store.findUnique({ where: { id: storeId }, select: { taxRules: true } });

  if (input.orderId) {
    const order = await prisma.order.findUnique({
      where: { id: input.orderId },
      include: { promoCode: true, tableSession: { select: { promoCodeId: true } }, _count: { select: { payments: { where: OPEN_PAYMENT } } } }
    });
    if (!order || order.storeId !== storeId) throw createHttpError(404, "Order not found");
    if (!order.promoCodeId) return { removed: false };
    if (order.paidAt || ["SETTLED", "CANCELLED"].includes(order.status)) throw createHttpError(409, "This bill is already closed");
    if (order.tableSession?.promoCodeId) throw createHttpError(409, "This code is on the whole table bill. Remove it from the table checkout.");
    if (order._count.payments > 0) throw createHttpError(409, "A payment has already been started on this bill");

    const totals = priceOrder(order, store.taxRules, 0);
    await prisma.$transaction((tx) => saveOrderTotals(tx, order, totals, null));
    await logOrderEvent({
      storeId, orderId: order.id, type: "PROMO_REMOVED", actor,
      amountBefore: order.totalAmount, amountAfter: totals.totalAmount, data: { code: order.promoCode?.code }
    });
    await announce(storeId, { orderId: order.id }, [order.id]);
    return { removed: true, totalAmount: totals.totalAmount };
  }

  if (input.tableSessionId) {
    const session = await prisma.tableSession.findUnique({
      where: { id: input.tableSessionId },
      include: { promoCode: true, _count: { select: { payments: { where: OPEN_PAYMENT } } } }
    });
    if (!session || session.storeId !== storeId) throw createHttpError(404, "Table session not found");
    if (!session.promoCodeId) return { removed: false };
    if (session.status !== "ACTIVE") throw createHttpError(409, "This bill is already closed");
    if (session._count.payments > 0) throw createHttpError(409, "A payment has already been started on this bill");

    const orders = (await loadTableBillOrders(prisma, session.id)).filter(o => o.promoCodeId === session.promoCodeId);
    const before = orders.reduce((s, o) => s + o.totalAmount, 0);
    let after = 0;
    await prisma.$transaction(async (tx) => {
      await tx.tableSession.update({ where: { id: session.id }, data: { promoCodeId: null } });
      for (const order of orders) {
        const totals = priceOrder(order, store.taxRules, 0);
        after += totals.totalAmount;
        await saveOrderTotals(tx, order, totals, null);
      }
    }, { timeout: 20000 });
    await logOrderEvent({
      storeId, tableSessionId: session.id, type: "PROMO_REMOVED", actor,
      amountBefore: before, amountAfter: after, data: { code: session.promoCode?.code }
    });
    await announce(storeId, { tableSessionId: session.id }, orders.map(o => o.id));
    return { removed: true, totalAmount: after };
  }

  throw createHttpError(400, "orderId or tableSessionId is required");
}

/* ---------- keeping a table-wide promo right ---------- */

/**
 * Re-splits a table-wide promo after the table's orders changed (new order, edit, rejection,
 * cancel). If the bill no longer meets the code's minimum, the code comes off. No-op otherwise.
 */
async function syncTablePromo(tableSessionId) {
  if (!tableSessionId) return;
  const prisma = getPrismaClient();
  try {
    const session = await prisma.tableSession.findUnique({ where: { id: tableSessionId }, include: { promoCode: true } });
    if (!session?.promoCodeId || session.status !== "ACTIVE") return;
    const store = await prisma.store.findUnique({ where: { id: session.storeId }, select: { taxRules: true } });
    const orders = await loadTableBillOrders(prisma, session.id);
    // Orders being paid on their own keep the amount their payment shows (still counted in the split)
    const locked = new Set((await prisma.payment.findMany({
      where: { orderId: { in: orders.map(o => o.id) }, ...OPEN_PAYMENT },
      select: { orderId: true }
    })).map(p => p.orderId));
    const subTotal = orders.reduce((s, o) => s + o.subTotal, 0);
    const promo = session.promoCode;
    const stillValid = promo && subTotal >= (promo.minOrderValue || 0) && subTotal > 0;
    const shares = stillValid ? splitDiscount(computePromoDiscount(subTotal, promo), orders) : orders.map(() => 0);

    const changed = [];
    await prisma.$transaction(async (tx) => {
      if (!stillValid) await tx.tableSession.update({ where: { id: session.id }, data: { promoCodeId: null } });
      for (let i = 0; i < orders.length; i++) {
        const order = orders[i];
        if (locked.has(order.id)) continue;
        const promoCodeId = stillValid ? session.promoCodeId : null;
        const totals = priceOrder(order, store.taxRules, shares[i]);
        if (order.promoCodeId === promoCodeId && order.discountAmount === totals.discountAmount && order.totalAmount === totals.totalAmount) continue;
        await saveOrderTotals(tx, order, totals, promoCodeId);
        changed.push(order.id);
      }
    }, { timeout: 20000 });

    if (!stillValid) {
      await logOrderEvent({
        storeId: session.storeId, tableSessionId: session.id, type: "PROMO_REMOVED", source: "SYSTEM",
        reason: "The table bill no longer meets the code's minimum order", data: { code: promo?.code }
      });
    }
    if (changed.length > 0) await announce(session.storeId, { tableSessionId: session.id }, changed);
  } catch (err) {
    console.error("[Promo] table promo re-split failed:", err.message);
  }
}

module.exports = {
  applyBillPromo,
  removeBillPromo,
  syncTablePromo,
  splitDiscount
};
