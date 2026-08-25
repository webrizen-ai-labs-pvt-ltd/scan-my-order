const express = require("express");
const { createApiResponse } = require("@smo/shared");
const { asyncHandler } = require("../../middleware/async-handler");
const { authenticate } = require("../../middleware/auth");
const {
  getActiveCalls,
  acknowledgeCall,
  resolveCall
} = require("./waiter-call-service");

const router = express.Router({ mergeParams: true });

router.use(authenticate);

// GET /api/stores/:storeId/calls
router.get("/", asyncHandler(async (req, res) => {
  const result = await getActiveCalls(req.params.storeId);
  res.json(createApiResponse(result));
}));

// PATCH /api/stores/:storeId/calls/:id/acknowledge
router.patch("/:id/acknowledge", asyncHandler(async (req, res) => {
  const result = await acknowledgeCall(req.params.storeId, req.params.id, req.user.id);
  res.json(createApiResponse(result));
}));

// PATCH /api/stores/:storeId/calls/:id/resolve
router.patch("/:id/resolve", asyncHandler(async (req, res) => {
  const result = await resolveCall(req.params.storeId, req.params.id);
  res.json(createApiResponse(result));
}));

module.exports = router;
