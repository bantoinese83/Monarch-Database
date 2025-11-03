import { Document, Query } from './types';
import { logger } from './logger';

export type CacheStrategy = 'lru' | 'lfu' | 'adaptive';
export type CacheLevel = 'l1' | 'l2' | 'l3';

interface CacheEntry {
  result: Document[];
  timestamp: number;
  hitCount: number;
  size: number;
  compressed?: boolean;
  level: CacheLevel;
  lastAccessed: number;
  ttl?: number;
}

interface CacheLevelConfig {
  maxSize: number;
  ttl: number;
  compressionThreshold: number;
}

interface PipelineOperation<T = any> {
  id: string;
  operation: () => Promise<T>;
  priority: number;
  dependencies?: string[];
}

interface ParallelQuery {
  id: string;
  query: Query;
  collection: string;
  priority: number;
}

/**
 * Advanced caching system with pipelining, parallel processing, and multi-level caching
 */
export class AdvancedCache {
  private l1Cache = new Map<string, CacheEntry>(); // Hot data - fastest access
  private l2Cache = new Map<string, CacheEntry>(); // Warm data - moderate access
  private l3Cache = new Map<string, CacheEntry>(); // Cold data - slowest access but largest

  private accessOrder = new Map<string, number>();
  private frequencyMap = new Map<string, number>();
  private accessCounter = 0;

  private config: Record<CacheLevel, CacheLevelConfig> = {
    l1: { maxSize: 100, ttl: 30000, compressionThreshold: 1024 },      // 30s, 1KB
    l2: { maxSize: 1000, ttl: 300000, compressionThreshold: 5120 },    // 5min, 5KB
    l3: { maxSize: 10000, ttl: 1800000, compressionThreshold: 25600 }  // 30min, 25KB
  };

  private strategy: CacheStrategy = 'adaptive';
  private pipelineQueue: PipelineOperation[] = [];
  private parallelQueries: Map<string, ParallelQuery> = new Map();
  private isProcessingPipeline = false;
  private isProcessingParallel = false;

  // Performance metrics
  private metrics = {
    hits: 0,
    misses: 0,
    evictions: 0,
    compressions: 0,
    pipelineOperations: 0,
    parallelQueries: 0
  };

  constructor(strategy: CacheStrategy = 'adaptive') {
    this.strategy = strategy;
  }

  /**
   * Get cached result with multi-level lookup
   */
  async get(query: Query, collection?: string): Promise<Document[] | null> {
    const key = this.getCacheKey(query, collection);

    // Try L1 cache first (hot data)
    let entry = this.l1Cache.get(key);
    if (entry && this.isValidEntry(entry)) {
      this.recordHit(entry);
      this.promoteToL1(key, entry);
      this.metrics.hits++;
      return this.decompressResult(entry);
    }

    // Try L2 cache (warm data)
    entry = this.l2Cache.get(key);
    if (entry && this.isValidEntry(entry)) {
      this.recordHit(entry);
      this.promoteToL1(key, entry);
      this.metrics.hits++;
      return this.decompressResult(entry);
    }

    // Try L3 cache (cold data)
    entry = this.l3Cache.get(key);
    if (entry && this.isValidEntry(entry)) {
      this.recordHit(entry);
      this.promoteToL1(key, entry);
      this.metrics.hits++;
      return this.decompressResult(entry);
    }

    this.metrics.misses++;
    return null;
  }

  /**
   * Set cache entry with intelligent level placement
   */
  async set(query: Query, result: Document[], collection?: string, options?: { ttl?: number; priority?: 'high' | 'medium' | 'low' }): Promise<void> {
    const key = this.getCacheKey(query, collection);
    const size = this.calculateSize(result);
    const priority = options?.priority || 'medium';

    // Determine appropriate cache level based on size and priority
    const level = this.determineCacheLevel(size, priority);
    const config = this.config[level];

    // Compress if result is large
    const shouldCompress = size > config.compressionThreshold;
    const processedResult = shouldCompress ? this.compressResult(result) : result;

    const entry: CacheEntry = {
      result: processedResult,
      timestamp: Date.now(),
      hitCount: 0,
      size,
      compressed: shouldCompress,
      level,
      lastAccessed: Date.now(),
      ttl: options?.ttl || config.ttl
    };

    // Add to appropriate cache level
    this.addToCacheLevel(key, entry, level);

    if (shouldCompress) {
      this.metrics.compressions++;
    }
  }

  /**
   * Execute operations in a pipeline for better performance
   */
  async pipeline<T>(operations: PipelineOperation<T>[]): Promise<T[]> {
    this.pipelineQueue.push(...operations);
    this.metrics.pipelineOperations += operations.length;

    if (!this.isProcessingPipeline) {
      return this.processPipeline();
    }

    // Wait for current pipeline to complete
    return new Promise((resolve) => {
      const checkComplete = () => {
        if (!this.isProcessingPipeline) {
          resolve(this.processPipeline());
        } else {
          setTimeout(checkComplete, 10);
        }
      };
      checkComplete();
    });
  }

  /**
   * Execute queries in parallel for maximum throughput
   */
  async parallelQuery(queries: ParallelQuery[]): Promise<Map<string, Document[]>> {
    const queryMap = new Map(queries.map(q => [q.id, q]));
    this.parallelQueries = new Map([...this.parallelQueries, ...queryMap]);

    this.metrics.parallelQueries += queries.length;

    if (!this.isProcessingParallel) {
      return this.processParallelQueries();
    }

    // Wait for current parallel processing to complete
    return new Promise((resolve) => {
      const checkComplete = () => {
        if (!this.isProcessingParallel) {
          resolve(this.processParallelQueries());
        } else {
          setTimeout(checkComplete, 10);
        }
      };
      checkComplete();
    });
  }

  /**
   * Warm up cache with frequently accessed data
   */
  async warmupCache(frequentQueries: Array<{ query: Query; collection?: string; priority?: 'high' | 'medium' | 'low' }>): Promise<void> {
    logger.info('Warming up cache', { queryCount: frequentQueries.length });

    // Sort by priority for optimal loading
    const sortedQueries = frequentQueries.sort((a, b) => {
      const priorityOrder = { high: 3, medium: 2, low: 1 };
      return priorityOrder[b.priority || 'medium'] - priorityOrder[a.priority || 'medium'];
    });

    // Load in batches to avoid overwhelming the system
    const batchSize = 10;
    for (let i = 0; i < sortedQueries.length; i += batchSize) {
      const batch = sortedQueries.slice(i, i + batchSize);

      const operations: PipelineOperation[] = batch.map((item, index) => ({
        id: `warmup_${i + index}`,
        operation: async () => {
          // Simulate cache warming by setting placeholder data
          // In real implementation, this would fetch actual data
          const placeholderResult: Document[] = [{ _id: 'warmup', warmed: true }];
          await this.set(item.query, placeholderResult, item.collection, { priority: item.priority });
          return placeholderResult;
        },
        priority: item.priority === 'high' ? 3 : item.priority === 'medium' ? 2 : 1
      }));

      await this.pipeline(operations);
    }

    logger.info('Cache warmup completed');
  }

  /**
   * Prefetch related queries based on access patterns
   */
  async prefetchRelated(currentQuery: Query, collection?: string): Promise<void> {
    // Analyze query pattern and prefetch related queries
    const relatedQueries = this.generateRelatedQueries(currentQuery);

    const prefetchOperations: ParallelQuery[] = relatedQueries.map((query, index) => ({
      id: `prefetch_${Date.now()}_${index}`,
      query,
      collection: collection || 'default',
      priority: 1 // Low priority for prefetch
    }));

    if (prefetchOperations.length > 0) {
      await this.parallelQuery(prefetchOperations);
    }
  }

  /**
   * Get detailed cache statistics
   */
  getDetailedStats() {
    const totalSize = this.l1Cache.size + this.l2Cache.size + this.l3Cache.size;
    const totalHits = this.metrics.hits;
    const totalMisses = this.metrics.misses;
    const hitRate = totalHits + totalMisses > 0 ? totalHits / (totalHits + totalMisses) : 0;

    return {
      levels: {
        l1: { size: this.l1Cache.size, maxSize: this.config.l1.maxSize },
        l2: { size: this.l2Cache.size, maxSize: this.config.l2.maxSize },
        l3: { size: this.l3Cache.size, maxSize: this.config.l3.maxSize }
      },
      performance: {
        hits: totalHits,
        misses: totalMisses,
        hitRate: hitRate.toFixed(4),
        evictions: this.metrics.evictions,
        compressions: this.metrics.compressions
      },
      pipeline: {
        operationsProcessed: this.metrics.pipelineOperations,
        isProcessing: this.isProcessingPipeline
      },
      parallel: {
        queriesProcessed: this.metrics.parallelQueries,
        isProcessing: this.isProcessingParallel
      },
      strategy: this.strategy,
      totalEntries: totalSize
    };
  }

  // Private helper methods

  private getCacheKey(query: Query, collection?: string): string {
    try {
      const queryKey = JSON.stringify(this.sortObjectKeys(query));
      const collectionKey = collection || 'default';
      const fullKey = `${collectionKey}:${queryKey}`;

      if (fullKey.length > 2048) {
        return this.simpleHash(fullKey);
      }

      return fullKey;
    } catch (error) {
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
      hash = hash & hash;
    }
    return `hash_${Math.abs(hash)}`;
  }

  private isValidEntry(entry: CacheEntry): boolean {
    const now = Date.now();
    const ttl = entry.ttl || this.config[entry.level].ttl;

    return (now - entry.timestamp) < ttl;
  }

  private recordHit(entry: CacheEntry): void {
    entry.hitCount++;
    entry.lastAccessed = Date.now();

    if (this.strategy === 'lfu' || this.strategy === 'adaptive') {
      const key = Array.from(this.l1Cache.entries())
        .find(([, e]) => e === entry)?.[0] ||
        Array.from(this.l2Cache.entries())
        .find(([, e]) => e === entry)?.[0] ||
        Array.from(this.l3Cache.entries())
        .find(([, e]) => e === entry)?.[0];

      if (key) {
        this.frequencyMap.set(key, (this.frequencyMap.get(key) || 0) + 1);
      }
    }
  }

  private promoteToL1(key: string, entry: CacheEntry): void {
    // Move entry to L1 cache
    entry.level = 'l1';
    this.l1Cache.set(key, entry);

    // Remove from other levels
    this.l2Cache.delete(key);
    this.l3Cache.delete(key);
  }

  private determineCacheLevel(size: number, priority: 'high' | 'medium' | 'low'): CacheLevel {
    if (priority === 'high' || size < 1024) {
      return 'l1';
    } else if (priority === 'medium' || size < 10240) {
      return 'l2';
    } else {
      return 'l3';
    }
  }

  private addToCacheLevel(key: string, entry: CacheEntry, level: CacheLevel): void {
    const cache = this.getCacheByLevel(level);
    const config = this.config[level];

    // Evict if necessary
    if (cache.size >= config.maxSize) {
      this.evictFromLevel(level);
    }

    cache.set(key, entry);
    this.accessOrder.set(key, ++this.accessCounter);

    if (this.strategy === 'lfu' || this.strategy === 'adaptive') {
      this.frequencyMap.set(key, 1);
    }
  }

  private getCacheByLevel(level: CacheLevel): Map<string, CacheEntry> {
    switch (level) {
      case 'l1': return this.l1Cache;
      case 'l2': return this.l2Cache;
      case 'l3': return this.l3Cache;
    }
  }

  private evictFromLevel(level: CacheLevel): void {
    const cache = this.getCacheByLevel(level);

    if (cache.size === 0) return;

    let evictKey: string | undefined;

    if (this.strategy === 'lfu') {
      // Evict least frequently used
      let minFreq = Infinity;
      for (const [key] of cache) {
        const freq = this.frequencyMap.get(key) || 0;
        if (freq < minFreq) {
          minFreq = freq;
          evictKey = key;
        }
      }
    } else {
      // Evict least recently used
      let minAccess = Infinity;
      for (const [key] of cache) {
        const access = this.accessOrder.get(key) || 0;
        if (access < minAccess) {
          minAccess = access;
          evictKey = key;
        }
      }
    }

    if (evictKey) {
      cache.delete(evictKey);
      this.accessOrder.delete(evictKey);
      this.frequencyMap.delete(evictKey);
      this.metrics.evictions++;
    }
  }

  private calculateSize(result: Document[]): number {
    try {
      return JSON.stringify(result).length;
    } catch {
      return 0;
    }
  }

  private compressResult(result: Document[]): Document[] {
    // Simple compression - in production, use proper compression like LZ4
    // For demo purposes, we'll just return the result as-is
    return result;
  }

  private decompressResult(entry: CacheEntry): Document[] {
    // Simple decompression - mirror of compressResult
    return entry.result;
  }

  private async processPipeline<T>(): Promise<T[]> {
    if (this.isProcessingPipeline || this.pipelineQueue.length === 0) {
      return [];
    }

    this.isProcessingPipeline = true;

    try {
      // Sort by priority and dependencies
      this.pipelineQueue.sort((a, b) => b.priority - a.priority);

      const results: T[] = [];

      // Execute operations in batches for better performance
      const batchSize = 5;
      for (let i = 0; i < this.pipelineQueue.length; i += batchSize) {
        const batch = this.pipelineQueue.slice(i, i + batchSize);

        const batchPromises = batch.map(op => op.operation());
        const batchResults = await Promise.all(batchPromises);

        results.push(...batchResults);
      }

      this.pipelineQueue = [];
      return results;
    } finally {
      this.isProcessingPipeline = false;
    }
  }

  private async processParallelQueries(): Promise<Map<string, Document[]>> {
    if (this.isProcessingParallel || this.parallelQueries.size === 0) {
      return new Map();
    }

    this.isProcessingParallel = true;

    try {
      const results = new Map<string, Document[]>();

      // Group queries by priority
      const highPriority: ParallelQuery[] = [];
      const mediumPriority: ParallelQuery[] = [];
      const lowPriority: ParallelQuery[] = [];

      for (const query of this.parallelQueries.values()) {
        if (query.priority >= 3) highPriority.push(query);
        else if (query.priority >= 2) mediumPriority.push(query);
        else lowPriority.push(query);
      }

      // Execute high priority first
      const executeBatch = async (queries: ParallelQuery[]) => {
        const promises = queries.map(async (query) => {
          // In real implementation, this would execute the actual query
          // For demo, we'll simulate with cached results or empty arrays
          const cached = await this.get(query.query, query.collection);
          return { id: query.id, result: cached || [] };
        });

        const batchResults = await Promise.all(promises);
        for (const { id, result } of batchResults) {
          results.set(id, result);
        }
      };

      await executeBatch(highPriority);
      await executeBatch(mediumPriority);
      await executeBatch(lowPriority);

      this.parallelQueries.clear();
      return results;
    } finally {
      this.isProcessingParallel = false;
    }
  }

  private generateRelatedQueries(currentQuery: Query): Query[] {
    // Generate related queries based on current query pattern
    const related: Query[] = [];

    // Example: If querying by category, also prefetch by related categories
    if ('category' in currentQuery) {
      const category = currentQuery.category;
      if (category === 'technology') {
        related.push({ category: 'science' }, { category: 'engineering' });
      } else if (category === 'environment') {
        related.push({ category: 'climate' }, { category: 'sustainability' });
      }
    }

    // Example: If querying with date range, prefetch adjacent ranges
    if ('timestamp' in currentQuery && '$gte' in (currentQuery.timestamp as any)) {
      const gte = (currentQuery.timestamp as any).$gte;
      const lte = (currentQuery.timestamp as any).$lte || gte + 86400000; // +1 day

      related.push(
        { timestamp: { $gte: gte - 86400000, $lte: gte } }, // Previous day
        { timestamp: { $gte: lte, $lte: lte + 86400000 } }  // Next day
      );
    }

    return related.slice(0, 5); // Limit to 5 related queries
  }
}
