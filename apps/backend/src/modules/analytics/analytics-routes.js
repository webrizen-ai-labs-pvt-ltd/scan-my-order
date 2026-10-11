const express = require("express");
const { createApiResponse } = require("@smo/shared");
const { asyncHandler } = require("../../middleware/async-handler");
const { authenticate, authorizeRoles } = require("../../middleware/auth");
const { getTableAnalytics } = require("./analytics-service");

const router = express.Router();

// Strict security: strictly Tenant Admin and Super Admin
router.use(authenticate);
router.use(require("../billing/entitlements-service").requireFeature("TABLE_ANALYTICS"));
router.use(authorizeRoles('SUPER_ADMIN', 'TENANT_ADMIN'));

// GET /api/analytics/tables
router.get("/tables", asyncHandler(async (req, res) => {
  const result = await getTableAnalytics(req.user, req.query);
  res.json(createApiResponse(result));
}));

// GET /api/analytics/brands?days=7|30|90  (platform admin: how every brand is doing)
router.get("/brands", asyncHandler(async (req, res) => {
  const { getBrandPerformance } = require("./brand-performance-service");
  res.json(createApiResponse(await getBrandPerformance(req.user, req.query)));
}));

module.exports = router;
