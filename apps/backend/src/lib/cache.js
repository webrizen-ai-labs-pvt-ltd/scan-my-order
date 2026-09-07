/**
 * Lightweight in-memory TTL Cache
 * Useful for reducing repetitive database lookups on hot paths (e.g. auth user checks, tenant subscriptions).
 */
class MemoryCache {
  constructor(defaultTtlMs = 60000, maxEntries = 5000) {
    this.defaultTtlMs = defaultTtlMs;
    this.maxEntries = maxEntries;
    this.store = new Map();

    // Periodic sweep every 2 minutes
    this.cleanupTimer = setInterval(() => {
      this.purgeExpired();
    }, 120000);
    if (this.cleanupTimer.unref) {
      this.cleanupTimer.unref();
    }
  }

  get(key) {
    const entry = this.store.get(key);
    if (!entry) return null;

    if (Date.now() > entry.expiresAt) {
      this.store.delete(key);
      return null;
    }

    return entry.value;
  }

  set(key, value, ttlMs = this.defaultTtlMs) {
    if (this.store.size >= this.maxEntries) {
      // Evict oldest inserted key
      const firstKey = this.store.keys().next().value;
      if (firstKey) this.store.delete(firstKey);
    }

    this.store.set(key, {
      value,
      expiresAt: Date.now() + ttlMs
    });
  }

  del(key) {
    this.store.delete(key);
  }

  purgeExpired() {
    const now = Date.now();
    for (const [key, entry] of this.store.entries()) {
      if (now > entry.expiresAt) {
        this.store.delete(key);
      }
    }
  }

  clear() {
    this.store.clear();
  }
}

// Dedicated singletons for specific concerns
const authUserCache = new MemoryCache(30000, 2000); // 30s TTL
const storeTenantCache = new MemoryCache(300000, 1000); // 5 min TTL
const tenantSubscriptionCache = new MemoryCache(60000, 1000); // 60s TTL
const publicMenuCache = new MemoryCache(30000, 500); // 30s TTL

module.exports = {
  MemoryCache,
  authUserCache,
  storeTenantCache,
  tenantSubscriptionCache,
  publicMenuCache
};
