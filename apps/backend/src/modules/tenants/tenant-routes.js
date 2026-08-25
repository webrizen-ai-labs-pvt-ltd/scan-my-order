const express = require("express");
const { createApiResponse } = require("@smo/shared");
const { asyncHandler } = require("../../middleware/async-handler");
const { authenticate } = require("../../middleware/auth");
const { 
  listTenants, 
  getTenantById, 
  createTenant, 
  updateTenant, 
  deleteTenant 
} = require("./tenant-service");

const router = express.Router();

router.use(authenticate);

router.get("/", asyncHandler(async (req, res) => {
  const tenants = await listTenants(req.user, req.query);
  res.json(createApiResponse(tenants));
}));

router.get("/:id", asyncHandler(async (req, res) => {
  const tenant = await getTenantById(req.user, req.params.id);
  res.json(createApiResponse(tenant));
}));

router.post("/", asyncHandler(async (req, res) => {
  const tenant = await createTenant(req.user, req.body);
  res.status(201).json(createApiResponse(tenant));
}));

router.put("/:id", asyncHandler(async (req, res) => {
  const tenant = await updateTenant(req.user, req.params.id, req.body);
  res.json(createApiResponse(tenant));
}));

router.delete("/:id", asyncHandler(async (req, res) => {
  const result = await deleteTenant(req.user, req.params.id);
  res.json(createApiResponse(result));
}));

module.exports = router;
