const express = require('express');
const { createApiResponse, createHttpError } = require('@smo/shared');
const { asyncHandler } = require('../../middleware/async-handler');
const { authenticate } = require('../../middleware/auth');
const {
  listStoreMaintenanceJobs,
  updateStoreMaintenanceJobConfig,
  runStoreMaintenanceJobManual
} = require('./maintenance-service');

const router = express.Router();

router.use(authenticate);

// RBAC middleware: Only TENANT_ADMIN, STORE_MANAGER, and SUPER_ADMIN
router.use((req, res, next) => {
  const allowedRoles = ['SUPER_ADMIN', 'TENANT_ADMIN', 'STORE_MANAGER'];
  if (!allowedRoles.includes(req.user.role)) {
    return next(createHttpError(403, 'Access denied. Maintenance jobs are restricted to Tenant Admins and Store Managers.'));
  }
  next();
});

// List all jobs for the active/requested store
router.get('/', asyncHandler(async (req, res) => {
  const result = await listStoreMaintenanceJobs(req.user, req.query);
  res.json(createApiResponse(result));
}));

// Update dynamic schedule or parameters for a job
router.put('/:jobKey/config', asyncHandler(async (req, res) => {
  const result = await updateStoreMaintenanceJobConfig(req.user, req.params.jobKey, req.body);
  res.json(createApiResponse(result));
}));

// Trigger manual run on-demand
router.post('/:jobKey/run', asyncHandler(async (req, res) => {
  const result = await runStoreMaintenanceJobManual(req.user, req.params.jobKey, req.body);
  res.json(createApiResponse(result));
}));

module.exports = router;
