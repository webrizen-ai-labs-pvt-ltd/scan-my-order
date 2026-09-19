const express = require("express");
const { createApiResponse } = require("@smo/shared");
const { asyncHandler } = require("../../middleware/async-handler");
const { authenticate } = require("../../middleware/auth");
const {
  getStoreLoyaltySettings,
  updateStoreLoyaltySettings,
  getStoreCustomersWithWallets,
  manualAdjustCredits
} = require("./loyalty-service");

const router = express.Router({ mergeParams: true });

router.use(authenticate);

// GET /api/stores/:storeId/loyalty - Get store loyalty config & aggregate stats
router.get("/", asyncHandler(async (req, res) => {
  const result = await getStoreLoyaltySettings(req.params.storeId);
  res.json(createApiResponse(result));
}));

// PATCH /api/stores/:storeId/loyalty - Update store loyalty config
router.patch("/", asyncHandler(async (req, res) => {
  const result = await updateStoreLoyaltySettings(req.user, req.params.storeId, req.body);
  res.json(createApiResponse(result));
}));

// GET /api/stores/:storeId/loyalty/customers - List customers with wallets for this store
router.get("/customers", asyncHandler(async (req, res) => {
  const result = await getStoreCustomersWithWallets(req.params.storeId, req.query.search);
  res.json(createApiResponse(result));
}));

// POST /api/stores/:storeId/loyalty/adjust - Manual credit adjustment
router.post("/adjust", asyncHandler(async (req, res) => {
  const { customerId, amount, reason } = req.body;
  const result = await manualAdjustCredits(req.user, req.params.storeId, customerId, amount, reason);
  res.json(createApiResponse(result));
}));

module.exports = router;
