const express = require("express");
const crypto = require("crypto");
const { env } = require("../../config/env");
const { createApiResponse } = require("@smo/shared");
const { asyncHandler } = require("../../middleware/async-handler");
const { authenticate } = require("../../middleware/auth");
const { userRoles } = require("../../constants/roles");
const { createHttpError } = require("../../middleware/error-handler");
const {
  createPlan,
  getPlans,
  updatePlan,
  deletePlan,
  getTenantSubscription,
  listTenantSubscriptions,
  listPayments,
  assignPlanDirectly,
  sendPaymentLink,
  initiateSubscription,
  handleSubscriptionWebhook,
  handleSubscriptionRedirect
} = require("./subscription-service");
const {
  saveGatewayKeys,
  getGateways
} = require("./payment-gateway-service");

const { PLAN_FEATURE_KEYS } = require("@smo/shared/plans");
const { getEntitlements, assertTenantFeature } = require("./entitlements-service");

const router = express.Router();

// Middleware to restrict to SUPER_ADMIN
function requireSuperAdmin(req, _res, next) {
  if (req.user.role !== userRoles.superAdmin) {
    throw createHttpError(403, "Only Super Admins can perform this action");
  }
  next();
}

// Middleware to restrict to TENANT_ADMIN
function requireTenantAdmin(req, _res, next) {
  if (req.user.role !== userRoles.tenantAdmin) {
    throw createHttpError(403, "Only Tenant Admins can perform this action");
  }
  next();
}

// --- Subscription Plan Routes (SUPER_ADMIN) ---

router.post("/plans", authenticate, requireSuperAdmin, asyncHandler(async (req, res) => {
  const result = await createPlan(req.body);
  res.status(201).json(createApiResponse(result));
}));

router.put("/plans/:id", authenticate, requireSuperAdmin, asyncHandler(async (req, res) => {
  const result = await updatePlan(req.params.id, req.body);
  res.json(createApiResponse(result));
}));

router.delete("/plans/:id", authenticate, requireSuperAdmin, asyncHandler(async (req, res) => {
  const result = await deletePlan(req.params.id);
  res.json(createApiResponse(result));
}));

// Public/Auth get plans
router.get("/plans", authenticate, asyncHandler(async (req, res) => {
  // Tenants see the plans on sale; the super admin also sees retired ones
  const result = await getPlans({ includeInactive: req.user.role === userRoles.superAdmin });
  res.json(createApiResponse(result));
}));

// --- Subscription Management (SUPER_ADMIN) ---

router.post("/subscription/assign", authenticate, requireSuperAdmin, asyncHandler(async (req, res) => {
  // No payment involved: the platform decides. Optional: periodEnd, trial, extraFeatures, maxStoresOverride, adminNote
  const { tenantId, planId, ...options } = req.body;
  if (!tenantId || !planId) throw createHttpError(400, "tenantId and planId are required");
  const result = await assignPlanDirectly(tenantId, planId, options);
  res.json(createApiResponse(result));
}));

// Every tenant with its plan, state and usage
router.get("/subscriptions", authenticate, requireSuperAdmin, asyncHandler(async (_req, res) => {
  res.json(createApiResponse(await listTenantSubscriptions()));
}));

// Paid subscription payments across all tenants
router.get("/payments", authenticate, requireSuperAdmin, asyncHandler(async (req, res) => {
  res.json(createApiResponse(await listPayments({ tenantId: req.query.tenantId || null, limit: Number(req.query.limit) || 50 })));
}));

router.post("/subscription/send-link", authenticate, requireSuperAdmin, asyncHandler(async (req, res) => {
  const { tenantId, planId, sourceApp = 'admin' } = req.body;
  if (!tenantId || !planId) throw createHttpError(400, "tenantId and planId are required");
  const result = await sendPaymentLink(tenantId, planId, sourceApp, req.user.id);
  res.json(createApiResponse(result));
}));

// --- What the signed-in user's brand may use (any staff member) ---

// GET /api/billing/entitlements  → { state, plan, features, maxStores, periodEnd, graceEndsAt, daysLeft, isTrial }
router.get("/entitlements", authenticate, asyncHandler(async (req, res) => {
  if (req.user.role === userRoles.superAdmin || !req.user.tenantId) {
    return res.json(createApiResponse({ state: "ACTIVE", plan: null, features: PLAN_FEATURE_KEYS, maxStores: null, periodEnd: null, graceEndsAt: null, daysLeft: null, isTrial: false }));
  }
  res.json(createApiResponse(await getEntitlements(req.user.tenantId)));
}));

// --- Tenant Subscription Routes (TENANT_ADMIN) ---

router.get("/subscription", authenticate, requireTenantAdmin, asyncHandler(async (req, res) => {
  const result = await getTenantSubscription(req.user.tenantId);
  res.json(createApiResponse(result));
}));

router.post("/subscription/initiate", authenticate, requireTenantAdmin, asyncHandler(async (req, res) => {
  const { planId, sourceApp = 'admin' } = req.body;
  if (!planId) {
    throw createHttpError(400, "planId is required");
  }
  const result = await initiateSubscription(req.user.tenantId, planId, sourceApp, req.user.id);
  res.json(createApiResponse(result));
}));

// --- BYOAK Gateway Routes (TENANT_ADMIN) ---

router.get("/gateways", authenticate, requireTenantAdmin, asyncHandler(async (req, res) => {
  const result = await getGateways(req.user.tenantId);
  res.json(createApiResponse(result));
}));

router.post("/gateways", authenticate, requireTenantAdmin, asyncHandler(async (req, res) => {
  await assertTenantFeature(req.user.tenantId, "ONLINE_PAYMENTS");
  const result = await saveGatewayKeys(req.user.tenantId, req.body);
  res.json(createApiResponse(result));
}));

// --- Webhooks & Redirects ---

// Handle PhonePe UI redirect (browser comes back here after payment)
router.all("/subscription/redirect", asyncHandler(async (req, res) => {
  const result = await handleSubscriptionRedirect(req.query);
  res.redirect(result.redirectPath);
}));

// This would be called by PhonePe, so no 'authenticate' middleware
router.post("/webhooks/phonepe", express.raw({ type: 'application/json' }), asyncHandler(async (req, res) => {
  const signatureHeader = req.headers['x-verify'];
  if (!signatureHeader) {
    return res.status(400).json(createApiResponse(null, "Missing X-VERIFY signature"));
  }

  const rawBody = req.body.toString('utf8');
  const saltKey = env.phonePe.saltKey;
  const saltIndex = env.phonePe.saltIndex || "1";

  const hash = crypto.createHash('sha256').update(rawBody + saltKey).digest('hex');
  const expectedSignature = `${hash}###${saltIndex}`;

  if (signatureHeader !== expectedSignature) {
    return res.status(400).json(createApiResponse(null, "Invalid webhook signature"));
  }

  const payload = JSON.parse(rawBody);
  const result = await handleSubscriptionWebhook(payload);
  res.json(createApiResponse(result));
}));

module.exports = router;
