/**
 * utils/cache.js
 * ─────────────────────────────────────────────────────────────────────────────
 * Minimal in-memory TTL cache. One Express process, no external store needed —
 * just enough to stop every dashboard page-load from re-hitting Postgres on
 * the resource-constrained Tally VM (see config.cacheTtlMs / CACHE_TTL_SECONDS).
 */

'use strict';

function createTtlCache() {
  const store = new Map();

  /**
   * Returns the cached value for `key` if still within `ttlMs`, otherwise
   * calls `fn`, caches, and returns its result.
   */
  async function wrap(key, ttlMs, fn) {
    const hit = store.get(key);
    if (hit && Date.now() - hit.at < ttlMs) return hit.value;

    const value = await fn();
    store.set(key, { value, at: Date.now() });
    return value;
  }

  function invalidate(key) {
    if (key === undefined) store.clear();
    else store.delete(key);
  }

  return { wrap, invalidate };
}

module.exports = { createTtlCache };
