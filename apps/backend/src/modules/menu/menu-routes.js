const express = require("express");
const { createApiResponse } = require("@smo/shared");
const { asyncHandler } = require("../../middleware/async-handler");
const { authenticate } = require("../../middleware/auth");
const {
  getFullMenu,
  createCategory, updateCategory, deleteCategory,
  createMenuItem, updateMenuItem, deleteMenuItem,
  createModifierGroup, updateModifierGroup, deleteModifierGroup,
  createModifierOption, updateModifierOption, deleteModifierOption
} = require("./menu-service");

const router = express.Router({ mergeParams: true });

// All menu routes require authentication (Admin/Staff)
router.use(authenticate);

// GET /api/stores/:storeId/menu
router.get("/", asyncHandler(async (req, res) => {
  const result = await getFullMenu(req.user, req.params.storeId);
  res.json(createApiResponse(result));
}));

// POST /api/stores/:storeId/menu/categories
router.post("/categories", asyncHandler(async (req, res) => {
  const result = await createCategory(req.user, req.params.storeId, req.body);
  res.status(201).json(createApiResponse(result));
}));

// PUT /api/stores/:storeId/menu/categories/:id
router.put("/categories/:id", asyncHandler(async (req, res) => {
  const result = await updateCategory(req.user, req.params.storeId, req.params.id, req.body);
  res.json(createApiResponse(result));
}));

// DELETE /api/stores/:storeId/menu/categories/:id
router.delete("/categories/:id", asyncHandler(async (req, res) => {
  const result = await deleteCategory(req.user, req.params.storeId, req.params.id);
  res.json(createApiResponse(result));
}));

// POST /api/stores/:storeId/menu/items
router.post("/items", asyncHandler(async (req, res) => {
  const result = await createMenuItem(req.user, req.params.storeId, req.body);
  res.status(201).json(createApiResponse(result));
}));

// PUT /api/stores/:storeId/menu/items/:id
router.put("/items/:id", asyncHandler(async (req, res) => {
  const result = await updateMenuItem(req.user, req.params.storeId, req.params.id, req.body);
  res.json(createApiResponse(result));
}));

// DELETE /api/stores/:storeId/menu/items/:id
router.delete("/items/:id", asyncHandler(async (req, res) => {
  const result = await deleteMenuItem(req.user, req.params.storeId, req.params.id);
  res.json(createApiResponse(result));
}));

// POST /api/stores/:storeId/menu/items/:itemId/modifier-groups
router.post("/items/:itemId/modifier-groups", asyncHandler(async (req, res) => {
  const result = await createModifierGroup(req.user, req.params.storeId, req.params.itemId, req.body);
  res.status(201).json(createApiResponse(result));
}));

// PUT /api/stores/:storeId/menu/modifier-groups/:id
router.put("/modifier-groups/:id", asyncHandler(async (req, res) => {
  const result = await updateModifierGroup(req.user, req.params.storeId, req.params.id, req.body);
  res.json(createApiResponse(result));
}));

// DELETE /api/stores/:storeId/menu/modifier-groups/:id
router.delete("/modifier-groups/:id", asyncHandler(async (req, res) => {
  const result = await deleteModifierGroup(req.user, req.params.storeId, req.params.id);
  res.json(createApiResponse(result));
}));

// POST /api/stores/:storeId/menu/modifier-groups/:groupId/options
router.post("/modifier-groups/:groupId/options", asyncHandler(async (req, res) => {
  const result = await createModifierOption(req.user, req.params.storeId, req.params.groupId, req.body);
  res.status(201).json(createApiResponse(result));
}));

// PUT /api/stores/:storeId/menu/modifier-options/:id
router.put("/modifier-options/:id", asyncHandler(async (req, res) => {
  const result = await updateModifierOption(req.user, req.params.storeId, req.params.id, req.body);
  res.json(createApiResponse(result));
}));

// DELETE /api/stores/:storeId/menu/modifier-options/:id
router.delete("/modifier-options/:id", asyncHandler(async (req, res) => {
  const result = await deleteModifierOption(req.user, req.params.storeId, req.params.id);
  res.json(createApiResponse(result));
}));

module.exports = router;
