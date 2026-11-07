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

interface CacheEntry<T> {
  data: T;
  cachedAt: number;
  freshUntil: number;
  staleUntil: number;
  tags: string[];
}

interface SwrOptions {
  /** Milliseconds the data is considered completely fresh (returns immediately, no background fetch) */
  freshTtlMs: number;
  /** Milliseconds the data can be served stale while revalidating in background */
  staleTtlMs: number;
  /** Tags for bulk invalidation (e.g. `user:${userId}`, `group:${groupId}`) */
  tags?: string[];
}

export class SwrCacheService {
  private cache = new Map<string, CacheEntry<any>>();
  private inflight = new Map<string, Promise<any>>();
  private readonly maxEntries: number;

  constructor(maxEntries = 5000) {
    this.maxEntries = maxEntries;
  }

  /**
   * Fetch data using Stale-While-Revalidate pattern:
   * - FRESH: Return cached data immediately.
   * - STALE: Return cached data immediately AND trigger background revalidation.
   * - EXPIRED / MISS: Compute fresh data, coalesce concurrent requests, and cache.
   */
  async swr<T>(
    key: string,
    fetcher: () => Promise<T>,
    options: SwrOptions
  ): Promise<{ data: T; isCached: boolean; isStale: boolean }> {
    const now = Date.now();
    const entry = this.cache.get(key);

    // 1. FRESH HIT: Return immediately
    if (entry && now < entry.freshUntil) {
      return { data: entry.data as T, isCached: true, isStale: false };
    }

    // 2. STALE HIT: Return stale data immediately, revalidate in background
    if (entry && now < entry.staleUntil) {
      // Trigger background revalidation if not already inflight
      if (!this.inflight.has(key)) {
        this.runRevalidation(key, fetcher, options).catch((err) => {
          console.warn(`[SwrCache] Background revalidation failed for key "${key}":`, err?.message || err);
        });
      }
      return { data: entry.data as T, isCached: true, isStale: true };
    }

    // 3. CACHE MISS or EXPIRED: Wait for fresh data with inflight deduplication
    const freshData = await this.getOrCreateInflight(key, fetcher, options);
    return { data: freshData, isCached: false, isStale: false };
  }

  private async getOrCreateInflight<T>(key: string, fetcher: () => Promise<T>, options: SwrOptions): Promise<T> {
    const existing = this.inflight.get(key);
    if (existing) {
      return existing as Promise<T>;
    }

    const promise = (async () => {
      try {
        const data = await fetcher();
        this.set(key, data, options);
        return data;
      } finally {
        this.inflight.delete(key);
      }
    })();

    this.inflight.set(key, promise);
    return promise;
  }

  private async runRevalidation<T>(key: string, fetcher: () => Promise<T>, options: SwrOptions): Promise<void> {
    const promise = (async () => {
      try {
        const data = await fetcher();
        this.set(key, data, options);
      } finally {
        this.inflight.delete(key);
      }
    })();
    this.inflight.set(key, promise);
    await promise;
  }

  set<T>(key: string, data: T, options: SwrOptions): void {
    const now = Date.now();
    // LRU eviction if over max entries
    if (this.cache.size >= this.maxEntries) {
      const oldestKey = this.cache.keys().next().value;
      if (oldestKey) this.cache.delete(oldestKey);
    }

    this.cache.set(key, {
      data,
      cachedAt: now,
      freshUntil: now + options.freshTtlMs,
      staleUntil: now + options.freshTtlMs + options.staleTtlMs,
      tags: options.tags || []
    });
  }

  get<T>(key: string): T | null {
    const entry = this.cache.get(key);
    if (!entry) return null;
    if (Date.now() > entry.staleUntil) {
      this.cache.delete(key);
      return null;
    }
    return entry.data as T;
  }

  /**
   * Invalidate exact key
   */
  invalidate(key: string): void {
    this.cache.delete(key);
    this.inflight.delete(key);
  }

  /**
   * Invalidate all entries tagged with specific tag (e.g. `user:${userId}`)
   */
  invalidateTag(tag: string): void {
    for (const [key, entry] of this.cache.entries()) {
      if (entry.tags && entry.tags.includes(tag)) {
        this.cache.delete(key);
      }
    }
  }

  /**
   * Invalidate entries whose keys match a RegExp
   */
  invalidatePattern(pattern: RegExp): void {
    for (const key of this.cache.keys()) {
      if (pattern.test(key)) {
        this.cache.delete(key);
      }
    }
  }

  /**
   * Invalidate all user-scoped caches (heatmaps, groups, notifications, friend boards)
   */
  invalidateUser(userId: string): void {
    this.invalidateTag(`user:${userId}`);
    this.invalidatePattern(new RegExp(`:${userId}(:|$)`));
  }

  /**
   * Invalidate all group-scoped caches (group details, member lists, group leaderboards)
   */
  invalidateGroup(groupId: string): void {
    this.invalidateTag(`group:${groupId}`);
    this.invalidatePattern(new RegExp(`group:.*${groupId}`));
  }

  /**
   * Clear entire cache
   */
  clearAll(): void {
    this.cache.clear();
    this.inflight.clear();
  }

  getStats(): { size: number; inflightCount: number } {
    return {
      size: this.cache.size,
      inflightCount: this.inflight.size
    };
  }
}

export const swrCache = new SwrCacheService();
export default swrCache;

