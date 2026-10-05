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

router.post("/:id/cleanup", asyncHandler(async (req, res) => {
  const { runRetentionCleanupJob } = require("../../jobs/tasks/retention-cleanup");
  // Security check: Only Tenant Admin of this tenant or Super Admin can do this
  if (req.user.role !== 'SUPER_ADMIN' && (req.user.role !== 'TENANT_ADMIN' || req.user.tenantId !== req.params.id)) {
    const { createHttpError } = require("@smo/shared");
    throw createHttpError(403, "You do not have permission to run cleanup for this tenant");
  }
  
  // Archives (never deletes) cancelled orders older than 30 days
  const result = await runRetentionCleanupJob({ tenantId: req.params.id, params: { retentionDays: 30 } });
  res.json(createApiResponse({ archivedCount: result.archivedCount, message: result.summary }));
}));

module.exports = router;
