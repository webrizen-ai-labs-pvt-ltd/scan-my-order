const express = require("express");
const { createApiResponse } = require("@smo/shared");
const { asyncHandler } = require("../../middleware/async-handler");
const { authorizeRoles } = require("../../middleware/auth");
const {
  createPromoCode,
  getPromoCodes,
  updatePromoCode,
  deletePromoCode
} = require("./promo-service");

const router = express.Router({ mergeParams: true });

// Read promos (Allowed for cashier, waiter, and managers in POS)
router.get("/", authorizeRoles('SUPER_ADMIN', 'TENANT_ADMIN', 'STORE_MANAGER', 'CASHIER', 'WAITER'), asyncHandler(async (req, res) => {
  const result = await getPromoCodes(req.params.storeId);
  res.json(createApiResponse(result));
}));

// Mutations require manager or admin permissions
router.post("/", authorizeRoles('SUPER_ADMIN', 'TENANT_ADMIN', 'STORE_MANAGER'), asyncHandler(async (req, res) => {
  const result = await createPromoCode(req.params.storeId, req.body);
  res.status(201).json(createApiResponse(result));
}));

router.patch("/:id", authorizeRoles('SUPER_ADMIN', 'TENANT_ADMIN', 'STORE_MANAGER'), asyncHandler(async (req, res) => {
  const result = await updatePromoCode(req.params.storeId, req.params.id, req.body);
  res.json(createApiResponse(result));
}));

router.delete("/:id", authorizeRoles('SUPER_ADMIN', 'TENANT_ADMIN', 'STORE_MANAGER'), asyncHandler(async (req, res) => {
  const result = await deletePromoCode(req.params.storeId, req.params.id);
  res.json(createApiResponse(result));
}));

module.exports = router;
