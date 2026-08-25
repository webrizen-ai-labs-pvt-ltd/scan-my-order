const express = require("express");
const { createApiResponse } = require("@smo/shared");
const { asyncHandler } = require("../../middleware/async-handler");
const { authenticate } = require("../../middleware/auth");
const {
  getMaterials,
  createMaterial,
  createRecipeIngredient,
  deleteRecipeIngredient,
  addStockTransaction
} = require("./inventory-service");

const router = express.Router({ mergeParams: true });

// All inventory routes require authentication (Admin/Staff)
router.use(authenticate);

// GET /api/stores/:storeId/inventory/materials
router.get("/materials", asyncHandler(async (req, res) => {
  const result = await getMaterials(req.user, req.params.storeId);
  res.json(createApiResponse(result));
}));

// POST /api/stores/:storeId/inventory/materials
router.post("/materials", asyncHandler(async (req, res) => {
  const result = await createMaterial(req.user, req.params.storeId, req.body);
  res.status(201).json(createApiResponse(result));
}));

// POST /api/stores/:storeId/inventory/recipes
router.post("/recipes", asyncHandler(async (req, res) => {
  const result = await createRecipeIngredient(req.user, req.params.storeId, req.body);
  res.status(201).json(createApiResponse(result));
}));

// DELETE /api/stores/:storeId/inventory/recipes/:id
router.delete("/recipes/:id", asyncHandler(async (req, res) => {
  const result = await deleteRecipeIngredient(req.user, req.params.storeId, req.params.id);
  res.json(createApiResponse(result));
}));

// POST /api/stores/:storeId/inventory/transactions
router.post("/transactions", asyncHandler(async (req, res) => {
  const result = await addStockTransaction(req.user, req.params.storeId, req.body);
  res.status(201).json(createApiResponse(result));
}));

module.exports = router;
