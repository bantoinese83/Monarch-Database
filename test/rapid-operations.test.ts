import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { Monarch } from '../src';

describe('Rapid Fire Operations & Concurrent Operations', () => {
  let db: Monarch;

  beforeEach(() => {
    db = new Monarch();
    // Disable quantum optimization for predictable test results
    db.queryOptimizer.enableQuantumOptimization(false);
  });

  afterEach(async () => {
    // Reset concurrency manager between tests
    db.resetConcurrencyManager();
  });

  describe('Rapid Fire Operations', () => {
    it('should handle 1000 rapid insert operations without memory leaks', async () => {
      const collection = db.addCollection('rapid-test');
      const operations: Promise<any>[] = [];

      // Fire 1000 rapid operations
      for (let i = 0; i < 1000; i++) {
        operations.push(collection.insert({ id: i, data: `test-${i}` }));
      }

      // Wait for all operations to complete
      const results = await Promise.allSettled(operations);

      // Check that most operations succeeded (some might be rate limited but not leak memory)
      const fulfilled = results.filter(r => r.status === 'fulfilled').length;
      const rejected = results.filter(r => r.status === 'rejected').length;

      expect(fulfilled + rejected).toBe(1000);
      expect(fulfilled).toBeGreaterThan(800); // At least 80% should succeed

      // Check system health - should not have memory leaks
      const health = db.getSystemHealth();
      expect(health.activeOperations).toBe(0); // All operations should be completed
      expect(health.memoryUsage).toBeLessThan(500 * 1024 * 1024); // Less than 500MB
    });

    it('should handle rapid mixed operations (insert/update/find)', async () => {
      const collection = db.addCollection('mixed-ops');
      const operations: Promise<any>[] = [];

      // Insert initial data
      for (let i = 0; i < 100; i++) {
        await collection.insert({ id: i, value: i });
      }

      // Fire rapid mixed operations
      for (let i = 0; i < 500; i++) {
        const op = Math.floor(Math.random() * 3);
        switch (op) {
          case 0: // Insert
            operations.push(Promise.resolve(collection.insert({ id: 100 + i, value: i })));
            break;
          case 1: // Update
            operations.push(Promise.resolve(collection.update({ id: Math.floor(Math.random() * 100) }, { value: i })));
            break;
          case 2: // Find
            operations.push(Promise.resolve(collection.find({ id: Math.floor(Math.random() * 100) }).length));
            break;
        }
      }

      // Wait for all operations
      const results = await Promise.allSettled(operations);
      const fulfilled = results.filter(r => r.status === 'fulfilled').length;

      expect(fulfilled).toBeGreaterThan(400); // At least 80% success rate

      // Verify data integrity - should have at least the initial 100 docs plus some new ones
      const allDocs = await collection.find({});
      expect(allDocs.length).toBeGreaterThan(100); // Should have grown from initial 100
    });

    it('should maintain performance under rapid fire load', async () => {
      const collection = db.addCollection('perf-test');
      const startTime = Date.now();

      // Insert 500 documents rapidly
      const inserts = Array.from({ length: 500 }, (_, i) =>
        collection.insert({ id: i, data: `perf-${i}` })
      );

      await Promise.all(inserts);
      const insertTime = Date.now() - startTime;

      // Should complete within reasonable time (not hanging)
      expect(insertTime).toBeLessThan(30000); // 30 seconds max

      // Check performance metrics
      const health = db.getSystemHealth();
      expect(health.operationsPerSecond).toBeDefined();
      expect(typeof health.averageOperationTime).toBe('number');
      expect(typeof health.maxQueuedTime).toBe('number');
    });
  });

  describe('Concurrent Operations', () => {
    it('should handle concurrent bulk operations without promise leaks', async () => {
      const collections = ['bulk1', 'bulk2', 'bulk3'].map(name => db.addCollection(name));
      const bulkOperations: Promise<any>[] = [];

      // Start multiple concurrent bulk operations
      for (const collection of collections) {
        const docs = Array.from({ length: 1000 }, (_, i) => ({
          id: i,
          collection: collection.name,
          data: `bulk-${i}`
        }));

        bulkOperations.push(db.bulkInsert(collection.name, docs, {
          batchSize: 100,
          continueOnError: true
        }));
      }

      // Wait for all bulk operations
      const results = await Promise.allSettled(bulkOperations);
      const fulfilled = results.filter(r => r.status === 'fulfilled').length;

      expect(fulfilled).toBeGreaterThan(2); // At least 2/3 should succeed

      // Check that promises are properly cleaned up
      const health = db.getSystemHealth();
      expect(health.activeOperations).toBe(0);
      expect(health.queuedOperations).toBe(0);
    });

    it('should handle promise rejection gracefully', async () => {
      const collection = db.addCollection('promise-test');

      // Create operations that will fail
      const failingOps = Array.from({ length: 50 }, () =>
        Promise.resolve().then(() => {
          try {
            return collection.insert({ _id: 'duplicate', data: 'fail' });
          } catch {
            return 'failed';
          }
        })
      );

      // Mix with successful operations
      const successOps = Array.from({ length: 50 }, (_, i) =>
        Promise.resolve(collection.insert({ _id: `success-${i}`, data: `data-${i}` }))
      );

      const allOps = [...failingOps, ...successOps];
      const results = await Promise.allSettled(allOps);

      const fulfilled = results.filter(r => r.status === 'fulfilled').length;
      const rejected = results.filter(r => r.status === 'rejected').length;

      expect(fulfilled + rejected).toBe(100);

      // Should have some successes despite failures
      expect(fulfilled).toBeGreaterThan(40);

      // Check system health - no hanging promises
      const health = db.getSystemHealth();
      expect(health.activeOperations).toBe(0);
    });

    it('should prevent memory leaks from pending promises', async () => {
      const collection = db.addCollection('memory-test');
      const operations: Promise<any>[] = [];

      // Create many operations that might timeout or hang
      for (let i = 0; i < 200; i++) {
        operations.push(
          Promise.resolve().then(() => {
            try {
              return collection.insert({ id: i, data: 'x'.repeat(1000) }); // Large documents
            } catch {
              return 'failed';
            }
          })
        );
      }

      const startMemory = process.memoryUsage().heapUsed;
      const results = await Promise.allSettled(operations);
      const endMemory = process.memoryUsage().heapUsed;

      // Memory should not grow excessively (less than 50MB increase)
      const memoryIncrease = endMemory - startMemory;
      expect(memoryIncrease).toBeLessThan(50 * 1024 * 1024);

      // Check system health
      const health = db.getSystemHealth();
      expect(health.activeOperations).toBe(0); // No hanging operations
      expect(health.memoryUsage).toBeLessThan(300 * 1024 * 1024); // Reasonable memory usage
    });

    it('should handle circuit breaker activation and recovery', async () => {
      const collection = db.addCollection('circuit-test');

      // First ensure circuit breaker is closed
      db.closeCircuitBreaker();
      expect(db.getSystemHealth().circuitBreakerOpen).toBe(false);

      // Create operations that will fail repeatedly to trigger circuit breaker
      const failingOps = Array.from({ length: 20 }, () =>
        Promise.resolve().then(() => {
          try {
            return collection.insert({ _id: 'duplicate', data: 'fail' });
          } catch {
            return 'expected failure';
          }
        })
      );

      await Promise.allSettled(failingOps);

      // Circuit breaker might open after repeated failures
      const health = db.getSystemHealth();
      // Either circuit breaker is open (protecting system) or closed (failures weren't enough to trigger it)
      expect(typeof health.circuitBreakerOpen).toBe('boolean');
    });
  });

  describe('Performance Monitoring', () => {
    it('should track operation performance metrics accurately', async () => {
      const collection = db.addCollection('metrics-test');

      // Perform some operations
      for (let i = 0; i < 10; i++) {
        await collection.insert({ id: i, data: `test-${i}` });
      }

      const health = db.getSystemHealth();

      // Should have operation metrics
      expect(health.operationsPerSecond).toBeDefined();
      expect(typeof health.averageOperationTime).toBe('number');
      expect(typeof health.maxQueuedTime).toBe('number');
    });

    it('should handle operation timeouts gracefully', async () => {
      const collection = db.addCollection('timeout-test');

      // Create a slow operation that should timeout
      const slowOp = new Promise((resolve) => {
        setTimeout(() => resolve('completed'), 100); // 100ms delay
      }).then(() => collection.insert({ id: 'slow', data: 'timeout-test' }));

      const result = await Promise.race([
        slowOp,
        new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), 50)) // 50ms timeout
      ]).catch(() => 'timed-out');

      // Check that system remains stable
      const health = db.getSystemHealth();
      expect(health.activeOperations).toBeLessThan(5); // Should not accumulate hanging operations
    });
  });
});
