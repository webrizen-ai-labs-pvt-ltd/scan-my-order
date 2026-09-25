const crypto = require("crypto");
const Razorpay = require("razorpay");
const { getPrismaClient } = require("../../lib/prisma");
const { decrypt } = require("../../lib/encryption");
const { createHttpError } = require("../../middleware/error-handler");

// Razorpay rejects close_by values less than ~2 minutes out; keep QRs alive long enough to scan and pay.
const QR_LIFETIME_MS = 15 * 60 * 1000;

async function loadGateway(tenantId) {
  const gateway = await getPrismaClient().tenantPaymentGateway.findUnique({
    where: { tenantId_provider: { tenantId, provider: "RAZORPAY" } }
  });
  if (!gateway || !gateway.isActive) return null;
  return gateway;
}

/**
 * Returns an authenticated Razorpay client for the tenant (BYOAK), or null when not configured.
 */
async function getTenantRazorpay(tenantId) {
  const gateway = await loadGateway(tenantId);
  if (!gateway) return null;
  const keyId = decrypt(gateway.apiKey);
  const keySecret = decrypt(gateway.secretKey);
  return {
    gateway,
    keyId,
    keySecret,
    client: new Razorpay({ key_id: keyId, key_secret: keySecret })
  };
}

async function requireTenantRazorpay(tenantId) {
  const rp = await getTenantRazorpay(tenantId);
  if (!rp) {
    throw createHttpError(400, "Online payments are not set up. Ask the brand owner to add Razorpay keys under Subscriptions → Payment Gateway.");
  }
  return rp;
}

function describeRazorpayError(error) {
  return error?.error?.description || error?.description || error?.message || "Unknown Razorpay error";
}

const QR_DISABLED_MESSAGE = "Razorpay QR Codes is not enabled on this account. Ask Razorpay support (or Dashboard → Payment Products) to activate \"QR Codes\" for your account — use \"UPI (own QR)\" or cash until then.";
// Re-check "not enabled" quickly so activating QR Codes in Razorpay shows up within a minute
const QR_ENABLED_TTL_MS = 5 * 60 * 1000;
const QR_DISABLED_TTL_MS = 30 * 1000;
const qrStatusCache = new Map(); // tenantId -> { enabled, reason, at }

function isFeatureNotEnabled(error) {
  const text = describeRazorpayError(error).toLowerCase();
  return error?.statusCode === 404 || (error?.statusCode === 400 && text.includes('requested url was not found'));
}

/**
 * Whether the tenant's Razorpay account can create UPI QR codes. Read-only probe, cached.
 * @returns {Promise<{enabled: boolean, reason: string|null}>}
 */
async function getQrCodesStatus(tenantId, rp, { fresh = false } = {}) {
  const cached = qrStatusCache.get(tenantId);
  const ttl = cached?.enabled ? QR_ENABLED_TTL_MS : QR_DISABLED_TTL_MS;
  if (!fresh && cached && Date.now() - cached.at < ttl) return cached;

  let status;
  try {
    await rp.client.qrCode.all({ count: 1 });
    status = { enabled: true, reason: null };
  } catch (error) {
    status = isFeatureNotEnabled(error)
      ? { enabled: false, reason: QR_DISABLED_MESSAGE }
      : { enabled: false, reason: `Razorpay rejected the request: ${describeRazorpayError(error)}` };
  }
  status.at = Date.now();
  qrStatusCache.set(tenantId, status);
  return status;
}

/**
 * Creates a single-use, fixed-amount UPI QR for a Payment row.
 * No silent fallback: if QR Codes isn't available the caller gets the real reason.
 */
async function createCollection(rp, { tenantId, paymentId, amount, description, notes }) {
  const closeBy = Math.floor((Date.now() + QR_LIFETIME_MS) / 1000);
  try {
    const qr = await rp.client.qrCode.create({
      type: "upi_qr",
      name: description.slice(0, 40),
      usage: "single_use",
      fixed_amount: true,
      payment_amount: amount * 100,
      description,
      close_by: closeBy,
      notes: { ...notes, smo_payment_id: paymentId }
    });
    qrStatusCache.set(tenantId, { enabled: true, reason: null, at: Date.now() });
    return {
      providerKind: "QR_CODE",
      providerRef: qr.id,
      qrImageUrl: qr.image_url || null,
      qrPayload: qr.image_content || null,
      expiresAt: new Date(closeBy * 1000)
    };
  } catch (error) {
    if (isFeatureNotEnabled(error)) {
      qrStatusCache.set(tenantId, { enabled: false, reason: QR_DISABLED_MESSAGE, at: Date.now() });
      throw createHttpError(409, QR_DISABLED_MESSAGE);
    }
    throw createHttpError(502, `Razorpay could not create the UPI QR: ${describeRazorpayError(error)}`);
  }
}

/**
 * Asks Razorpay whether a collection has been paid.
 * @returns {Promise<{paid: boolean, providerPaymentId?: string, closed?: boolean}>}
 */
async function fetchCollectionStatus(rp, payment) {
  if (payment.providerKind === "QR_CODE") {
    const qr = await rp.client.qrCode.fetch(payment.providerRef);
    const receivedPaise = Number(qr.payments_amount_received) || 0;
    if (receivedPaise >= payment.amount * 100) {
      const list = await rp.client.qrCode.fetchAllPayments(payment.providerRef);
      const captured = (list?.items || []).find(p => p.status === "captured");
      return { paid: true, providerPaymentId: captured?.id };
    }
    return { paid: false, closed: qr.status === "closed" };
  }

  if (payment.providerKind === "PAYMENT_LINK") {
    const link = await rp.client.paymentLink.fetch(payment.providerRef);
    if (link.status === "paid") {
      const captured = (link.payments || []).find(p => p.status === "captured");
      return { paid: true, providerPaymentId: captured?.payment_id };
    }
    return { paid: false, closed: ["expired", "cancelled"].includes(link.status) };
  }

  if (payment.providerKind === "ORDER") {
    const order = await rp.client.orders.fetch(payment.providerRef);
    if (order.status === "paid") {
      const list = await rp.client.orders.fetchPayments(payment.providerRef);
      const captured = (list?.items || []).find(p => p.status === "captured");
      return { paid: true, providerPaymentId: captured?.id };
    }
    return { paid: false };
  }

  return { paid: false };
}

async function closeCollection(rp, payment) {
  try {
    if (payment.providerKind === "QR_CODE") await rp.client.qrCode.close(payment.providerRef);
    else if (payment.providerKind === "PAYMENT_LINK") await rp.client.paymentLink.cancel(payment.providerRef);
  } catch (error) {
    // Already closed/paid/expired — the caller re-checks status before trusting this
    console.warn("[Razorpay] close collection:", describeRazorpayError(error));
  }
}

/**
 * Standard Checkout signature: HMAC_SHA256(order_id + "|" + payment_id, key_secret)
 */
function isCheckoutSignatureValid(keySecret, { orderId, paymentId, signature }) {
  if (!orderId || !paymentId || !signature) return false;
  const expected = crypto.createHmac("sha256", keySecret).update(`${orderId}|${paymentId}`).digest("hex");
  const a = Buffer.from(expected);
  const b = Buffer.from(String(signature));
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

module.exports = {
  getQrCodesStatus,
  getTenantRazorpay,
  requireTenantRazorpay,
  createCollection,
  fetchCollectionStatus,
  closeCollection,
  isCheckoutSignatureValid,
  describeRazorpayError
};
