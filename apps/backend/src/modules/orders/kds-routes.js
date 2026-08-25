const express = require("express");
const { createApiResponse } = require("@smo/shared");
const { asyncHandler } = require("../../middleware/async-handler");
const { authenticate } = require("../../middleware/auth");
const { getKdsOrders, updateOrderStatus } = require("./order-service");

const router = express.Router({ mergeParams: true });

// Require authentication for KDS
router.use(authenticate);

// GET /api/stores/:storeId/kds/orders
router.get("/", asyncHandler(async (req, res) => {
  const result = await getKdsOrders(req.user, req.params.storeId);
  res.json(createApiResponse(result));
}));

// PATCH /api/stores/:storeId/kds/orders/:id/ready
router.patch("/:id/ready", asyncHandler(async (req, res) => {
  const result = await updateOrderStatus(req.user, req.params.storeId, req.params.id, 'READY');
  res.json(createApiResponse(result));
}));

module.exports = router;
