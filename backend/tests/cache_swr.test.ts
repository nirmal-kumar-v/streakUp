import { describe, it, expect, beforeEach, vi } from 'vitest';
import { SwrCacheService } from '../src/utils/cacheService';

describe('StreakUp Backend SWR Caching & Invalidation Engine', () => {
  let cache: SwrCacheService;

  beforeEach(() => {
    cache = new SwrCacheService(100);
  });

  it('1. Returns fresh data on first fetch and caches it for immediate second return', async () => {
    let callCount = 0;
    const fetcher = async () => {
      callCount++;
      return { heatmap: [1, 2, 3], timestamp: Date.now() };
    };

    // First call: Cache miss
    const res1 = await cache.swr('heatmap:user_1', fetcher, {
      freshTtlMs: 1000,
      staleTtlMs: 5000,
      tags: ['user:user_1', 'heatmap']
    });
    expect(res1.isCached).toBe(false);
    expect(callCount).toBe(1);

    // Second call immediately: Fresh Cache hit
    const res2 = await cache.swr('heatmap:user_1', fetcher, {
      freshTtlMs: 1000,
      staleTtlMs: 5000,
      tags: ['user:user_1', 'heatmap']
    });
    expect(res2.isCached).toBe(true);
    expect(res2.isStale).toBe(false);
    expect(callCount).toBe(1); // Fetcher was NOT called again!
  });

  it('2. Enforces strict user isolation: User A data never appears for User B', async () => {
    const userAFetcher = async () => ({ secretStreak: 42, user: 'UserA' });
    const userBFetcher = async () => ({ secretStreak: 10, user: 'UserB' });

    await cache.swr('heatmap:user_A', userAFetcher, { freshTtlMs: 1000, staleTtlMs: 5000, tags: ['user:user_A'] });
    await cache.swr('heatmap:user_B', userBFetcher, { freshTtlMs: 1000, staleTtlMs: 5000, tags: ['user:user_B'] });

    const cachedA = cache.get<{ secretStreak: number; user: string }>('heatmap:user_A');
    const cachedB = cache.get<{ secretStreak: number; user: string }>('heatmap:user_B');

    expect(cachedA?.user).toBe('UserA');
    expect(cachedA?.secretStreak).toBe(42);
    expect(cachedB?.user).toBe('UserB');
    expect(cachedB?.secretStreak).toBe(10);
  });

  it('3. Serves stale data immediately while triggering background revalidation', async () => {
    let callCount = 0;
    const fetcher = async () => {
      callCount++;
      return { version: callCount };
    };

    // Initial cache with very short fresh TTL (10ms) and longer stale TTL (2000ms)
    await cache.swr('group:details:g1', fetcher, {
      freshTtlMs: 20,
      staleTtlMs: 2000,
      tags: ['group:g1']
    });
    expect(callCount).toBe(1);

    // Wait until data becomes stale but not expired
    await new Promise((r) => setTimeout(r, 35));

    // Next request: should return STALE data immediately (isStale=true, isCached=true)
    const staleRes = await cache.swr('group:details:g1', fetcher, {
      freshTtlMs: 20,
      staleTtlMs: 2000,
      tags: ['group:g1']
    });
    expect(staleRes.isCached).toBe(true);
    expect(staleRes.isStale).toBe(true);
    expect(staleRes.data.version).toBe(1); // Immediate stale version returned

    // Allow background revalidation promise microtask to complete
    await new Promise((r) => setTimeout(r, 20));
    expect(callCount).toBe(2); // Background fetch executed

    // Subsequent request gets the newly revalidated fresh data
    const freshRes = await cache.swr('group:details:g1', fetcher, {
      freshTtlMs: 1000,
      staleTtlMs: 2000,
      tags: ['group:g1']
    });
    expect(freshRes.data.version).toBe(2);
  });

  it('4. Coalesces concurrent simultaneous requests (SingleFlight / Thundering Herd Prevention)', async () => {
    let executionCount = 0;
    const heavyQuery = async () => {
      executionCount++;
      await new Promise((r) => setTimeout(r, 50)); // simulate 50ms DB query
      return { totalUsers: 100, executionCount };
    };

    // Fire 5 concurrent requests simultaneously
    const results = await Promise.all([
      cache.swr('leaderboard:global', heavyQuery, { freshTtlMs: 1000, staleTtlMs: 5000 }),
      cache.swr('leaderboard:global', heavyQuery, { freshTtlMs: 1000, staleTtlMs: 5000 }),
      cache.swr('leaderboard:global', heavyQuery, { freshTtlMs: 1000, staleTtlMs: 5000 }),
      cache.swr('leaderboard:global', heavyQuery, { freshTtlMs: 1000, staleTtlMs: 5000 }),
      cache.swr('leaderboard:global', heavyQuery, { freshTtlMs: 1000, staleTtlMs: 5000 }),
    ]);

    // All 5 requests got the exact same data
    expect(results.every((r) => r.data.totalUsers === 100)).toBe(true);
    // Crucially: Database query executed ONLY ONCE despite 5 concurrent callers!
    expect(executionCount).toBe(1);
  });

  it('5. Target invalidation clears only the relevant user/group caches on write', async () => {
    await cache.swr('heatmap:user_1', async () => 'data_user1', { freshTtlMs: 10000, staleTtlMs: 10000, tags: ['user:user_1'] });
    await cache.swr('notifications:user_1', async () => 'notifs_user1', { freshTtlMs: 10000, staleTtlMs: 10000, tags: ['user:user_1'] });
    await cache.swr('heatmap:user_2', async () => 'data_user2', { freshTtlMs: 10000, staleTtlMs: 10000, tags: ['user:user_2'] });
    await cache.swr('group:details:g1:user_1', async () => 'group_g1', { freshTtlMs: 10000, staleTtlMs: 10000, tags: ['group:g1', 'user:user_1'] });

    expect(cache.get('heatmap:user_1')).toBe('data_user1');
    expect(cache.get('heatmap:user_2')).toBe('data_user2');

    // Invalidate user 1 only (e.g. task completed)
    cache.invalidateUser('user_1');

    expect(cache.get('heatmap:user_1')).toBeNull();
    expect(cache.get('notifications:user_1')).toBeNull();
    // User 2 remains completely intact!
    expect(cache.get('heatmap:user_2')).toBe('data_user2');

    // Invalidate group g1
    cache.invalidateGroup('g1');
    expect(cache.get('group:details:g1:user_1')).toBeNull();
  });

  it('6. Admin clearAll flushes all system caches', () => {
    cache.set('heatmap:u1', { data: 1 }, { freshTtlMs: 1000, staleTtlMs: 1000 });
    cache.set('leaderboard:global', { data: 2 }, { freshTtlMs: 1000, staleTtlMs: 1000 });
    expect(cache.getStats().size).toBe(2);

    cache.clearAll();
    expect(cache.getStats().size).toBe(0);
    expect(cache.get('heatmap:u1')).toBeNull();
  });
});

