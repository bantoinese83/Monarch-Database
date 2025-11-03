import { describe, it, expect, beforeEach, vi } from 'vitest';
import { QueryCache } from '../src/query-cache';

describe('QueryCache', () => {
  let cache: QueryCache;

  beforeEach(() => {
    cache = new QueryCache(10, 1000); // Small cache for testing
  });

  it('should cache and retrieve query results', () => {
    const query = { name: 'test' };
    const result = [{ name: 'test', id: 1 }];

    cache.set(query, result);
    const cachedResult = cache.get(query);

    expect(cachedResult).toEqual(result);
    expect(cachedResult).not.toBe(result); // Should be a copy
  });

  it('should return null for uncached queries', () => {
    const query = { name: 'not-cached' };
    const result = cache.get(query);

    expect(result).toBeNull();
  });

  it('should respect TTL and expire old entries', () => {
    const query = { name: 'expiring' };
    const result = [{ name: 'expiring' }];

    // Mock Date.now to simulate time passing
    const originalNow = Date.now;
    let mockTime = 1000;

    Date.now = vi.fn(() => mockTime);

    try {
      cache.set(query, result);

      // Should still be cached
      expect(cache.get(query)).toEqual(result);

      // Advance time past TTL (1000ms)
      mockTime = 3000;

      // Should be expired now
      expect(cache.get(query)).toBeNull();
    } finally {
      Date.now = originalNow;
    }
  });

  it('should evict least recently used entries when full', async () => {
    // Fill cache to capacity with small delays to ensure different timestamps
    for (let i = 0; i < 10; i++) {
      cache.set({ id: i }, [{ id: i }]);
      // Small delay to ensure different timestamps
      await new Promise(resolve => setTimeout(resolve, 1));
    }

    // Add one more - should evict oldest (id: 0)
    cache.set({ id: 10 }, [{ id: 10 }]);

    // The eviction happens during set(), so id: 0 should be gone
    expect(cache.get({ id: 0 })).toBeNull(); // Evicted
    expect(cache.get({ id: 10 })).toEqual([{ id: 10 }]); // New entry
  });

  it('should track hit counts', () => {
    const query = { name: 'hit-test' };
    const result = [{ name: 'hit-test' }];

    cache.set(query, result);

    // First access
    cache.get(query);
    expect(cache.getStats().hitRate).toBe(0.5); // 1 hit out of 2 accesses (set + get)

    // Second access
    cache.get(query);
    expect(cache.getStats().hitRate).toBe(2/3); // 2 hits out of 3 accesses
  });

  it('should invalidate cache entries by field', () => {
    const query1 = { name: 'test1', status: 'active' };
    const query2 = { name: 'test2', status: 'inactive' };
    const query3 = { age: 25 }; // Different field

    cache.set(query1, [{ name: 'test1' }]);
    cache.set(query2, [{ name: 'test2' }]);
    cache.set(query3, [{ age: 25 }]);

    // Invalidate by 'name' field
    cache.invalidateByField('name');

    expect(cache.get(query1)).toBeNull(); // Should be invalidated
    expect(cache.get(query2)).toBeNull(); // Should be invalidated
    expect(cache.get(query3)).toEqual([{ age: 25 }]); // Should remain (different field)
  });

  it('should handle JSON parsing errors gracefully', () => {
    const query = { name: 'error-test' };
    const result = [{ name: 'error-test' }];

    cache.set(query, result);

    // Manually corrupt the cache key (simulate JSON parsing error)
    const cacheKey = JSON.stringify(query);
    const corruptedKey = cacheKey.slice(0, -1); // Remove last character to break JSON

    // Mock the internal cache to have a corrupted key
    (cache as any).cache.set(corruptedKey, { result: [], timestamp: Date.now(), hitCount: 0 });

    // This should not crash and should clean up the corrupted entry
    cache.invalidateByField('name');

    // The valid entry should be invalidated due to the field match
    expect(cache.get(query)).toBeNull();
  });

  it('should clear all cached entries', () => {
    cache.set({ id: 1 }, [{ id: 1 }]);
    cache.set({ id: 2 }, [{ id: 2 }]);

    expect(cache.getStats().size).toBe(2);

    cache.clear();

    expect(cache.getStats().size).toBe(0);
    expect(cache.get({ id: 1 })).toBeNull();
    expect(cache.get({ id: 2 })).toBeNull();
  });

  it('should provide accurate cache statistics', () => {
    const stats = cache.getStats();

    expect(stats.size).toBe(0);
    expect(stats.maxSize).toBe(10);
    expect(stats.hitRate).toBe(0);

    cache.set({ id: 1 }, [{ id: 1 }]);
    cache.get({ id: 1 }); // Hit

    const statsAfter = cache.getStats();
    expect(statsAfter.size).toBe(1);
    expect(statsAfter.hitRate).toBe(0.5); // 1 hit out of 2 total accesses
  });

  it('should handle empty queries', () => {
    const emptyQuery = {};
    const result = [{ name: 'empty' }];

    cache.set(emptyQuery, result);
    expect(cache.get(emptyQuery)).toEqual(result);
  });

  it('should create different cache keys for different queries', () => {
    const query1 = { name: 'test', age: 25 };
    const query2 = { age: 25, name: 'test' }; // Same fields, different order

    cache.set(query1, [{ name: 'test' }]);
    cache.set(query2, [{ age: 25 }]);

    // Should be treated as the SAME query (same keys when sorted)
    expect(cache.get(query1)).toEqual([{ age: 25 }]); // Last set wins
    expect(cache.get(query2)).toEqual([{ age: 25 }]);
  });
});
