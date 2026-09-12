const express = require("express");
const { createApiResponse } = require("@smo/shared");
const { asyncHandler } = require("../../middleware/async-handler");
const { authenticate } = require("../../middleware/auth");
const {
  getReservations,
  checkTableAvailability,
  createReservation,
  updateReservation,
  deleteReservation
} = require("./reservation-service");

const router = express.Router({ mergeParams: true });

router.use(authenticate);

// GET /api/stores/:storeId/reservations
router.get("/", asyncHandler(async (req, res) => {
  const result = await getReservations(req.user, req.params.storeId, req.query);
  res.json(createApiResponse(result));
}));

// GET /api/stores/:storeId/reservations/availability
router.get("/availability", asyncHandler(async (req, res) => {
  const result = await checkTableAvailability(req.user, req.params.storeId, req.query);
  res.json(createApiResponse(result));
}));

// POST /api/stores/:storeId/reservations
router.post("/", asyncHandler(async (req, res) => {
  const result = await createReservation(req.user, req.params.storeId, req.body);
  res.status(201).json(createApiResponse(result));
}));

// PATCH /api/stores/:storeId/reservations/:id
router.patch("/:id", asyncHandler(async (req, res) => {
  const result = await updateReservation(req.user, req.params.storeId, req.params.id, req.body);
  res.json(createApiResponse(result));
}));

// DELETE /api/stores/:storeId/reservations/:id
router.delete("/:id", asyncHandler(async (req, res) => {
  const result = await deleteReservation(req.user, req.params.storeId, req.params.id);
  res.json(createApiResponse(result));
}));

module.exports = router;
