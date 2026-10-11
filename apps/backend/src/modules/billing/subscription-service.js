const crypto = require("crypto");
const axios = require("axios");
const { cleanFeatureKeys, TRIAL_DAYS } = require("@smo/shared/plans");
const { getPrismaClient } = require("../../lib/prisma");
const { createHttpError } = require("../../middleware/error-handler");
const { env } = require("../../config/env");
const { getEntitlements, invalidateEntitlements, trialPlan, addDays } = require("./entitlements-service");

const INTERVALS = ["MONTHLY", "YEARLY"];

/** The end of one billing period that starts at `from` */
function periodEndFrom(from, interval) {
  const end = new Date(from);
  if (interval === "YEARLY") end.setFullYear(end.getFullYear() + 1);
  else end.setMonth(end.getMonth() + 1);
  return end;
}

// --- Plans (super admin) ---

function planData(input, { partial = false } = {}) {
  const data = {};
  if (input.name !== undefined || !partial) {
    const name = String(input.name || "").trim();
    if (name.length < 2) throw createHttpError(400, "Give the plan a name");
    data.name = name.slice(0, 60);
  }
  if (input.price !== undefined || !partial) {
    const price = Number(input.price);
    if (!Number.isInteger(price) || price < 0) throw createHttpError(400, "The price must be a whole number of rupees");
    data.price = price;
  }
  if (input.maxStores !== undefined || !partial) {
    const maxStores = Number(input.maxStores);
    if (!Number.isInteger(maxStores) || maxStores < 1) throw createHttpError(400, "A plan must allow at least 1 store");
    data.maxStores = maxStores;
  }
  if (input.interval !== undefined || !partial) {
    if (!INTERVALS.includes(input.interval)) throw createHttpError(400, "Billing must be MONTHLY or YEARLY");
    data.interval = input.interval;
  }
  if (input.features !== undefined) data.features = cleanFeatureKeys(input.features);
  if (input.description !== undefined) data.description = String(input.description || "").trim().slice(0, 140) || null;
  if (input.sortOrder !== undefined) data.sortOrder = Number.isInteger(Number(input.sortOrder)) ? Number(input.sortOrder) : 0;
  if (typeof input.isActive === "boolean") data.isActive = input.isActive;
  return data;
}

async function invalidatePlanTenants(planId) {
  const subs = await getPrismaClient().tenantSubscription.findMany({ where: { planId }, select: { tenantId: true } });
  subs.forEach(s => invalidateEntitlements(s.tenantId));
}

async function createPlan(input) {
  return getPrismaClient().subscriptionPlan.create({ data: { currency: "INR", isActive: true, ...planData(input) } });
}

/**
 * Plans for pricing screens. Tenants see the ones on sale; the super admin sees all,
 * with how many tenants are on each.
 */
async function getPlans({ includeInactive = false } = {}) {
  return getPrismaClient().subscriptionPlan.findMany({
    where: includeInactive ? {} : { isActive: true },
    include: { _count: { select: { subscriptions: true } } },
    orderBy: [{ sortOrder: "asc" }, { price: "asc" }]
  });
}

async function updatePlan(id, input) {
  const plan = await getPrismaClient().subscriptionPlan.update({ where: { id }, data: planData(input, { partial: true }) });
  await invalidatePlanTenants(id);
  return plan;
}

/** Takes a plan off sale. Tenants already on it keep it. */
async function deletePlan(id) {
  return getPrismaClient().subscriptionPlan.update({ where: { id }, data: { isActive: false } });
}

// --- A tenant's own subscription ---

/** What the Subscription screen shows: the plan, where it stands, and past payments */
async function getTenantSubscription(tenantId) {
  const prisma = getPrismaClient();
  const entitlements = await getEntitlements(tenantId);
  const [subscription, payments, stores] = await Promise.all([
    prisma.tenantSubscription.findUnique({ where: { tenantId }, include: { plan: true } }),
    prisma.subscriptionPayment.findMany({ where: { tenantId, status: "PAID" }, orderBy: { paidAt: "desc" }, take: 24 }),
    prisma.store.count({ where: { tenantId } })
  ]);
  if (!subscription) return null;
  return { ...subscription, entitlements, payments, storesUsed: stores };
}

/**
 * Switches a plan on for a tenant.
 * Renewing the same plan before it ends adds the new period after the current one, so no paid
 * days are lost; anything else starts today.
 */
async function activatePlan(db, tenantId, plan, { providerSubId, periodEnd = null } = {}) {
  const current = await db.tenantSubscription.findUnique({ where: { tenantId } });
  const now = new Date();
  const renewingEarly = current && current.planId === plan.id && current.status === "ACTIVE" && current.currentPeriodEnd > now;
  const periodStart = renewingEarly ? current.currentPeriodEnd : now;
  const currentPeriodEnd = periodEnd || periodEndFrom(periodStart, plan.interval);

  const subscription = await db.tenantSubscription.upsert({
    where: { tenantId },
    update: { planId: plan.id, status: "ACTIVE", currentPeriodEnd, gracePeriodEndsAt: null, providerSubId },
    create: { tenantId, planId: plan.id, status: "ACTIVE", currentPeriodEnd, providerSubId },
    include: { plan: true }
  });
  return { subscription, periodStart, periodEnd: currentPeriodEnd };
}

// --- Super admin: every tenant's subscription ---

async function listTenantSubscriptions() {
  const prisma = getPrismaClient();
  const tenants = await prisma.tenant.findMany({
    orderBy: { name: "asc" },
    select: {
      id: true, name: true, slug: true, status: true, logo: true, createdAt: true,
      _count: { select: { stores: true } },
      subscription: { select: { extraFeatures: true, maxStoresOverride: true, adminNote: true, providerSubId: true, updatedAt: true } },
      subscriptionPayments: { where: { status: "PAID" }, orderBy: { paidAt: "desc" }, take: 1, select: { amount: true, paidAt: true, planName: true } }
    }
  });
  // Reading entitlements also starts trials and applies expiry, so the list is always current
  return Promise.all(tenants.map(async (t) => {
    const entitlements = await getEntitlements(t.id);
    return {
      id: t.id,
      name: t.name,
      slug: t.slug,
      status: t.status,
      logo: t.logo,
      storesUsed: t._count.stores,
      entitlements,
      extraFeatures: t.subscription?.extraFeatures || [],
      maxStoresOverride: t.subscription?.maxStoresOverride ?? null,
      adminNote: t.subscription?.adminNote || null,
      // How the current plan came about: a payment, a free trial, or set by the platform
      source: t.subscription?.providerSubId === "TRIAL" ? "TRIAL" : t.subscription?.providerSubId === "DIRECT_ASSIGN" ? "ASSIGNED" : t.subscription ? "PAID" : null,
      lastPayment: t.subscriptionPayments[0] || null
    };
  }));
}

/**
 * The platform sets a tenant's plan by hand, with no payment.
 *
 * @param {object} options
 * @param {string} [options.periodEnd] End date (ISO); defaults to one billing period from today
 * @param {boolean} [options.trial] Run it as a free trial instead (ends after the trial length unless periodEnd is given)
 * @param {string[]} [options.extraFeatures] Features granted on top of the plan
 * @param {number|null} [options.maxStoresOverride] Store limit instead of the plan's (null = the plan's)
 * @param {string} [options.adminNote]
 */
async function assignPlanDirectly(tenantId, planId, options = {}) {
  const prisma = getPrismaClient();
  const [tenant, plan] = await Promise.all([
    prisma.tenant.findUnique({ where: { id: tenantId }, select: { id: true } }),
    prisma.subscriptionPlan.findUnique({ where: { id: planId } })
  ]);
  if (!tenant) throw createHttpError(404, "Tenant not found");
  if (!plan) throw createHttpError(404, "Subscription plan not found");

  let currentPeriodEnd = options.trial ? addDays(new Date(), TRIAL_DAYS) : periodEndFrom(new Date(), plan.interval);
  if (options.periodEnd) {
    currentPeriodEnd = new Date(options.periodEnd);
    if (Number.isNaN(currentPeriodEnd.getTime())) throw createHttpError(400, "The end date isn't a valid date");
    currentPeriodEnd.setHours(23, 59, 59, 999);
    if (currentPeriodEnd <= new Date()) throw createHttpError(400, "The end date must be in the future");
  }

  const extras = {};
  if (options.extraFeatures !== undefined) extras.extraFeatures = cleanFeatureKeys(options.extraFeatures);
  if (options.maxStoresOverride !== undefined) {
    const limit = options.maxStoresOverride === null || options.maxStoresOverride === "" ? null : Number(options.maxStoresOverride);
    if (limit !== null && (!Number.isInteger(limit) || limit < 1)) throw createHttpError(400, "The store limit must be 1 or more");
    extras.maxStoresOverride = limit;
  }
  if (options.adminNote !== undefined) extras.adminNote = String(options.adminNote || "").trim().slice(0, 300) || null;

  const data = {
    planId,
    status: options.trial ? "TRIALING" : "ACTIVE",
    currentPeriodEnd,
    gracePeriodEndsAt: null,
    providerSubId: options.trial ? "TRIAL" : "DIRECT_ASSIGN",
    ...extras
  };
  const subscription = await prisma.tenantSubscription.upsert({
    where: { tenantId },
    update: data,
    create: { tenantId, ...data },
    include: { plan: true }
  });
  invalidateEntitlements(tenantId);
  return subscription;
}

// --- Paying for a plan (PhonePe) ---

function phonePeChecksum(text) {
  return crypto.createHash("sha256").update(text + env.phonePe.saltKey).digest("hex") + "###" + env.phonePe.saltIndex;
}

async function generatePhonePeLink(tenantId, plan, transactionId) {
  const payload = {
    merchantId: env.phonePe.merchantId,
    merchantTransactionId: transactionId,
    merchantUserId: tenantId,
    amount: plan.price * 100, // paise
    // Only the transaction id travels with the browser; who and what it pays for is read from our own record
    redirectUrl: `${env.apps.apiUrl}/api/billing/subscription/redirect?tid=${transactionId}`,
    redirectMode: "POST",
    callbackUrl: `${env.apps.apiUrl}/api/billing/webhooks/phonepe`,
    paymentInstrument: { type: "PAY_PAGE" }
  };
  const base64Payload = Buffer.from(JSON.stringify(payload)).toString("base64");
  const endpoint = "/pg/v1/pay";

  try {
    const response = await axios.post(`${env.phonePe.host}${endpoint}`, { request: base64Payload }, {
      headers: { "Content-Type": "application/json", "X-VERIFY": phonePeChecksum(base64Payload + endpoint) }
    });
    const url = response.data?.data?.instrumentResponse?.redirectInfo?.url;
    if (response.data.success && url) return url;
    throw new Error(response.data.message || "Failed to generate PhonePe link");
  } catch (error) {
    console.error("PhonePe Error:", error.response?.data || error.message);
    throw createHttpError(502, "The payment page couldn't be opened. Please try again in a minute.");
  }
}

/** Records the attempt, then asks PhonePe for a pay page */
async function startPayment(tenantId, planId, { sourceApp = "admin", initiatedById = null } = {}) {
  const prisma = getPrismaClient();
  const plan = await prisma.subscriptionPlan.findUnique({ where: { id: planId } });
  if (!plan || !plan.isActive) throw createHttpError(404, "That plan isn't available");
  if (plan.price <= 0) throw createHttpError(400, "This plan is free and doesn't need a payment. Ask us to switch it on.");

  const transactionId = `SUB_${crypto.randomBytes(8).toString("hex")}`;
  await prisma.subscriptionPayment.create({
    data: { tenantId, planId: plan.id, planName: plan.name, amount: plan.price, transactionId, sourceApp, initiatedById }
  });
  try {
    return { plan, paymentUrl: await generatePhonePeLink(tenantId, plan, transactionId) };
  } catch (error) {
    await prisma.subscriptionPayment.update({ where: { transactionId }, data: { status: "FAILED" } }).catch(() => {});
    throw error;
  }
}

// Super admin emails a pay link to the tenant's owner
async function sendPaymentLink(tenantId, planId, sourceApp = "admin", initiatedById = null) {
  const prisma = getPrismaClient();
  const tenant = await prisma.tenant.findUnique({
    where: { id: tenantId },
    include: { users: { where: { role: "TENANT_ADMIN", status: "ACTIVE" } } }
  });
  if (!tenant) throw createHttpError(404, "Tenant not found");
  if (tenant.users.length === 0) throw createHttpError(400, "Tenant has no active admin to send the link to");

  const { plan, paymentUrl } = await startPayment(tenantId, planId, { sourceApp, initiatedById });
  const { getPaymentLinkEmailTemplate } = require("../../lib/templates/payment-link-email");
  const { sendMail } = require("../../lib/mailer");
  const admin = tenant.users[0];
  await sendMail({
    to: admin.email,
    subject: "Scan My Order - Subscription Payment Required",
    html: getPaymentLinkEmailTemplate(tenant.name, plan.name, plan.price, plan.interval, paymentUrl)
  });
  return { success: true, message: `Payment link sent to ${admin.email}` };
}

// Tenant owner pays for a plan themselves
async function initiateSubscription(tenantId, planId, sourceApp = "admin", initiatedById = null) {
  const { paymentUrl } = await startPayment(tenantId, planId, { sourceApp, initiatedById });
  return { success: true, paymentUrl };
}

async function verifyPhonePeTransaction(merchantTransactionId) {
  const endpoint = `/pg/v1/status/${env.phonePe.merchantId}/${merchantTransactionId}`;
  try {
    const response = await axios.get(`${env.phonePe.host}${endpoint}`, {
      headers: { "Content-Type": "application/json", "X-VERIFY": phonePeChecksum(endpoint), "X-MERCHANT-ID": env.phonePe.merchantId }
    });
    return response.data;
  } catch (error) {
    console.error("PhonePe Verify Error:", error.response?.data || error.message);
    throw createHttpError(502, "Failed to verify transaction status with PhonePe");
  }
}

/**
 * Settles one recorded payment attempt from what PhonePe says about it.
 * The plan is switched on only when PhonePe reports success for the amount we asked for, and
 * only the first time: a repeated redirect or webhook finds the row already PAID and does nothing.
 *
 * @param {{ code?: string, success?: boolean, amountPaise?: number }} report PhonePe's answer for this transaction
 * @returns {Promise<{ outcome: 'paid'|'failed'|'unknown', payment: object|null }>}
 */
async function settlePayment(transactionId, report) {
  const prisma = getPrismaClient();
  const payment = transactionId ? await prisma.subscriptionPayment.findUnique({ where: { transactionId } }) : null;
  if (!payment) return { outcome: "unknown", payment: null };
  if (payment.status === "PAID") return { outcome: "paid", payment };

  const paid = report.code === "PAYMENT_SUCCESS" && report.success !== false;
  const amountMatches = Number(report.amountPaise) === payment.amount * 100;
  if (!paid || !amountMatches) {
    if (paid && !amountMatches) {
      console.error(`[Billing] ${transactionId}: PhonePe reports ${report.amountPaise} paise, expected ${payment.amount * 100}. Plan not switched on.`);
    }
    // Still pending at PhonePe is not a failure yet
    if (report.code !== "PAYMENT_PENDING") {
      await prisma.subscriptionPayment.updateMany({ where: { transactionId, status: "PENDING" }, data: { status: "FAILED" } });
    }
    return { outcome: "failed", payment };
  }

  const plan = await prisma.subscriptionPlan.findUnique({ where: { id: payment.planId } });
  if (!plan) return { outcome: "failed", payment };

  const done = await prisma.$transaction(async (tx) => {
    // Claim the row first: of two callers arriving together, only one switches the plan on
    const claim = await tx.subscriptionPayment.updateMany({
      where: { transactionId, status: { in: ["PENDING", "FAILED"] } },
      data: { status: "PAID", paidAt: new Date() }
    });
    if (claim.count === 0) return false;
    const { periodStart, periodEnd } = await activatePlan(tx, payment.tenantId, plan, { providerSubId: transactionId });
    await tx.subscriptionPayment.update({ where: { transactionId }, data: { periodStart, periodEnd } });
    return true;
  });
  if (done) invalidateEntitlements(payment.tenantId);
  return { outcome: "paid", payment };
}

// PhonePe's server-to-server callback (signature already checked by the route)
async function handleSubscriptionWebhook(payload) {
  if (!payload.response) throw createHttpError(400, "Invalid payload format");
  const decoded = JSON.parse(Buffer.from(payload.response, "base64").toString("utf-8"));
  const data = decoded.data || {};
  if (!data.merchantTransactionId) throw createHttpError(400, "Missing merchantTransactionId");
  const { outcome } = await settlePayment(data.merchantTransactionId, { code: decoded.code || data.code, success: decoded.success, amountPaise: data.amount });
  return { success: true, outcome };
}

// The guest's browser coming back from PhonePe: we ask PhonePe ourselves what happened
async function handleSubscriptionRedirect(queryParams) {
  const transactionId = queryParams.tid;
  const payment = transactionId ? await getPrismaClient().subscriptionPayment.findUnique({ where: { transactionId } }) : null;
  const toOperations = payment?.sourceApp === "operations";
  const base = toOperations ? `${env.apps.operationsUrl || env.apps.adminUrl}/dashboard/subscriptions` : `${env.apps.adminUrl}/billing`;
  const target = (status, code) => `${base}?payment=${status}${code ? `&code=${encodeURIComponent(code)}` : ""}`;

  if (!payment) return { success: false, redirectPath: target("error") };
  try {
    const status = await verifyPhonePeTransaction(transactionId);
    const { outcome } = await settlePayment(transactionId, { code: status.code, success: status.success, amountPaise: status.data?.amount });
    return outcome === "paid"
      ? { success: true, redirectPath: target("success") }
      : { success: false, redirectPath: target("failed", status.code || "UNKNOWN") };
  } catch (err) {
    console.error("Handle Redirect Error:", err);
    return { success: false, redirectPath: target("error") };
  }
}

/** Paid subscription payments, newest first (super admin: all tenants) */
async function listPayments({ tenantId = null, limit = 50 } = {}) {
  return getPrismaClient().subscriptionPayment.findMany({
    where: { status: "PAID", ...(tenantId ? { tenantId } : {}) },
    orderBy: { paidAt: "desc" },
    take: Math.min(200, limit),
    include: { tenant: { select: { name: true } } }
  });
}

module.exports = {
  createPlan,
  getPlans,
  updatePlan,
  deletePlan,
  getTenantSubscription,
  listTenantSubscriptions,
  assignPlanDirectly,
  sendPaymentLink,
  initiateSubscription,
  settlePayment,
  handleSubscriptionWebhook,
  handleSubscriptionRedirect,
  listPayments,
  trialPlan
};
