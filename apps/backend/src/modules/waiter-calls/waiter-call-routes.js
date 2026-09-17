const express = require("express");
const { createApiResponse } = require("@smo/shared");
const { asyncHandler } = require("../../middleware/async-handler");
const { authenticate } = require("../../middleware/auth");
const {
  getActiveCalls,
  acknowledgeCall,
  resolveCall,
  cancelWaiterCall,
  setWaiterAvailability,
  getWaiterAvailability
} = require("./waiter-call-service");

const router = express.Router({ mergeParams: true });

router.use(authenticate);

// GET /api/stores/:storeId/calls - Get active table calls for staff
router.get("/", asyncHandler(async (req, res) => {
  const result = await getActiveCalls(req.params.storeId);
  res.json(createApiResponse(result));
}));

// PATCH /api/stores/:storeId/calls/:id/acknowledge - Staff marks on the way
router.patch("/:id/acknowledge", asyncHandler(async (req, res) => {
  const result = await acknowledgeCall(req.params.storeId, req.params.id, req.user);
  res.json(createApiResponse(result));
}));

// PATCH /api/stores/:storeId/calls/:id/resolve - Staff marks resolved
router.patch("/:id/resolve", asyncHandler(async (req, res) => {
  const result = await resolveCall(req.params.storeId, req.params.id, req.user.id);
  res.json(createApiResponse(result));
}));

// DELETE /api/stores/:storeId/calls/:id - Staff or customer cancels call
router.delete("/:id", asyncHandler(async (req, res) => {
  const result = await cancelWaiterCall(req.params.storeId, req.params.id);
  res.json(createApiResponse(result));
}));

// POST /api/stores/:storeId/calls/availability - Waiter sets AVAILABLE or BUSY
router.post("/availability", asyncHandler(async (req, res) => {
  const result = setWaiterAvailability(req.params.storeId, req.user.id, req.body.status);
  res.json(createApiResponse(result));
}));

// GET /api/stores/:storeId/calls/availability - Get current waiter availability
router.get("/availability", asyncHandler(async (req, res) => {
  const result = getWaiterAvailability(req.params.storeId, req.user.id);
  res.json(createApiResponse(result));
}));

module.exports = router;
