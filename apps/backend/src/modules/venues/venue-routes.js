const express = require("express");
const { createApiResponse } = require("@smo/shared");
const { asyncHandler } = require("../../middleware/async-handler");
const { authenticate, authorizeRoles } = require("../../middleware/auth");
const {
  listVenues, getVenue, createVenue, updateVenue, deleteVenue,
  searchStoresForVenue, addStoreToVenue, removeStoreFromVenue, updateVenueStore
} = require("./venue-service");

// Venues are set up by super admins only
const router = express.Router();
router.use(authenticate, authorizeRoles("SUPER_ADMIN"));

// GET /api/venues
router.get("/", asyncHandler(async (_req, res) => {
  res.json(createApiResponse(await listVenues()));
}));

// GET /api/venues/store-search?q=  (stores across every brand, to add to a venue)
router.get("/store-search", asyncHandler(async (req, res) => {
  res.json(createApiResponse(await searchStoresForVenue(req.query.q)));
}));

// POST /api/venues
router.post("/", asyncHandler(async (req, res) => {
  res.status(201).json(createApiResponse(await createVenue(req.body || {})));
}));

// GET /api/venues/:id
router.get("/:id", asyncHandler(async (req, res) => {
  res.json(createApiResponse(await getVenue(req.params.id)));
}));

// PUT /api/venues/:id
router.put("/:id", asyncHandler(async (req, res) => {
  res.json(createApiResponse(await updateVenue(req.params.id, req.body || {})));
}));

// DELETE /api/venues/:id  (stores stay; they're just no longer grouped)
router.delete("/:id", asyncHandler(async (req, res) => {
  res.json(createApiResponse(await deleteVenue(req.params.id)));
}));

// POST /api/venues/:id/stores  { storeId, serviceMode?, venueLocation? }
router.post("/:id/stores", asyncHandler(async (req, res) => {
  const { storeId, ...rest } = req.body || {};
  res.status(201).json(createApiResponse(await addStoreToVenue(req.params.id, storeId, rest)));
}));

// PATCH /api/venues/:id/stores/:storeId  { serviceMode?, venueLocation? }
router.patch("/:id/stores/:storeId", asyncHandler(async (req, res) => {
  res.json(createApiResponse(await updateVenueStore(req.params.id, req.params.storeId, req.body || {})));
}));

// DELETE /api/venues/:id/stores/:storeId
router.delete("/:id/stores/:storeId", asyncHandler(async (req, res) => {
  res.json(createApiResponse(await removeStoreFromVenue(req.params.id, req.params.storeId)));
}));

module.exports = router;
