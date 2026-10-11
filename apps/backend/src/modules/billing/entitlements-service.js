const { PLAN_FEATURE_KEYS, planFeatureLabel, cleanFeatureKeys, TRIAL_DAYS, GRACE_DAYS } = require("@smo/shared/plans");
const { getPrismaClient } = require("../../lib/prisma");
const { createHttpError } = require("../../middleware/error-handler");
const { storeTenantCache, tenantSubscriptionCache } = require("../../lib/cache");

const DAY_MS = 86400000;
const addDays = (date, days) => new Date(date.getTime() + days * DAY_MS);

/** The plan a free trial runs on: the active plan with the most features (the dearest on a tie) */
async function trialPlan(prisma) {
  const plans = await prisma.subscriptionPlan.findMany({ where: { isActive: true } });
  return plans.sort((a, b) => b.features.length - a.features.length || b.price - a.price)[0] || null;
}

/**
 * The tenant's subscription row, brought up to date:
 * - a tenant that never had one starts a free trial with everything unlocked
 * - one that ran past its end date is marked past due and given its grace period
 */
async function loadSubscription(tenantId) {
  const prisma = getPrismaClient();
  let sub = await prisma.tenantSubscription.findUnique({ where: { tenantId }, include: { plan: true } });

  if (!sub) {
    const plan = await trialPlan(prisma);
    if (!plan) return null; // no plans set up yet: nothing to hold anyone to
    sub = await prisma.tenantSubscription.upsert({
      where: { tenantId },
      update: {},
      create: { tenantId, planId: plan.id, status: "TRIALING", currentPeriodEnd: addDays(new Date(), TRIAL_DAYS), providerSubId: "TRIAL" },
      include: { plan: true }
    });
  }

  const now = new Date();
  if ((sub.status === "ACTIVE" || sub.status === "TRIALING") && sub.currentPeriodEnd < now) {
    sub = await prisma.tenantSubscription.update({
      where: { id: sub.id },
      data: { status: "PAST_DUE", gracePeriodEndsAt: addDays(sub.currentPeriodEnd, GRACE_DAYS) },
      include: { plan: true }
    });
  }
  return sub;
}

function describe(sub) {
  if (!sub) {
    return { state: "ACTIVE", plan: null, features: PLAN_FEATURE_KEYS, maxStores: null, periodEnd: null, graceEndsAt: null, daysLeft: null, isTrial: false };
  }
  const now = Date.now();
  let state;
  if (sub.status === "TRIALING") state = "TRIAL";
  else if (sub.status === "ACTIVE") state = "ACTIVE";
  else if (sub.status === "PAST_DUE" && sub.gracePeriodEndsAt && sub.gracePeriodEndsAt.getTime() > now) state = "GRACE";
  else state = "LOCKED";

  const until = state === "GRACE" ? sub.gracePeriodEndsAt : sub.currentPeriodEnd;
  return {
    state,
    plan: { id: sub.plan.id, name: sub.plan.name, price: sub.plan.price, interval: sub.plan.interval },
    features: cleanFeatureKeys([...(sub.plan.features || []), ...(sub.extraFeatures || [])]),
    maxStores: sub.maxStoresOverride ?? sub.plan.maxStores,
    periodEnd: sub.currentPeriodEnd,
    graceEndsAt: sub.gracePeriodEndsAt,
    daysLeft: state === "LOCKED" ? 0 : Math.max(0, Math.ceil((until.getTime() - now) / DAY_MS)),
    // A trial that ran out stays a trial for wording ("your trial ended")
    isTrial: sub.providerSubId === "TRIAL"
  };
}

/**
 * What a tenant may use right now: its plan's features (plus any granted on top), its store
 * limit, and where the subscription stands. Cached for a minute; see invalidateEntitlements.
 *
 * @returns {Promise<{ state: 'ACTIVE'|'TRIAL'|'GRACE'|'LOCKED', plan: object|null, features: string[],
 *                     maxStores: number|null, periodEnd: Date|null, graceEndsAt: Date|null, daysLeft: number|null, isTrial: boolean }>}
 */
async function getEntitlements(tenantId) {
  const cached = tenantSubscriptionCache.get(`ent:${tenantId}`);
  if (cached) return cached;
  const entitlements = describe(await loadSubscription(tenantId));
  tenantSubscriptionCache.set(`ent:${tenantId}`, entitlements);
  return entitlements;
}

function invalidateEntitlements(tenantId) {
  tenantSubscriptionCache.del(`ent:${tenantId}`);
  tenantSubscriptionCache.del(tenantId);
}

async function tenantOfStore(storeId) {
  const cached = storeTenantCache.get(storeId);
  if (cached) return cached;
  const store = await getPrismaClient().store.findUnique({ where: { id: storeId }, select: { tenantId: true } });
  if (!store) return null;
  storeTenantCache.set(storeId, store.tenantId);
  return store.tenantId;
}

/** Entitlements for the tenant that owns a store (null when the store doesn't exist) */
async function getStoreEntitlements(storeId) {
  const tenantId = await tenantOfStore(storeId);
  return tenantId ? getEntitlements(tenantId) : null;
}

function featureError(key) {
  const error = createHttpError(403, `${planFeatureLabel(key)} isn't part of your plan. Upgrade to use it.`);
  error.details = { code: "FEATURE_NOT_IN_PLAN", feature: key };
  return error;
}

/** Throws unless the tenant's plan includes the feature */
async function assertTenantFeature(tenantId, key) {
  if (!tenantId) return;
  const entitlements = await getEntitlements(tenantId);
  if (!entitlements.features.includes(key)) throw featureError(key);
}

/** Throws unless the plan of the store's tenant includes the feature */
async function assertStoreFeature(storeId, key) {
  const tenantId = await tenantOfStore(storeId);
  await assertTenantFeature(tenantId, key);
}

async function storeHasFeature(storeId, key) {
  const entitlements = await getStoreEntitlements(storeId);
  return Boolean(entitlements?.features.includes(key));
}

/**
 * Route guard: the tenant behind this request must have the feature.
 * Super admins pass. With `writesOnly`, reading stays open (other screens rely on the data)
 * and only changes need the feature.
 */
function requireFeature(key, { writesOnly = false } = {}) {
  return async (req, _res, next) => {
    try {
      if (req.user?.role === "SUPER_ADMIN") return next();
      if (writesOnly && ["GET", "HEAD", "OPTIONS"].includes(req.method)) return next();
      const tenantId = req.params.storeId ? await tenantOfStore(req.params.storeId) : req.user?.tenantId;
      await assertTenantFeature(tenantId, key);
      next();
    } catch (error) {
      next(error);
    }
  };
}

module.exports = {
  getEntitlements,
  getStoreEntitlements,
  invalidateEntitlements,
  assertTenantFeature,
  assertStoreFeature,
  storeHasFeature,
  requireFeature,
  tenantOfStore,
  trialPlan,
  addDays
};
