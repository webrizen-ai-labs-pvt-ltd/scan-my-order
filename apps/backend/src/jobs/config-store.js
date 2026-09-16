const fs = require('fs');
const path = require('path');

const DATA_DIR = path.resolve(__dirname, '../../data');
const CONFIG_FILE = path.join(DATA_DIR, 'cron-configs.json');

// Ensure data directory exists
function ensureDataDir() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
}

// In-memory cache for fast read/write
let cache = null;

function loadAllConfigs() {
  if (cache) return cache;
  ensureDataDir();
  if (fs.existsSync(CONFIG_FILE)) {
    try {
      const content = fs.readFileSync(CONFIG_FILE, 'utf-8');
      cache = JSON.parse(content);
      return cache;
    } catch (err) {
      console.error('[CronConfigStore] Failed reading config file:', err);
    }
  }
  cache = {};
  return cache;
}

function persistConfigs() {
  ensureDataDir();
  try {
    fs.writeFileSync(CONFIG_FILE, JSON.stringify(cache || {}, null, 2), 'utf-8');
  } catch (err) {
    console.error('[CronConfigStore] Failed writing config file:', err);
  }
}

function getStoreConfig(storeId, jobKey) {
  const all = loadAllConfigs();
  const storeMap = all[storeId] || {};
  return storeMap[jobKey] || null;
}

function getStoreAllConfigs(storeId) {
  const all = loadAllConfigs();
  return all[storeId] || {};
}

function saveStoreJobConfig(storeId, jobKey, newConfig) {
  const all = loadAllConfigs();
  if (!all[storeId]) {
    all[storeId] = {};
  }
  all[storeId][jobKey] = {
    ...(all[storeId][jobKey] || {}),
    ...newConfig,
    updatedAt: new Date().toISOString()
  };
  persistConfigs();
  return all[storeId][jobKey];
}

function recordJobRun(storeId, jobKey, { status, summary, durationMs, error = null }) {
  const all = loadAllConfigs();
  if (!all[storeId]) {
    all[storeId] = {};
  }
  if (!all[storeId][jobKey]) {
    all[storeId][jobKey] = {};
  }
  all[storeId][jobKey].lastRunAt = new Date().toISOString();
  all[storeId][jobKey].lastRunStatus = status;
  all[storeId][jobKey].lastRunSummary = summary;
  all[storeId][jobKey].lastRunDurationMs = durationMs;
  if (error) {
    all[storeId][jobKey].lastRunError = error;
  } else {
    delete all[storeId][jobKey].lastRunError;
  }
  persistConfigs();
  return all[storeId][jobKey];
}

module.exports = {
  getStoreConfig,
  getStoreAllConfigs,
  saveStoreJobConfig,
  recordJobRun
};
