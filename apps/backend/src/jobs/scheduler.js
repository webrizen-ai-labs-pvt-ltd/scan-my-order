const cron = require('node-cron');
const { getPrismaClient } = require('../lib/prisma');
const { JOB_REGISTRY } = require('./registry');
const {
  getStoreConfig,
  getStoreAllConfigs,
  saveStoreJobConfig,
  recordJobRun
} = require('./config-store');

// Active cron tasks map: `${storeId}:${jobKey}` => cronTask
const activeCronTasks = new Map();

function getEffectiveJobConfig(storeId, jobKey) {
  const jobMeta = JOB_REGISTRY[jobKey];
  if (!jobMeta) return null;

  const stored = getStoreConfig(storeId, jobKey) || {};
  return {
    key: jobKey,
    title: jobMeta.title,
    category: jobMeta.category,
    icon: jobMeta.icon,
    description: jobMeta.description,
    isDestructive: jobMeta.isDestructive,
    scheduleOptions: jobMeta.scheduleOptions,
    paramSchema: jobMeta.paramSchema,
    enabled: stored.enabled !== undefined ? Boolean(stored.enabled) : true,
    schedule: stored.schedule || jobMeta.defaultSchedule,
    scheduleLabel: jobMeta.scheduleOptions.find(o => o.value === (stored.schedule || jobMeta.defaultSchedule))?.label || (stored.schedule || jobMeta.defaultSchedule),
    params: {
      ...jobMeta.defaultParams,
      ...(stored.params || {})
    },
    lastRunAt: stored.lastRunAt || null,
    lastRunStatus: stored.lastRunStatus || null,
    lastRunSummary: stored.lastRunSummary || null,
    lastRunDurationMs: stored.lastRunDurationMs || null,
    lastRunError: stored.lastRunError || null
  };
}

function getAllStoreJobsEffective(storeId) {
  return Object.keys(JOB_REGISTRY).map(jobKey => getEffectiveJobConfig(storeId, jobKey));
}

async function executeJob(jobKey, { storeId, tenantId, params, triggeredBy = 'CRON' }) {
  const jobMeta = JOB_REGISTRY[jobKey];
  if (!jobMeta) {
    throw new Error(`Job ${jobKey} is not registered in JOB_REGISTRY`);
  }

  const startTime = Date.now();
  console.log(`[Scheduler] [${triggeredBy}] Starting ${jobKey} for store=${storeId || 'ALL'}, tenant=${tenantId || 'ALL'}...`);

  try {
    const result = await jobMeta.runner({
      storeId,
      tenantId,
      params: params || jobMeta.defaultParams
    });

    const durationMs = Date.now() - startTime;
    const summary = result.summary || `Completed in ${durationMs}ms`;

    if (storeId) {
      recordJobRun(storeId, jobKey, {
        status: 'SUCCESS',
        summary,
        durationMs
      });
    }

    console.log(`[Scheduler] [${triggeredBy}] Completed ${jobKey} in ${durationMs}ms: ${summary}`);
    return {
      success: true,
      jobKey,
      durationMs,
      summary,
      metrics: result
    };
  } catch (err) {
    const durationMs = Date.now() - startTime;
    console.error(`[Scheduler] [${triggeredBy}] Error in ${jobKey}:`, err);

    if (storeId) {
      recordJobRun(storeId, jobKey, {
        status: 'FAILED',
        summary: `Error: ${err.message}`,
        durationMs,
        error: err.message
      });
    }

    return {
      success: false,
      jobKey,
      durationMs,
      summary: `Failed: ${err.message}`,
      error: err.message
    };
  }
}

function scheduleSingleTask(storeId, tenantId, jobKey, schedule, params) {
  const taskKey = `${storeId}:${jobKey}`;

  // Stop previous instance if exists
  if (activeCronTasks.has(taskKey)) {
    try {
      activeCronTasks.get(taskKey).stop();
    } catch (e) {
      // ignore
    }
    activeCronTasks.delete(taskKey);
  }

  if (!cron.validate(schedule)) {
    console.warn(`[Scheduler] Invalid cron expression '${schedule}' for ${taskKey}. Task not scheduled.`);
    return false;
  }

  const task = cron.schedule(schedule, async () => {
    await executeJob(jobKey, {
      storeId,
      tenantId,
      params,
      triggeredBy: 'CRON'
    });
  });

  activeCronTasks.set(taskKey, task);
  return true;
}

async function updateAndRescheduleJob(storeId, jobKey, newConfig) {
  const jobMeta = JOB_REGISTRY[jobKey];
  if (!jobMeta) {
    throw new Error(`Invalid job key: ${jobKey}`);
  }

  // Validate cron schedule if provided
  if (newConfig.schedule && !cron.validate(newConfig.schedule)) {
    throw new Error(`Invalid cron schedule pattern: ${newConfig.schedule}`);
  }

  const saved = saveStoreJobConfig(storeId, jobKey, newConfig);

  // Fetch tenantId for this store
  const prisma = getPrismaClient();
  const store = await prisma.store.findUnique({
    where: { id: storeId },
    select: { tenantId: true }
  });
  const tenantId = store?.tenantId;

  const effective = getEffectiveJobConfig(storeId, jobKey);
  const taskKey = `${storeId}:${jobKey}`;

  if (activeCronTasks.has(taskKey)) {
    try {
      activeCronTasks.get(taskKey).stop();
    } catch (e) {
      // ignore
    }
    activeCronTasks.delete(taskKey);
  }

  if (effective.enabled) {
    scheduleSingleTask(storeId, tenantId, jobKey, effective.schedule, effective.params);
    console.log(`[Scheduler] Rescheduled ${taskKey} on '${effective.schedule}'`);
  } else {
    console.log(`[Scheduler] Disabled ${taskKey}`);
  }

  return effective;
}

async function startDynamicScheduler() {
  console.log('[Scheduler] Initializing dynamic multi-tenant cron scheduler...');
  const prisma = getPrismaClient();

  try {
    const activeStores = await prisma.store.findMany({
      where: { status: 'ACTIVE' },
      select: { id: true, tenantId: true, name: true }
    });

    console.log(`[Scheduler] Found ${activeStores.length} active store(s) to schedule.`);

    let scheduledCount = 0;
    for (const store of activeStores) {
      for (const jobKey of Object.keys(JOB_REGISTRY)) {
        const effective = getEffectiveJobConfig(store.id, jobKey);
        if (effective && effective.enabled) {
          const ok = scheduleSingleTask(
            store.id,
            store.tenantId,
            jobKey,
            effective.schedule,
            effective.params
          );
          if (ok) scheduledCount++;
        }
      }
    }

    console.log(`[Scheduler] Dynamic scheduler initialized with ${scheduledCount} active cron job(s).`);
  } catch (err) {
    console.error('[Scheduler] Failed to initialize scheduler on boot:', err);
  }
}

function stopAllSchedulerJobs() {
  console.log(`[Scheduler] Stopping ${activeCronTasks.size} active tasks...`);
  for (const [key, task] of activeCronTasks.entries()) {
    try {
      task.stop();
    } catch (e) {
      // ignore
    }
  }
  activeCronTasks.clear();
}

module.exports = {
  startDynamicScheduler,
  stopAllSchedulerJobs,
  getEffectiveJobConfig,
  getAllStoreJobsEffective,
  updateAndRescheduleJob,
  executeJob
};
