const fs = require('fs');
const path = require('path');
const { getPrismaClient } = require('../lib/prisma');

// Legacy file store (lost on every Render deploy); imported once into the database, then renamed
const LEGACY_FILE = path.resolve(__dirname, '../../data/cron-configs.json');

const SETTING_FIELDS = ['enabled', 'schedule', 'params'];

function toPlain(row) {
  if (!row) return null;
  return {
    enabled: row.enabled ?? undefined,
    schedule: row.schedule ?? undefined,
    params: row.params ?? undefined,
    lastRunAt: row.lastRunAt ? row.lastRunAt.toISOString() : null,
    lastRunStatus: row.lastRunStatus,
    lastRunSummary: row.lastRunSummary,
    lastRunDurationMs: row.lastRunDurationMs,
    lastRunError: row.lastRunError,
    updatedAt: row.updatedAt ? row.updatedAt.toISOString() : null
  };
}

async function getStoreConfig(storeId, jobKey) {
  const row = await getPrismaClient().storeJobConfig.findUnique({
    where: { storeId_jobKey: { storeId, jobKey } }
  });
  return toPlain(row);
}

/** @returns {Promise<Record<string, object>>} jobKey -> stored config */
async function getStoreAllConfigs(storeId) {
  const rows = await getPrismaClient().storeJobConfig.findMany({ where: { storeId } });
  return Object.fromEntries(rows.map(r => [r.jobKey, toPlain(r)]));
}

/** @returns {Promise<Map<string, Record<string, object>>>} storeId -> jobKey -> stored config */
async function getAllStoresConfigs(storeIds) {
  const rows = await getPrismaClient().storeJobConfig.findMany({ where: { storeId: { in: storeIds } } });
  const byStore = new Map();
  for (const r of rows) {
    if (!byStore.has(r.storeId)) byStore.set(r.storeId, {});
    byStore.get(r.storeId)[r.jobKey] = toPlain(r);
  }
  return byStore;
}

async function saveStoreJobConfig(storeId, jobKey, newConfig) {
  const data = {};
  for (const field of SETTING_FIELDS) {
    if (newConfig[field] !== undefined) data[field] = newConfig[field];
  }
  const row = await getPrismaClient().storeJobConfig.upsert({
    where: { storeId_jobKey: { storeId, jobKey } },
    update: data,
    create: { storeId, jobKey, ...data }
  });
  return toPlain(row);
}

async function recordJobRun(storeId, jobKey, { status, summary, durationMs, error = null }) {
  const data = {
    lastRunAt: new Date(),
    lastRunStatus: status,
    lastRunSummary: summary ? String(summary).slice(0, 2000) : null,
    lastRunDurationMs: Number.isFinite(durationMs) ? Math.round(durationMs) : null,
    lastRunError: error ? String(error).slice(0, 4000) : null
  };
  const row = await getPrismaClient().storeJobConfig.upsert({
    where: { storeId_jobKey: { storeId, jobKey } },
    update: data,
    create: { storeId, jobKey, ...data }
  });
  return toPlain(row);
}

/**
 * One-time import of data/cron-configs.json. Only fills in jobs that have no database row yet,
 * so settings already in the database always win. The file is renamed afterwards.
 */
async function importLegacyFileConfigs() {
  if (!fs.existsSync(LEGACY_FILE)) return 0;
  let parsed;
  try {
    parsed = JSON.parse(fs.readFileSync(LEGACY_FILE, 'utf-8'));
  } catch (err) {
    console.warn('[CronConfigStore] Could not read legacy cron-configs.json, skipping import:', err.message);
    return 0;
  }

  const prisma = getPrismaClient();
  const storeIds = Object.keys(parsed || {});
  const existingStores = new Set(
    (await prisma.store.findMany({ where: { id: { in: storeIds } }, select: { id: true } })).map(s => s.id)
  );

  const rows = [];
  for (const storeId of storeIds) {
    if (!existingStores.has(storeId)) continue;
    for (const [jobKey, cfg] of Object.entries(parsed[storeId] || {})) {
      rows.push({
        storeId,
        jobKey,
        enabled: typeof cfg.enabled === 'boolean' ? cfg.enabled : null,
        schedule: cfg.schedule || null,
        params: cfg.params || undefined,
        lastRunAt: cfg.lastRunAt ? new Date(cfg.lastRunAt) : null,
        lastRunStatus: cfg.lastRunStatus || null,
        lastRunSummary: cfg.lastRunSummary ? String(cfg.lastRunSummary).slice(0, 2000) : null,
        lastRunDurationMs: Number.isFinite(cfg.lastRunDurationMs) ? cfg.lastRunDurationMs : null,
        lastRunError: cfg.lastRunError ? String(cfg.lastRunError).slice(0, 4000) : null
      });
    }
  }
  // skipDuplicates: rows already in the database win, and two backends importing at once can't clash
  const { count: imported } = rows.length
    ? await prisma.storeJobConfig.createMany({ data: rows, skipDuplicates: true })
    : { count: 0 };

  try {
    fs.renameSync(LEGACY_FILE, `${LEGACY_FILE}.imported`);
  } catch (err) {
    console.warn('[CronConfigStore] Imported legacy configs but could not rename the file:', err.message);
  }
  console.log(`[CronConfigStore] Imported ${imported} job config(s) from cron-configs.json into the database.`);
  return imported;
}

module.exports = {
  getStoreConfig,
  getStoreAllConfigs,
  getAllStoresConfigs,
  saveStoreJobConfig,
  recordJobRun,
  importLegacyFileConfigs
};
