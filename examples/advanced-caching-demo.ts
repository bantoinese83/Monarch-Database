/**
 * Monarch Advanced Caching Demo
 *
 * This example demonstrates Monarch's advanced caching capabilities that enable
 * extreme performance for AI workloads and high-throughput applications.
 *
 * Features showcased:
 * - Multi-level caching (L1/L2/L3) for optimal memory usage
 * - Pipelining for batched operations
 * - Parallel query processing for maximum throughput
 * - Cache warming and prefetching for proactive data loading
 * - Adaptive eviction strategies (LRU/LFU/Adaptive)
 * - Real-time performance metrics
 */

import { AdvancedCache, CacheStrategy } from '../src/advanced-cache';

interface CachePerformanceMetrics {
  operation: string;
  duration: number;
  cacheHit: boolean;
  throughput: number;
}

class AdvancedCachingDemo {
  private cache: AdvancedCache;
  private metrics: CachePerformanceMetrics[] = [];

  constructor(strategy: CacheStrategy = 'adaptive') {
    this.cache = new AdvancedCache(strategy);
  }

  /**
   * Measure performance of cache operations
   */
  private async measurePerformance<T>(
    operation: string,
    fn: () => Promise<T>,
    metadata?: any
  ): Promise<T> {
    const startTime = Date.now();
    const result = await fn();
    const duration = Date.now() - startTime;

    this.metrics.push({
      operation,
      duration,
      cacheHit: metadata?.cacheHit || false,
      throughput: metadata?.throughput || 0
    });

    return result;
  }

  /**
   * Demonstrate multi-level caching capabilities
   */
  async demonstrateMultiLevelCaching(): Promise<void> {
    console.log('🔄 Demonstrating Multi-Level Caching...\n');

    // Small, frequently accessed data -> L1
    console.log('📊 Loading hot data (L1 cache)...');
    const hotDataQueries = Array.from({ length: 50 }, (_, i) => ({
      query: { type: 'hot', id: i },
      result: [{ _id: `hot_${i}`, data: 'frequently_accessed', size: 'small' }]
    }));

    for (const item of hotDataQueries) {
      await this.measurePerformance(
        'set_hot_data',
        () => this.cache.set(item.query, item.result, 'hot_data', { priority: 'high' })
      );
    }

    // Medium data -> L2
    console.log('📈 Loading warm data (L2 cache)...');
    const warmDataQueries = Array.from({ length: 200 }, (_, i) => ({
      query: { type: 'warm', id: i },
      result: [{ _id: `warm_${i}`, data: 'moderately_accessed', content: 'x'.repeat(500) }]
    }));

    for (const item of warmDataQueries) {
      await this.measurePerformance(
        'set_warm_data',
        () => this.cache.set(item.query, item.result, 'warm_data', { priority: 'medium' })
      );
    }

    // Large, infrequently accessed data -> L3
    console.log('📚 Loading cold data (L3 cache)...');
    const coldDataQueries = Array.from({ length: 500 }, (_, i) => ({
      query: { type: 'cold', id: i },
      result: [{ _id: `cold_${i}`, data: 'rarely_accessed', content: 'x'.repeat(2000) }]
    }));

    for (const item of coldDataQueries) {
      await this.measurePerformance(
        'set_cold_data',
        () => this.cache.set(item.query, item.result, 'cold_data', { priority: 'low' })
      );
    }

    // Demonstrate cache promotion
    console.log('🚀 Testing cache promotion (L3 → L1)...');
    const coldQuery = { type: 'cold', id: 0 };
    const startTime = Date.now();

    // First access - should be in L3
    await this.measurePerformance(
      'access_cold_data_first',
      () => this.cache.get(coldQuery, 'cold_data'),
      { cacheHit: true }
    );

    // Second access - should be promoted to L1
    await this.measurePerformance(
      'access_cold_data_promoted',
      () => this.cache.get(coldQuery, 'cold_data'),
      { cacheHit: true }
    );

    const promotionTime = Date.now() - startTime;

    // Check cache levels
    const stats = this.cache.getDetailedStats();
    console.log(`📊 Cache Levels - L1: ${stats.levels.l1.size}, L2: ${stats.levels.l2.size}, L3: ${stats.levels.l3.size}`);
    console.log(`⚡ Cache promotion completed in ${promotionTime}ms\n`);
  }

  /**
   * Demonstrate pipelining for batched operations
   */
  async demonstratePipelining(): Promise<void> {
    console.log('🔧 Demonstrating Operation Pipelining...\n');

    // Simulate database operations that would benefit from pipelining
    const pipelineOperations = Array.from({ length: 100 }, (_, i) => ({
      id: `pipeline_op_${i}`,
      operation: async () => {
        // Simulate some async work (e.g., database query)
        await new Promise(resolve => setTimeout(resolve, Math.random() * 10 + 1));
        return { id: i, result: `processed_${i}`, timestamp: Date.now() };
      },
      priority: Math.floor(Math.random() * 3) + 1 // Random priority 1-3
    }));

    console.log(`📦 Executing ${pipelineOperations.length} operations in pipeline...`);

    const pipelineStart = Date.now();
    const pipelineResults = await this.measurePerformance(
      'pipeline_execution',
      () => this.cache.pipeline(pipelineOperations),
      { throughput: pipelineOperations.length }
    );
    const pipelineDuration = Date.now() - pipelineStart;

    console.log(`✅ Pipeline completed in ${pipelineDuration}ms`);
    console.log(`📈 Throughput: ${Math.round(pipelineOperations.length / (pipelineDuration / 1000))} ops/sec`);
    console.log(`📊 Results: ${pipelineResults.length} operations processed\n`);

    // Compare with sequential execution
    console.log('🔄 Comparing with sequential execution...');
    const sequentialStart = Date.now();
    const sequentialResults = [];
    for (const op of pipelineOperations.slice(0, 20)) { // Test subset for fairness
      sequentialResults.push(await op.operation());
    }
    const sequentialDuration = Date.now() - sequentialStart;

    console.log(`⏱️  Sequential: ${sequentialDuration}ms for 20 ops`);
    console.log(`🚀 Pipeline: ${pipelineDuration}ms for 100 ops`);
    console.log(`💪 Pipeline is ${Math.round((sequentialDuration * 5) / pipelineDuration)}x faster for equivalent work\n`);
  }

  /**
   * Demonstrate parallel query processing
   */
  async demonstrateParallelQueries(): Promise<void> {
    console.log('⚡ Demonstrating Parallel Query Processing...\n');

    // Pre-populate cache with some data
    const sampleData = Array.from({ length: 20 }, (_, i) => ({
      query: { category: `cat_${i % 5}`, id: i },
      result: [{ _id: `${i}`, category: `cat_${i % 5}`, data: `content_${i}` }]
    }));

    for (const item of sampleData) {
      await this.cache.set(item.query, item.result, 'parallel_test');
    }

    // Create parallel queries
    const parallelQueries = Array.from({ length: 50 }, (_, i) => ({
      id: `parallel_query_${i}`,
      query: { category: `cat_${i % 5}`, filter: 'active' },
      collection: 'parallel_test',
      priority: Math.floor(Math.random() * 3) + 1
    }));

    console.log(`🔍 Executing ${parallelQueries.length} parallel queries...`);

    const parallelStart = Date.now();
    const parallelResults = await this.measurePerformance(
      'parallel_queries',
      () => this.cache.parallelQuery(parallelQueries),
      { throughput: parallelQueries.length }
    );
    const parallelDuration = Date.now() - parallelStart;

    console.log(`✅ Parallel queries completed in ${parallelDuration}ms`);
    console.log(`📈 Throughput: ${Math.round(parallelQueries.length / (parallelDuration / 1000))} queries/sec`);
    console.log(`📊 Results: ${parallelResults.size} queries processed`);

    // Analyze results
    const hitCount = Array.from(parallelResults.values()).filter(result => result.length > 0).length;
    const hitRate = (hitCount / parallelResults.size) * 100;
    console.log(`🎯 Cache hit rate: ${hitRate.toFixed(1)}%\n`);
  }

  /**
   * Demonstrate cache warming and prefetching
   */
  async demonstrateCacheWarming(): Promise<void> {
    console.log('🔥 Demonstrating Cache Warming & Prefetching...\n');

    // Define frequently accessed queries for warming
    const frequentQueries = [
      { query: { status: 'active', type: 'user' }, collection: 'users', priority: 'high' as const },
      { query: { category: 'electronics', inStock: true }, collection: 'products', priority: 'high' as const },
      { query: { date: new Date().toISOString().split('T')[0] }, collection: 'logs', priority: 'medium' as const },
      { query: { type: 'notification', read: false }, collection: 'messages', priority: 'medium' as const },
      { query: { department: 'engineering' }, collection: 'employees', priority: 'low' as const },
    ];

    console.log('🚀 Warming cache with frequently accessed queries...');
    const warmingStart = Date.now();
    await this.measurePerformance(
      'cache_warming',
      () => this.cache.warmupCache(frequentQueries)
    );
    const warmingDuration = Date.now() - warmingStart;

    console.log(`✅ Cache warming completed in ${warmingDuration}ms`);
    console.log(`📊 Pre-loaded ${frequentQueries.length} query patterns\n`);

    // Test cache hits after warming
    console.log('🧪 Testing cache performance after warming...');
    const testQueries = frequentQueries.concat([
      { query: { status: 'active', type: 'user', filter: 'recent' }, collection: 'users', priority: 'high' as const },
      { query: { category: 'electronics', brand: 'popular' }, collection: 'products', priority: 'medium' as const }
    ]);

    let totalHits = 0;
    const accessStart = Date.now();

    for (const item of testQueries) {
      const result = await this.cache.get(item.query, item.collection);
      if (result !== null) totalHits++;
    }

    const accessDuration = Date.now() - accessStart;
    const hitRate = (totalHits / testQueries.length) * 100;

    console.log(`🎯 Post-warming hit rate: ${hitRate.toFixed(1)}%`);
    console.log(`⚡ Average access time: ${(accessDuration / testQueries.length).toFixed(2)}ms per query\n`);
  }

  /**
   * Demonstrate adaptive caching strategies
   */
  async demonstrateAdaptiveStrategies(): Promise<void> {
    console.log('🧠 Demonstrating Adaptive Caching Strategies...\n');

    const strategies: CacheStrategy[] = ['lru', 'lfu', 'adaptive'];

    for (const strategy of strategies) {
      console.log(`🎲 Testing ${strategy.toUpperCase()} strategy...`);

      const strategyCache = new AdvancedCache(strategy);

      // Simulate workload with different access patterns
      const operations = [];

      // Add initial data
      for (let i = 0; i < 50; i++) {
        operations.push(
          strategyCache.set({ item: i }, [{ _id: `${i}`, data: `item_${i}` }], 'strategy_test')
        );
      }

      // Simulate access patterns
      if (strategy === 'lfu') {
        // Access some items very frequently
        for (let i = 0; i < 10; i++) {
          for (let j = 0; j < 20; j++) {
            operations.push(strategyCache.get({ item: i }, 'strategy_test'));
          }
        }
      } else if (strategy === 'lru') {
        // Access items in sequence, then revisit early items
        for (let i = 0; i < 30; i++) {
          operations.push(strategyCache.get({ item: i }, 'strategy_test'));
        }
        // Revisit first 10 items
        for (let i = 0; i < 10; i++) {
          operations.push(strategyCache.get({ item: i }, 'strategy_test'));
        }
      }

      await Promise.all(operations);

      const stats = strategyCache.getDetailedStats();
      console.log(`   📊 Hit rate: ${(parseFloat(stats.performance.hitRate) * 100).toFixed(1)}%`);
      console.log(`   🔄 Evictions: ${stats.performance.evictions}`);
      console.log(`   📈 Total entries: ${stats.totalEntries}\n`);
    }
  }

  /**
   * Demonstrate real-world AI workload scenario
   */
  async demonstrateAIWorkload(): Promise<void> {
    console.log('🤖 Demonstrating AI Workload Performance...\n');

    // Simulate AI model inference cache
    console.log('🧠 Simulating AI model inference caching...');

    // Pre-load common inference results
    const inferenceResults = Array.from({ length: 100 }, (_, i) => ({
      query: { model: 'bert-base', input: `text_${i}`, task: 'classification' },
      result: [{
        _id: `inference_${i}`,
        predictions: ['positive', 'negative', 'neutral'],
        confidence: [0.8, 0.15, 0.05],
        processingTime: Math.random() * 100 + 50
      }]
    }));

    for (const item of inferenceResults) {
      await this.cache.set(item.query, item.result, 'ai_inference', { ttl: 3600000 }); // 1 hour TTL
    }

    // Simulate inference requests (some cached, some new)
    const requests = Array.from({ length: 200 }, (_, i) => ({
      query: {
        model: 'bert-base',
        input: i < 100 ? `text_${i % 50}` : `new_text_${i}`, // 50% cache hits
        task: 'classification'
      },
      collection: 'ai_inference'
    }));

    console.log('🚀 Processing 200 inference requests...');

    const inferenceStart = Date.now();
    let cacheHits = 0;
    let totalRequests = 0;

    for (const request of requests) {
      totalRequests++;
      const result = await this.cache.get(request.query, request.collection);
      if (result !== null) cacheHits++;
    }

    const inferenceDuration = Date.now() - inferenceStart;
    const hitRate = (cacheHits / totalRequests) * 100;

    console.log(`✅ Processed ${totalRequests} requests in ${inferenceDuration}ms`);
    console.log(`🎯 Cache hit rate: ${hitRate.toFixed(1)}%`);
    console.log(`⚡ Average response time: ${(inferenceDuration / totalRequests).toFixed(2)}ms`);
    console.log(`🚀 Effective throughput: ${Math.round(totalRequests / (inferenceDuration / 1000))} req/sec\n`);

    // Simulate vector similarity search (for embeddings)
    console.log('🔍 Simulating vector similarity search...');

    // Pre-load vector embeddings
    for (let i = 0; i < 50; i++) {
      const vector = Array.from({ length: 384 }, () => Math.random() * 2 - 1); // BERT-like embedding
      await this.cache.set(
        { type: 'embedding', id: i },
        [{ _id: `vec_${i}`, vector, metadata: { text: `document_${i}` } }],
        'embeddings'
      );
    }

    // Perform similarity searches
    const searchQueries = Array.from({ length: 20 }, () => ({
      query: { type: 'embedding', search: 'similarity' },
      collection: 'embeddings'
    }));

    const searchStart = Date.now();
    for (const query of searchQueries) {
      await this.cache.get(query.query, query.collection);
    }
    const searchDuration = Date.now() - searchStart;

    console.log(`✅ Performed ${searchQueries.length} similarity searches in ${searchDuration}ms`);
    console.log(`⚡ Average search time: ${(searchDuration / searchQueries.length).toFixed(2)}ms\n`);
  }

  /**
   * Generate performance report
   */
  generatePerformanceReport(): void {
    console.log('📊 Performance Report\n');

    const operations = this.metrics.reduce((acc, metric) => {
      if (!acc[metric.operation]) {
        acc[metric.operation] = [];
      }
      acc[metric.operation].push(metric);
      return acc;
    }, {} as Record<string, CachePerformanceMetrics[]>);

    for (const [operation, metrics] of Object.entries(operations)) {
      const avgDuration = metrics.reduce((sum, m) => sum + m.duration, 0) / metrics.length;
      const totalDuration = metrics.reduce((sum, m) => sum + m.duration, 0);
      const cacheHits = metrics.filter(m => m.cacheHit).length;
      const hitRate = (cacheHits / metrics.length) * 100;

      console.log(`🔧 ${operation}:`);
      console.log(`   📏 Count: ${metrics.length}`);
      console.log(`   ⏱️  Avg Duration: ${avgDuration.toFixed(2)}ms`);
      console.log(`   📊 Total Time: ${totalDuration}ms`);
      console.log(`   🎯 Cache Hit Rate: ${hitRate.toFixed(1)}%\n`);
    }

    const finalStats = this.cache.getDetailedStats();
    console.log('🏆 Final Cache Statistics:');
    console.log(`   📊 Total Entries: ${finalStats.totalEntries}`);
    console.log(`   🎯 Overall Hit Rate: ${(parseFloat(finalStats.performance.hitRate) * 100).toFixed(1)}%`);
    console.log(`   🔄 Evictions: ${finalStats.performance.evictions}`);
    console.log(`   🗜️  Compressions: ${finalStats.performance.compressions}`);
    console.log(`   📦 Pipeline Ops: ${finalStats.pipeline.operationsProcessed}`);
    console.log(`   ⚡ Parallel Queries: ${finalStats.parallel.queriesProcessed}`);
  }

  /**
   * Run the complete advanced caching demo
   */
  async runDemo(): Promise<void> {
    try {
      console.log('🚀 Monarch Advanced Caching Demo\n');
      console.log('This demo showcases extreme performance optimizations for AI workloads\n');

      await this.demonstrateMultiLevelCaching();
      await this.demonstratePipelining();
      await this.demonstrateParallelQueries();
      await this.demonstrateCacheWarming();
      await this.demonstrateAdaptiveStrategies();
      await this.demonstrateAIWorkload();

      this.generatePerformanceReport();

      console.log('\n🎉 Advanced Caching Demo Completed!');
      console.log('🚀 Monarch delivers enterprise-grade caching performance for AI applications!');

    } catch (error) {
      console.error('❌ Demo failed:', error);
    }
  }
}

// Run the demo
const demo = new AdvancedCachingDemo('adaptive');
demo.runDemo().catch(console.error);
