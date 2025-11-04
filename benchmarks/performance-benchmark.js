#!/usr/bin/env node

/**
 * Monarch Database Performance Benchmark Suite
 * ===========================================
 *
 * Comprehensive benchmarking tool for measuring database performance
 * across different operations, data sizes, and configurations.
 */

const { Monarch } = require('../dist/index.cjs');
const fs = require('fs');
const path = require('path');

/**
 * Check if the current module is the main entry point
 * Compatible with both CommonJS and ES module environments
 */
function isMainModule() {
  // ES module environment
  if (typeof import !== 'undefined' && import.meta && import.meta.url) {
    try {
      // Get the current file URL and compare with the main entry point
      const currentUrl = new URL(import.meta.url);
      const mainUrl = new URL(process.argv[1], `file://${process.cwd()}/`);
      return currentUrl.href === mainUrl.href;
    } catch {
      return false;
    }
  }

  // CommonJS environment
  if (typeof require !== 'undefined' && require.main) {
    return require.main === module;
  }

  // Fallback - assume not main module if we can't determine
  return false;
}

class PerformanceBenchmark {
    constructor() {
        this.db = new Monarch();
        this.results = {
            timestamp: new Date().toISOString(),
            system: this.getSystemInfo(),
            benchmarks: {}
        };
    }

    getSystemInfo() {
        return {
            platform: process.platform,
            arch: process.arch,
            nodeVersion: process.version,
            totalMemory: process.memoryUsage().heapTotal,
            cpus: require('os').cpus().length
        };
    }

    async runAllBenchmarks() {
        console.log('🚀 Starting Monarch Performance Benchmarks');
        console.log('=' .repeat(50));

        try {
            // Basic CRUD benchmarks
            await this.runCRUDBenchmarks();

            // Data structure benchmarks
            await this.runDataStructureBenchmarks();

            // Query benchmarks
            await this.runQueryBenchmarks();

            // Vector search benchmarks
            await this.runVectorSearchBenchmarks();

            // Memory and scaling benchmarks
            await this.runMemoryBenchmarks();

            // Save results
            this.saveResults();

            // Print summary
            this.printSummary();

        } catch (error) {
            console.error('❌ Benchmark failed:', error);
        } finally {
            await this.cleanup();
        }
    }

    async runCRUDBenchmarks() {
        console.log('\n📊 Running CRUD Benchmarks...');

        const benchmarks = {};
        const iterations = [100, 1000, 10000];

        for (const count of iterations) {
            console.log(`  Testing with ${count} documents...`);

            // Insert benchmark
            const insertTime = await this.benchmarkInsert(count);
            benchmarks[`insert_${count}`] = {
                operation: 'insert',
                count,
                totalTime: insertTime,
                opsPerSecond: count / (insertTime / 1000),
                avgLatency: insertTime / count
            };

            // Read benchmark
            const readTime = await this.benchmarkRead(count);
            benchmarks[`read_${count}`] = {
                operation: 'read',
                count,
                totalTime: readTime,
                opsPerSecond: count / (readTime / 1000),
                avgLatency: readTime / count
            };

            // Update benchmark
            const updateTime = await this.benchmarkUpdate(count);
            benchmarks[`update_${count}`] = {
                operation: 'update',
                count,
                totalTime: updateTime,
                opsPerSecond: count / (updateTime / 1000),
                avgLatency: updateTime / count
            };

            // Delete benchmark
            const deleteTime = await this.benchmarkDelete(count);
            benchmarks[`delete_${count}`] = {
                operation: 'delete',
                count,
                totalTime: deleteTime,
                opsPerSecond: count / (deleteTime / 1000),
                avgLatency: deleteTime / count
            };
        }

        this.results.benchmarks.crud = benchmarks;
    }

    async benchmarkInsert(count) {
        const collection = this.db.addCollection('benchmark_insert');
        const startTime = performance.now();

        for (let i = 0; i < count; i++) {
            await collection.insert({
                id: i,
                name: `Document ${i}`,
                value: Math.random(),
                timestamp: Date.now(),
                data: 'x'.repeat(100) // 100 bytes of data
            });
        }

        const endTime = performance.now();
        return endTime - startTime;
    }

    async benchmarkRead(count) {
        const collection = this.db.addCollection('benchmark_insert');
        const startTime = performance.now();

        for (let i = 0; i < count; i++) {
            await this.db.findOne('benchmark_insert', { id: Math.floor(Math.random() * count) });
        }

        const endTime = performance.now();
        return endTime - startTime;
    }

    async benchmarkUpdate(count) {
        this.db.addCollection('benchmark_insert');
        const startTime = performance.now();

        for (let i = 0; i < count; i++) {
            await this.db.update('benchmark_insert',
                { id: i },
                { updated: true, timestamp: Date.now() }
            );
        }

        const endTime = performance.now();
        return endTime - startTime;
    }

    async benchmarkDelete(count) {
        this.db.addCollection('benchmark_insert');
        const startTime = performance.now();

        for (let i = 0; i < count; i++) {
            await this.db.remove('benchmark_insert', { id: i });
        }

        const endTime = performance.now();
        this.db.removeCollection('benchmark_insert');
        return endTime - startTime;
    }

    async runDataStructureBenchmarks() {
        console.log('\n🏗️ Running Data Structure Benchmarks...');

        const benchmarks = {};

        // List operations
        benchmarks.list = await this.benchmarkListOperations(10000);

        // Set operations
        benchmarks.set = await this.benchmarkSetOperations(10000);

        // Hash operations
        benchmarks.hash = await this.benchmarkHashOperations(10000);

        // Sorted set operations
        benchmarks.sortedSet = await this.benchmarkSortedSetOperations(5000);

        this.results.benchmarks.dataStructures = benchmarks;
    }

    async benchmarkListOperations(count) {
        const results = {};

        // LPUSH operations
        const lpushStart = performance.now();
        for (let i = 0; i < count; i++) {
            await this.db.lpush('benchmark_list', `item_${i}`);
        }
        const lpushTime = performance.now() - lpushStart;

        // LPOP operations
        const lpopStart = performance.now();
        for (let i = 0; i < count; i++) {
            await this.db.lpop('benchmark_list');
        }
        const lpopTime = performance.now() - lpopStart;

        results.lpush = {
            count,
            totalTime: lpushTime,
            opsPerSecond: count / (lpushTime / 1000),
            avgLatency: lpushTime / count
        };

        results.lpop = {
            count,
            totalTime: lpopTime,
            opsPerSecond: count / (lpopTime / 1000),
            avgLatency: lpopTime / count
        };

        return results;
    }

    async benchmarkSetOperations(count) {
        const results = {};

        // SADD operations
        const saddStart = performance.now();
        for (let i = 0; i < count; i++) {
            await this.db.sadd('benchmark_set', `member_${i}`);
        }
        const saddTime = performance.now() - saddStart;

        // SISMEMBER operations
        const sismemberStart = performance.now();
        for (let i = 0; i < count; i++) {
            await this.db.sismember('benchmark_set', `member_${Math.floor(Math.random() * count)}`);
        }
        const sismemberTime = performance.now() - sismemberStart;

        results.sadd = {
            count,
            totalTime: saddTime,
            opsPerSecond: count / (saddTime / 1000),
            avgLatency: saddTime / count
        };

        results.sismember = {
            count,
            totalTime: sismemberTime,
            opsPerSecond: count / (sismemberTime / 1000),
            avgLatency: sismemberTime / count
        };

        return results;
    }

    async benchmarkHashOperations(count) {
        const results = {};

        // HSET operations
        const hsetStart = performance.now();
        for (let i = 0; i < count; i++) {
            await this.db.hset(`benchmark_hash_${i % 100}`, `field_${i}`, `value_${i}`);
        }
        const hsetTime = performance.now() - hsetStart;

        // HGET operations
        const hgetStart = performance.now();
        for (let i = 0; i < count; i++) {
            await this.db.hget(`benchmark_hash_${i % 100}`, `field_${i}`);
        }
        const hgetTime = performance.now() - hgetStart;

        results.hset = {
            count,
            totalTime: hsetTime,
            opsPerSecond: count / (hsetTime / 1000),
            avgLatency: hsetTime / count
        };

        results.hget = {
            count,
            totalTime: hgetTime,
            opsPerSecond: count / (hgetTime / 1000),
            avgLatency: hgetTime / count
        };

        return results;
    }

    async benchmarkSortedSetOperations(count) {
        const results = {};

        // ZADD operations
        const zaddStart = performance.now();
        for (let i = 0; i < count; i++) {
            await this.db.zadd('benchmark_zset', { [`member_${i}`]: Math.random() * 1000 });
        }
        const zaddTime = performance.now() - zaddStart;

        // ZRANGE operations
        const zrangeStart = performance.now();
        for (let i = 0; i < Math.min(count, 1000); i++) {
            await this.db.zrange('benchmark_zset', 0, 10);
        }
        const zrangeTime = performance.now() - zrangeStart;

        results.zadd = {
            count,
            totalTime: zaddTime,
            opsPerSecond: count / (zaddTime / 1000),
            avgLatency: zaddTime / count
        };

        results.zrange = {
            count: Math.min(count, 1000),
            totalTime: zrangeTime,
            opsPerSecond: Math.min(count, 1000) / (zrangeTime / 1000),
            avgLatency: zrangeTime / Math.min(count, 1000)
        };

        return results;
    }

    async runQueryBenchmarks() {
        console.log('\n🔍 Running Query Benchmarks...');

        const benchmarks = {};

        // Setup test data
        await this.setupQueryTestData(10000);

        // Simple queries
        benchmarks.simple = await this.benchmarkSimpleQueries();

        // Complex queries
        benchmarks.complex = await this.benchmarkComplexQueries();

        // Indexed queries
        benchmarks.indexed = await this.benchmarkIndexedQueries();

        // Aggregation queries
        benchmarks.aggregation = await this.benchmarkAggregationQueries();

        this.results.benchmarks.queries = benchmarks;
    }

    async setupQueryTestData(count) {
        const collection = this.db.addCollection('benchmark_queries');

        for (let i = 0; i < count; i++) {
            await collection.insert({
                id: i,
                name: `User ${i}`,
                age: Math.floor(Math.random() * 80) + 18,
                city: ['New York', 'London', 'Tokyo', 'Paris', 'Sydney'][Math.floor(Math.random() * 5)],
                department: ['Engineering', 'Sales', 'Marketing', 'HR', 'Finance'][Math.floor(Math.random() * 5)],
                salary: Math.floor(Math.random() * 100000) + 30000,
                active: Math.random() > 0.1,
                tags: ['tag1', 'tag2', 'tag3'].slice(0, Math.floor(Math.random() * 3) + 1)
            });
        }

        // Create indexes
        await collection.createIndex('age');
        await collection.createIndex('department');
        await collection.createIndex('city');
    }

    async benchmarkSimpleQueries() {
        const collection = this.db.collection('benchmark_queries');
        const iterations = 1000;

        const startTime = performance.now();
        for (let i = 0; i < iterations; i++) {
            await collection.find({ active: true });
        }
        const totalTime = performance.now() - startTime;

        return {
            operation: 'simple_query',
            iterations,
            totalTime,
            opsPerSecond: iterations / (totalTime / 1000),
            avgLatency: totalTime / iterations
        };
    }

    async benchmarkComplexQueries() {
        const collection = this.db.collection('benchmark_queries');
        const iterations = 500;

        const startTime = performance.now();
        for (let i = 0; i < iterations; i++) {
            await collection.find({
                age: { $gte: 25, $lte: 65 },
                department: 'Engineering',
                active: true,
                salary: { $gt: 50000 }
            });
        }
        const totalTime = performance.now() - startTime;

        return {
            operation: 'complex_query',
            iterations,
            totalTime,
            opsPerSecond: iterations / (totalTime / 1000),
            avgLatency: totalTime / iterations
        };
    }

    async benchmarkIndexedQueries() {
        const collection = this.db.collection('benchmark_queries');
        const iterations = 1000;

        const startTime = performance.now();
        for (let i = 0; i < iterations; i++) {
            await collection.find({
                department: 'Engineering',
                age: { $gte: 30 }
            });
        }
        const totalTime = performance.now() - startTime;

        return {
            operation: 'indexed_query',
            iterations,
            totalTime,
            opsPerSecond: iterations / (totalTime / 1000),
            avgLatency: totalTime / iterations
        };
    }

    async benchmarkAggregationQueries() {
        const collection = this.db.collection('benchmark_queries');
        const iterations = 100;

        const startTime = performance.now();
        for (let i = 0; i < iterations; i++) {
            await collection.aggregate([
                { $match: { active: true } },
                { $group: {
                    _id: '$department',
                    count: { $sum: 1 },
                    avgSalary: { $avg: '$salary' },
                    minAge: { $min: '$age' },
                    maxAge: { $max: '$age' }
                }},
                { $sort: { count: -1 } }
            ]);
        }
        const totalTime = performance.now() - startTime;

        return {
            operation: 'aggregation_query',
            iterations,
            totalTime,
            opsPerSecond: iterations / (totalTime / 1000),
            avgLatency: totalTime / iterations
        };
    }

    async runVectorSearchBenchmarks() {
        console.log('\n🧠 Running Vector Search Benchmarks...');

        const benchmarks = {};

        // Setup vector data
        await this.setupVectorTestData(5000);

        // Exact search (small dataset)
        benchmarks.exact_small = await this.benchmarkVectorSearch(100, 100);

        // Approximate search (larger dataset)
        benchmarks.approx_large = await this.benchmarkVectorSearch(1000, 500);

        this.results.benchmarks.vectorSearch = benchmarks;
    }

    async setupVectorTestData(count) {
        for (let i = 0; i < count; i++) {
            const vector = Array.from({ length: 128 }, () => Math.random());
            await this.db.vadd('benchmark_vectors', `vec_${i}`, vector, {
                category: ['image', 'text', 'audio'][Math.floor(Math.random() * 3)],
                metadata: `item_${i}`
            });
        }
    }

    async benchmarkVectorSearch(datasetSize, queryCount) {
        const results = [];

        for (let i = 0; i < queryCount; i++) {
            const queryVector = Array.from({ length: 128 }, () => Math.random());
            const startTime = performance.now();

            const searchResults = await this.db.vsearch('benchmark_vectors', queryVector, 10);

            const endTime = performance.now();
            results.push({
                queryTime: endTime - startTime,
                resultsFound: searchResults.length,
                topScore: searchResults[0]?.score || 0
            });
        }

        const avgTime = results.reduce((sum, r) => sum + r.queryTime, 0) / results.length;
        const avgResults = results.reduce((sum, r) => sum + r.resultsFound, 0) / results.length;

        return {
            operation: 'vector_search',
            datasetSize,
            queryCount,
            avgQueryTime: avgTime,
            opsPerSecond: queryCount / ((results.reduce((sum, r) => sum + r.queryTime, 0)) / 1000),
            avgResultsFound: avgResults
        };
    }

    async runMemoryBenchmarks() {
        console.log('\n🧠 Running Memory Benchmarks...');

        const benchmarks = {};

        // Memory usage scaling
        benchmarks.memoryScaling = await this.benchmarkMemoryScaling();

        // Cache performance
        benchmarks.cachePerformance = await this.benchmarkCachePerformance();

        this.results.benchmarks.memory = benchmarks;
    }

    async benchmarkMemoryScaling() {
        const results = [];
        const sizes = [1000, 5000, 10000, 25000];

        for (const size of sizes) {
            // Clear previous data
            await this.cleanupCollections();

            const startMemory = process.memoryUsage().heapUsed;

            // Insert data
            const collection = this.db.addCollection('memory_test');
            for (let i = 0; i < size; i++) {
                await collection.insert({
                    id: i,
                    data: 'x'.repeat(1000) // 1KB per document
                });
            }

            const endMemory = process.memoryUsage().heapUsed;
            const memoryUsed = endMemory - startMemory;

            results.push({
                documentCount: size,
                memoryUsed,
                bytesPerDocument: memoryUsed / size,
                memoryEfficiency: (1000 * size) / memoryUsed // data size / memory used
            });
        }

        return results;
    }

    async benchmarkCachePerformance() {
        const collection = this.db.collection('memory_test');
        const iterations = 1000;

        // Warm up cache
        for (let i = 0; i < 100; i++) {
            await collection.findOne({ id: i });
        }

        // Benchmark cached queries
        const startTime = performance.now();
        for (let i = 0; i < iterations; i++) {
            await collection.findOne({ id: i % 100 });
        }
        const cachedTime = performance.now() - startTime;

        // Benchmark uncached queries
        const uncachedStart = performance.now();
        for (let i = 0; i < iterations; i++) {
            await collection.findOne({ id: 100 + (i % 100) }); // Different range
        }
        const uncachedTime = performance.now() - uncachedStart;

        return {
            iterations,
            cachedTime,
            uncachedTime,
            cacheSpeedup: uncachedTime / cachedTime,
            cachedOpsPerSecond: iterations / (cachedTime / 1000),
            uncachedOpsPerSecond: iterations / (uncachedTime / 1000)
        };
    }

    async cleanupCollections() {
        const collections = await this.db.listCollections();
        for (const collection of collections) {
            if (collection.startsWith('benchmark_') || collection.startsWith('memory_')) {
                await this.db.dropCollection(collection);
            }
        }
    }

    async cleanup() {
        await this.cleanupCollections();
    }

    saveResults() {
        const filename = `benchmark-results-${Date.now()}.json`;
        const filepath = path.join(__dirname, '..', 'benchmarks', filename);

        fs.writeFileSync(filepath, JSON.stringify(this.results, null, 2));
        console.log(`\n💾 Results saved to: ${filepath}`);
    }

    printSummary() {
        console.log('\n📊 PERFORMANCE SUMMARY');
        console.log('=' .repeat(50));

        const crud = this.results.benchmarks.crud;
        if (crud) {
            console.log('\n🚀 CRUD Operations (10k docs):');
            console.log(`  Insert: ${crud.insert_10000.opsPerSecond.toFixed(0)} ops/sec`);
            console.log(`  Read:   ${crud.read_10000.opsPerSecond.toFixed(0)} ops/sec`);
            console.log(`  Update: ${crud.update_10000.opsPerSecond.toFixed(0)} ops/sec`);
            console.log(`  Delete: ${crud.delete_10000.opsPerSecond.toFixed(0)} ops/sec`);
        }

        const ds = this.results.benchmarks.dataStructures;
        if (ds) {
            console.log('\n🏗️ Data Structures (10k ops):');
            console.log(`  List Push: ${ds.list?.lpush?.opsPerSecond.toFixed(0)} ops/sec`);
            console.log(`  Set Add:   ${ds.set?.sadd?.opsPerSecond.toFixed(0)} ops/sec`);
            console.log(`  Hash Set:  ${ds.hash?.hset?.opsPerSecond.toFixed(0)} ops/sec`);
            console.log(`  ZSet Add:  ${ds.sortedSet?.zadd?.opsPerSecond.toFixed(0)} ops/sec`);
        }

        const queries = this.results.benchmarks.queries;
        if (queries) {
            console.log('\n🔍 Query Performance:');
            console.log(`  Simple:     ${queries.simple?.opsPerSecond.toFixed(0)} ops/sec`);
            console.log(`  Complex:    ${queries.complex?.opsPerSecond.toFixed(0)} ops/sec`);
            console.log(`  Indexed:    ${queries.indexed?.opsPerSecond.toFixed(0)} ops/sec`);
            console.log(`  Aggregation:${queries.aggregation?.opsPerSecond.toFixed(0)} ops/sec`);
        }

        const vector = this.results.benchmarks.vectorSearch;
        if (vector) {
            console.log('\n🧠 Vector Search (5k vectors):');
            console.log(`  Exact Search:  ${vector.exact_small?.opsPerSecond.toFixed(0)} ops/sec`);
            console.log(`  Approx Search: ${vector.approx_large?.opsPerSecond.toFixed(0)} ops/sec`);
        }

        const memory = this.results.benchmarks.memory;
        if (memory && memory.cachePerformance) {
            console.log('\n⚡ Cache Performance:');
            console.log(`  Cache Speedup: ${memory.cachePerformance.cacheSpeedup.toFixed(1)}x`);
            console.log(`  Cached Queries: ${memory.cachePerformance.cachedOpsPerSecond.toFixed(0)} ops/sec`);
        }

        console.log('\n✅ Benchmark complete!');
        console.log('📈 Results saved to benchmarks/ directory');
    }
}

// CLI runner
async function main() {
    const benchmark = new PerformanceBenchmark();
    await benchmark.runAllBenchmarks();
}

if (isMainModule()) {
    main().catch(console.error);
}

module.exports = { PerformanceBenchmark };
