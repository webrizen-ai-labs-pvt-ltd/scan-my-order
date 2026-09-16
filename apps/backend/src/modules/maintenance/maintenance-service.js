const { createHttpError } = require('@smo/shared');
const { getPrismaClient } = require('../../lib/prisma');
const {
  getAllStoreJobsEffective,
  getEffectiveJobConfig,
  updateAndRescheduleJob,
  executeJob,
  JOB_REGISTRY
} = require('../../jobs');

async function resolveAuthorizedStoreId(user, requestedStoreId) {
  const prisma = getPrismaClient();

  if (user.role === 'SUPER_ADMIN') {
    if (requestedStoreId) return requestedStoreId;
    const firstStore = await prisma.store.findFirst({ select: { id: true } });
    return firstStore?.id;
  }

  if (user.role === 'TENANT_ADMIN') {
    if (requestedStoreId) {
      const store = await prisma.store.findFirst({
        where: { id: requestedStoreId, tenantId: user.tenantId }
      });
      if (!store) {
        throw createHttpError(403, 'You do not have access to this store');
      }
      return store.id;
    }
    const defaultStore = await prisma.store.findFirst({
      where: { tenantId: user.tenantId },
      select: { id: true }
    });
    if (!defaultStore) {
      throw createHttpError(404, 'No store found for your tenant account');
    }
    return defaultStore.id;
  }

  if (user.role === 'STORE_MANAGER') {
    if (!user.storeId) {
      throw createHttpError(403, 'Store Manager is not assigned to a specific store');
    }
    if (requestedStoreId && requestedStoreId !== user.storeId) {
      throw createHttpError(403, 'Store Managers can only access and configure their assigned store');
    }
    return user.storeId;
  }

  throw createHttpError(403, 'Insufficient permissions to access maintenance jobs');
}

async function listStoreMaintenanceJobs(user, query = {}) {
  const storeId = await resolveAuthorizedStoreId(user, query.storeId);
  const jobs = getAllStoreJobsEffective(storeId);
  return {
    storeId,
    jobs
  };
}

async function updateStoreMaintenanceJobConfig(user, jobKey, body = {}) {
  if (!JOB_REGISTRY[jobKey]) {
    throw createHttpError(404, `Maintenance job '${jobKey}' not found`);
  }

  const storeId = await resolveAuthorizedStoreId(user, body.storeId);
  const { enabled, schedule, params } = body;

  const updatePayload = {};
  if (enabled !== undefined) updatePayload.enabled = Boolean(enabled);
  if (schedule !== undefined) updatePayload.schedule = schedule;
  if (params !== undefined) updatePayload.params = params;

  const updatedConfig = await updateAndRescheduleJob(storeId, jobKey, updatePayload);
  return {
    storeId,
    job: updatedConfig
  };
}

async function runStoreMaintenanceJobManual(user, jobKey, body = {}) {
  if (!JOB_REGISTRY[jobKey]) {
    throw createHttpError(404, `Maintenance job '${jobKey}' not found`);
  }

  const storeId = await resolveAuthorizedStoreId(user, body.storeId);
  const effective = getEffectiveJobConfig(storeId, jobKey);

  const result = await executeJob(jobKey, {
    storeId,
    tenantId: user.tenantId,
    params: body.params || effective.params,
    triggeredBy: `MANUAL (${user.role}: ${user.name || user.email})`
  });

  return {
    storeId,
    jobKey,
    ...result
  };
}

module.exports = {
  listStoreMaintenanceJobs,
  updateStoreMaintenanceJobConfig,
  runStoreMaintenanceJobManual
};
