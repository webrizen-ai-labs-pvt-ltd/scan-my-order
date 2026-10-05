import { useCallback, useEffect, useState } from 'react';
import api from '../lib/api';

/* ─────────────────────────────────────────────────────────────────
   Stale-while-revalidate cache for POS store data
   - In-memory Map (fast path) + sessionStorage (survives reloads)
   - <60s old → skip refetch; >30min old → treat as missing
   - Per-store request de-duplication
   ───────────────────────────────────────────────────────────────── */
const CACHE_TTL_MS = 60_000;
const CACHE_MAX_AGE_MS = 30 * 60_000;
const STORAGE_PREFIX = 'pos_cache_v3:';
const RESOURCES = ['menu', 'tables', 'store', 'promos'];

const memory = new Map();
const inflight = new Map();

const storage = (() => {
  try {
    const probe = '__pos_probe__';
    window.sessionStorage.setItem(probe, '1');
    window.sessionStorage.removeItem(probe);
    return window.sessionStorage;
  } catch {
    return null;
  }
})();

const cacheKey = (storeId, resource) => `${storeId}:${resource}`;

function readCache(storeId, resource) {
  if (!storeId) return null;
  const k = cacheKey(storeId, resource);
  let entry = memory.get(k);
  if (!entry && storage) {
    try {
      const raw = storage.getItem(STORAGE_PREFIX + k);
      if (raw) entry = JSON.parse(raw);
    } catch {
      entry = null;
    }
  }
  if (!entry) return null;
  if (Date.now() - entry.ts > CACHE_MAX_AGE_MS) {
    memory.delete(k);
    try { storage?.removeItem(STORAGE_PREFIX + k); } catch { /* noop */ }
    return null;
  }
  memory.set(k, entry);
  return entry;
}

function writeCache(storeId, resource, data) {
  if (!storeId) return;
  const k = cacheKey(storeId, resource);
  const entry = { data, ts: Date.now() };
  memory.set(k, entry);
  try { storage?.setItem(STORAGE_PREFIX + k, JSON.stringify(entry)); } catch { /* quota */ }
}

const isFresh = (entry) => Boolean(entry) && Date.now() - entry.ts < CACHE_TTL_MS;

function fetchBundle(storeId) {
  if (inflight.has(storeId)) return inflight.get(storeId);
  const promise = Promise.allSettled([
    api.get(`/stores/${storeId}/menu`),
    api.get(`/stores/${storeId}/tables`),
    api.get(`/stores/${storeId}`),
    api.get(`/stores/${storeId}/promos`),
  ]).then((results) => {
    const out = {};
    results.forEach((r, i) => {
      const resource = RESOURCES[i];
      if (r.status === 'fulfilled' && r.value.data?.success) {
        let data = r.value.data.data;
        if (resource === 'tables') data = (data || []).filter(t => t.isActive);
        if (resource === 'menu' || resource === 'promos') data = data || [];
        writeCache(storeId, resource, data);
        out[resource] = data;
      } else if (r.status === 'rejected') {
        out[`${resource}Error`] = r.reason?.response?.data?.error?.message || r.reason?.message || 'Request failed';
      }
    });
    return out;
  });
  inflight.set(storeId, promise);
  promise.finally(() => inflight.delete(storeId));
  return promise;
}

/**
 * Menu, tables, store details and promos for the POS, served from cache first.
 */
export function usePosStoreData(storeId) {
  const [state, setState] = useState(() => {
    const snap = Object.fromEntries(RESOURCES.map(r => [r, readCache(storeId, r)]));
    return {
      menu: snap.menu?.data || [],
      tables: snap.tables?.data || [],
      store: snap.store?.data || null,
      promos: snap.promos?.data || [],
      isLoading: !RESOURCES.some(r => snap[r]),
      error: '',
    };
  });

  const load = useCallback(async ({ force = false } = {}) => {
    if (!storeId) return;
    const snap = Object.fromEntries(RESOURCES.map(r => [r, readCache(storeId, r)]));
    const hasAny = RESOURCES.some(r => snap[r]);

    setState(prev => ({
      ...prev,
      menu: snap.menu?.data || (hasAny ? prev.menu : []),
      tables: snap.tables?.data || (hasAny ? prev.tables : []),
      store: snap.store?.data || (hasAny ? prev.store : null),
      promos: snap.promos?.data || (hasAny ? prev.promos : []),
      isLoading: !hasAny,
      error: '',
    }));

    if (!force && RESOURCES.every(r => isFresh(snap[r]))) return;

    const fresh = await fetchBundle(storeId);
    setState(prev => ({
      menu: fresh.menu ?? prev.menu,
      tables: fresh.tables ?? prev.tables,
      store: fresh.store ?? prev.store,
      promos: fresh.promos ?? prev.promos,
      isLoading: false,
      error: !fresh.menu && !snap.menu ? (fresh.menuError || 'Failed to load menu') : '',
    }));
  }, [storeId]);

  useEffect(() => { load(); }, [load]);

  const refreshTables = useCallback(async () => {
    if (!storeId) return;
    try {
      const res = await api.get(`/stores/${storeId}/tables`);
      if (res.data.success) {
        const tables = (res.data.data || []).filter(t => t.isActive);
        writeCache(storeId, 'tables', tables);
        setState(prev => ({ ...prev, tables }));
      }
    } catch (err) {
      console.error('Failed to refresh tables:', err);
    }
  }, [storeId]);

  const reload = useCallback(() => load({ force: true }), [load]);
  return { ...state, reload, refreshTables };
}
