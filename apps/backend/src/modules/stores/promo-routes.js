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
const { verifyStoreAccess } = require("../menu/menu-service");

const router = express.Router({ mergeParams: true });

// Staff of this store only (customers and other restaurants' staff get 403)
router.use(asyncHandler(async (req, _res, next) => {
  await verifyStoreAccess(req.user, req.params.storeId);
  next();
}));

// Read promos (Allowed for any authenticated store staff in POS)
router.get("/", asyncHandler(async (req, res) => {
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
