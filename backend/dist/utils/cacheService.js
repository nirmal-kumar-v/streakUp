"use strict";
/**
 * StreakUp Backend SWR (Stale-While-Revalidate) Cache Engine
 *
 * Provides:
 * 1. High-speed in-memory caching with strict per-user and per-group isolation.
 * 2. True Stale-While-Revalidate (SWR): Returns stale data instantly while refreshing in the background.
 * 3. Inflight Request Coalescing (SingleFlight): Prevents thundering herds by sharing inflight promises.
 * 4. Tag and pattern-based targeted invalidation on writes (completions, joins, updates).
 * 5. Bounded memory with automatic LRU / TTL eviction.
 * 6. Zero external dependencies or paid infrastructure (compatible with Node.js & Vercel serverless).
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.swrCache = exports.SwrCacheService = void 0;
class SwrCacheService {
    cache = new Map();
    inflight = new Map();
    maxEntries;
    constructor(maxEntries = 5000) {
        this.maxEntries = maxEntries;
    }
    /**
     * Fetch data using Stale-While-Revalidate pattern:
     * - FRESH: Return cached data immediately.
     * - STALE: Return cached data immediately AND trigger background revalidation.
     * - EXPIRED / MISS: Compute fresh data, coalesce concurrent requests, and cache.
     */
    async swr(key, fetcher, options) {
        const now = Date.now();
        const entry = this.cache.get(key);
        // 1. FRESH HIT: Return immediately
        if (entry && now < entry.freshUntil) {
            return { data: entry.data, isCached: true, isStale: false };
        }
        // 2. STALE HIT: Return stale data immediately, revalidate in background
        if (entry && now < entry.staleUntil) {
            // Trigger background revalidation if not already inflight
            if (!this.inflight.has(key)) {
                this.runRevalidation(key, fetcher, options).catch((err) => {
                    console.warn(`[SwrCache] Background revalidation failed for key "${key}":`, err?.message || err);
                });
            }
            return { data: entry.data, isCached: true, isStale: true };
        }
        // 3. CACHE MISS or EXPIRED: Wait for fresh data with inflight deduplication
        const freshData = await this.getOrCreateInflight(key, fetcher, options);
        return { data: freshData, isCached: false, isStale: false };
    }
    async getOrCreateInflight(key, fetcher, options) {
        const existing = this.inflight.get(key);
        if (existing) {
            return existing;
        }
        const promise = (async () => {
            try {
                const data = await fetcher();
                this.set(key, data, options);
                return data;
            }
            finally {
                this.inflight.delete(key);
            }
        })();
        this.inflight.set(key, promise);
        return promise;
    }
    async runRevalidation(key, fetcher, options) {
        const promise = (async () => {
            try {
                const data = await fetcher();
                this.set(key, data, options);
            }
            finally {
                this.inflight.delete(key);
            }
        })();
        this.inflight.set(key, promise);
        await promise;
    }
    set(key, data, options) {
        const now = Date.now();
        // LRU eviction if over max entries
        if (this.cache.size >= this.maxEntries) {
            const oldestKey = this.cache.keys().next().value;
            if (oldestKey)
                this.cache.delete(oldestKey);
        }
        this.cache.set(key, {
            data,
            cachedAt: now,
            freshUntil: now + options.freshTtlMs,
            staleUntil: now + options.freshTtlMs + options.staleTtlMs,
            tags: options.tags || []
        });
    }
    get(key) {
        const entry = this.cache.get(key);
        if (!entry)
            return null;
        if (Date.now() > entry.staleUntil) {
            this.cache.delete(key);
            return null;
        }
        return entry.data;
    }
    /**
     * Invalidate exact key
     */
    invalidate(key) {
        this.cache.delete(key);
        this.inflight.delete(key);
    }
    /**
     * Invalidate all entries tagged with specific tag (e.g. `user:${userId}`)
     */
    invalidateTag(tag) {
        for (const [key, entry] of this.cache.entries()) {
            if (entry.tags && entry.tags.includes(tag)) {
                this.cache.delete(key);
            }
        }
    }
    /**
     * Invalidate entries whose keys match a RegExp
     */
    invalidatePattern(pattern) {
        for (const key of this.cache.keys()) {
            if (pattern.test(key)) {
                this.cache.delete(key);
            }
        }
    }
    /**
     * Invalidate all user-scoped caches (heatmaps, groups, notifications, friend boards)
     */
    invalidateUser(userId) {
        this.invalidateTag(`user:${userId}`);
        this.invalidatePattern(new RegExp(`:${userId}(:|$)`));
    }
    /**
     * Invalidate all group-scoped caches (group details, member lists, group leaderboards)
     */
    invalidateGroup(groupId) {
        this.invalidateTag(`group:${groupId}`);
        this.invalidatePattern(new RegExp(`group:.*${groupId}`));
    }
    /**
     * Clear entire cache
     */
    clearAll() {
        this.cache.clear();
        this.inflight.clear();
    }
    getStats() {
        return {
            size: this.cache.size,
            inflightCount: this.inflight.size
        };
    }
}
exports.SwrCacheService = SwrCacheService;
exports.swrCache = new SwrCacheService();
exports.default = exports.swrCache;
