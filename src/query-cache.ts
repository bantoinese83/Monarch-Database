import { Document, Query } from './types';

interface CacheEntry {
  result: Document[];
  timestamp: number;
  hitCount: number;
}

export class QueryCache {
  private cache = new Map<string, CacheEntry>();
  private maxSize: number;
  private ttl: number; // time to live in milliseconds
  private accessOrder = new Map<string, number>(); // For LRU eviction
  private accessCounter = 0;

  constructor(maxSize = 100, ttl = 30000) { // 30 seconds default TTL
    this.validateCacheParameters(maxSize, ttl);
    this.maxSize = maxSize;
    this.ttl = ttl;
  }

  private validateCacheParameters(maxSize: number, ttl: number): void {
    if (!Number.isInteger(maxSize) || maxSize < 0 || maxSize > 10000) {
      throw new Error('Cache maxSize must be an integer between 0 and 10,000');
    }

    if (!Number.isInteger(ttl) || ttl < 1000 || ttl > 3600000) { // 1 second to 1 hour
      throw new Error('Cache TTL must be an integer between 1000ms and 3600000ms (1 hour)');
    }
  }

  /**
   * Generate a cache key for a query
   */
  private getCacheKey(query: Query): string {
    try {
      // Sort keys for consistent caching
      const sortedQuery = this.sortObjectKeys(query);

      // Limit key length to prevent memory issues
      const key = JSON.stringify(sortedQuery);
      if (key.length > 2048) { // 2KB limit for cache keys
        // Create a hash of the key for very complex queries
        return this.simpleHash(key);
      }

      return key;
    } catch (error) {
      // If JSON serialization fails, create a fallback key
      return `fallback_${Date.now()}_${Math.random()}`;
    }
  }

  private sortObjectKeys(obj: any): any {
    if (obj === null || typeof obj !== 'object' || Array.isArray(obj)) {
      return obj;
    }

    const sorted: any = {};
    const keys = Object.keys(obj).sort();

    for (const key of keys) {
      sorted[key] = this.sortObjectKeys(obj[key]);
    }

    return sorted;
  }

  private simpleHash(str: string): string {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return `hash_${Math.abs(hash)}`;
  }

  /**
   * Get cached result for a query
   */
  get(query: Query): Document[] | null {
    if (!query || typeof query !== 'object') {
      return null;
    }

    const key = this.getCacheKey(query);
    const entry = this.cache.get(key);

    if (!entry) {
      return null;
    }

    // Check if entry has expired
    if (Date.now() - entry.timestamp > this.ttl) {
      this.cache.delete(key);
      this.accessOrder.delete(key);
      return null;
    }

    // Update LRU tracking
    this.accessOrder.set(key, ++this.accessCounter);
    entry.hitCount++;

    return [...entry.result]; // Return a copy to prevent external mutations
  }

  /**
   * Cache a query result
   */
  set(query: Query, result: Document[]): void {
    if (!query || typeof query !== 'object') {
      throw new Error('Invalid query for caching');
    }

    if (!Array.isArray(result)) {
      throw new Error('Result must be an array of documents');
    }

    // Don't cache very large result sets to prevent memory issues
    if (result.length > 10000) {
      return; // Silently skip caching large results
    }

    // Check result size
    const resultSize = JSON.stringify(result).length;
    if (resultSize > 1024 * 1024) { // 1MB limit per cached result
      return; // Silently skip caching large results
    }

    const key = this.getCacheKey(query);

    // Evict if cache is full before adding new entry
    if (this.cache.size >= this.maxSize && !this.cache.has(key)) {
      this.evictLeastRecentlyUsed();
    }

    // Update LRU tracking
    this.accessOrder.set(key, ++this.accessCounter);

    this.cache.set(key, {
      result: [...result], // Store a copy
      timestamp: Date.now(),
      hitCount: 0
    });
  }

  private evictIfCacheFull(): void {
    if (this.cache.size >= this.maxSize) {
      this.evictLeastRecentlyUsed();
    }
  }

  private evictLeastRecentlyUsed(): void {
    if (this.cache.size === 0) return;

    // Find the key with the smallest access counter (least recently used)
    let lruKey: string | undefined;
    let minAccessCount = Infinity;

    for (const [key, accessCount] of this.accessOrder) {
      if (accessCount < minAccessCount && this.cache.has(key)) {
        minAccessCount = accessCount;
        lruKey = key;
      }
    }

    if (lruKey) {
      this.cache.delete(lruKey);
      this.accessOrder.delete(lruKey);
    }
  }

  /**
   * Invalidate cache entries that might be affected by changes to a field
   */
  invalidateByField(fieldName: string): void {
    const keysToDelete: string[] = [];

    for (const [key] of this.cache) {
      if (this.shouldInvalidateKey(key, fieldName)) {
        keysToDelete.push(key);
      }
    }

    keysToDelete.forEach(key => {
      this.cache.delete(key);
      this.accessOrder.delete(key);
    });
  }

  private shouldInvalidateKey(cacheKey: string, fieldName: string): boolean {
    try {
      const query = JSON.parse(cacheKey);
      return fieldName in query;
    } catch (error) {
      // Invalid JSON in key, remove it
      return true;
    }
  }

  /**
   * Clear all cached results
   */
  clear(): void {
    this.cache.clear();
    this.accessOrder.clear();
    this.accessCounter = 0;
  }

  /**
   * Serialize cache for persistence
   */
  serialize(): any {
    const entries: any[] = [];
    for (const [key, entry] of this.cache) {
      entries.push({
        key,
        result: entry.result,
        timestamp: entry.timestamp,
        hitCount: entry.hitCount
      });
    }

    return {
      entries,
      maxSize: this.maxSize,
      ttl: this.ttl,
      accessOrder: Array.from(this.accessOrder.entries()),
      accessCounter: this.accessCounter
    };
  }

  /**
   * Deserialize cache from persistence
   */
  deserialize(data: any): void {
    if (!data) return;

    this.cache.clear();
    this.accessOrder.clear();

    if (data.entries) {
      for (const entry of data.entries) {
        this.cache.set(entry.key, {
          result: entry.result,
          timestamp: entry.timestamp,
          hitCount: entry.hitCount
        });
      }
    }

    if (data.accessOrder) {
      for (const [key, order] of data.accessOrder) {
        this.accessOrder.set(key, order);
      }
    }

    if (data.accessCounter !== undefined) {
      this.accessCounter = data.accessCounter;
    }
  }

  /**
   * Get cache statistics
   */
  getStats(): { size: number; maxSize: number; hitRate: number } {
    let totalHits = 0;
    let totalAccesses = 0;

    for (const entry of this.cache.values()) {
      totalHits += entry.hitCount;
      totalAccesses += entry.hitCount + 1; // +1 for the initial cache set
    }

    const hitRate = totalAccesses > 0 ? totalHits / totalAccesses : 0;

    return {
      size: this.cache.size,
      maxSize: this.maxSize,
      hitRate
    };
  }
}
