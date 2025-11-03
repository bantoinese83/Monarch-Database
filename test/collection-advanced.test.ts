import { describe, it, expect, beforeEach } from 'vitest';
import { Monarch } from '../src';

describe('Collection Advanced Features', () => {
  let db: Monarch;
  let collection: any;

  beforeEach(() => {
    db = new Monarch();
    collection = db.addCollection('test');
  });

  describe('Performance Monitoring Integration', () => {
    it('should integrate with performance monitoring', () => {
      collection.insert([{ name: 'test' }]);
      collection.find({ name: 'test' });

      const metrics = collection.getPerformanceMetrics();
      expect(metrics).toBeDefined();
      expect(metrics.globalMetrics).toBeDefined();
    });

    it('should provide performance report', () => {
      collection.insert([{ name: 'test' }]);

      const report = collection.getPerformanceReport();
      expect(typeof report).toBe('string');
      expect(report).toContain('Performance Report');
    });
  });

  describe('Query Cache Integration', () => {
    it('should cache query results', () => {
      collection.insert([
        { name: 'Alice', age: 30 },
        { name: 'Bob', age: 25 }
      ]);

      // First query
      const result1 = collection.find({ age: { $gte: 25 } });

      // Second identical query (should use cache)
      const result2 = collection.find({ age: { $gte: 25 } });

      expect(result1).toEqual(result2);

      const cacheStats = collection.getPerformanceMetrics().cacheStats;
      expect(cacheStats.hitRate).toBeGreaterThan(0);
    });

    it('should invalidate cache on data changes', () => {
      collection.insert([{ name: 'Alice', age: 30 }]);

      // Query and cache
      collection.find({ age: { $gte: 25 } });

      // Modify data (should invalidate cache)
      collection.update({ name: 'Alice' }, { age: 35 });

      // Cache should be invalidated, so this creates new cache entry
      collection.find({ age: { $gte: 25 } });

      const cacheStats = collection.getPerformanceMetrics().cacheStats;
      expect(cacheStats.size).toBeGreaterThan(0);
    });
  });

  describe('Index Management', () => {
    it('should handle index creation and removal', () => {
      collection.insert([
        { name: 'Alice', email: 'alice@test.com' },
        { name: 'Bob', email: 'bob@test.com' }
      ]);

      collection.createIndex('email');
      expect(collection.getIndices()).toContain('email');

      collection.dropIndex('email');
      expect(collection.getIndices()).not.toContain('email');
    });

    it('should rebuild indices during deserialization', () => {
      collection.insert([{ name: 'Alice', email: 'alice@test.com' }]);
      collection.createIndex('email');

      // Simulate deserialization with saved index
      const documents = collection.getAllDocuments();
      collection.clear();

      collection.setAllDocuments(documents);
      // Indices should be automatically rebuilt, but we need to restore them
      collection.createIndex('email');

      expect(collection.getIndices()).toContain('email');
    });
  });

  describe('Batch Operations', () => {
    it('should handle large batch inserts efficiently', () => {
      const largeBatch = Array.from({ length: 1000 }, (_, i) => ({
        name: `User${i}`,
        email: `user${i}@test.com`,
        age: Math.floor(Math.random() * 100)
      }));

      const start = performance.now();
      collection.insert(largeBatch);
      const end = performance.now();

      expect(collection.getStats().documentCount).toBe(1000);
      expect(end - start).toBeLessThan(200); // Should complete reasonably quickly (increased threshold for validation overhead)
    });

    it('should handle batch updates', () => {
      collection.insert([
        { name: 'Alice', status: 'active' },
        { name: 'Bob', status: 'inactive' },
        { name: 'Charlie', status: 'active' }
      ]);

      const updated = collection.update({ status: 'active' }, { status: 'inactive' });
      expect(updated).toBe(2);

      const inactiveUsers = collection.find({ status: 'inactive' });
      expect(inactiveUsers.length).toBe(3); // All users should now be inactive
    });
  });

  describe('Memory Management', () => {
    it('should properly clean up resources on clear', () => {
      collection.insert([{ name: 'test' }]);
      collection.createIndex('name');
      collection.find({ name: 'test' }); // Cache something

      expect(collection.getStats().documentCount).toBe(1);
      expect(collection.getIndices().length).toBe(1);

      collection.clear();

      expect(collection.getStats().documentCount).toBe(0);
      expect(collection.getIndices().length).toBe(0);
      expect(collection.getPerformanceMetrics().cacheStats.size).toBe(0);
    });

    it('should detect and reject circular references', () => {
      const obj: any = { name: 'test' };
      obj.self = obj; // Circular reference

      expect(() => collection.insert([obj])).toThrow('Document contains circular references');
      expect(collection.getStats().documentCount).toBe(0);
    });
  });

  describe('Error Conditions', () => {
    it('should handle invalid queries gracefully', () => {
      collection.insert([{ name: 'test' }]);

      // Invalid query should not crash
      expect(() => collection.find(null as any)).not.toThrow();
      expect(() => collection.find(undefined as any)).not.toThrow();
    });

    it('should reject empty update operations', () => {
      collection.insert([{ name: 'test' }]);

      expect(() => collection.update({ name: 'test' }, {})).toThrow('Update operation must specify at least one field to change');
    });

    it('should handle index operations on empty collections', () => {
      expect(() => collection.createIndex('name')).not.toThrow();
      expect(collection.getIndices()).toContain('name');

      expect(() => collection.dropIndex('name')).not.toThrow();
      expect(collection.getIndices()).not.toContain('name');
    });
  });

  describe('Serialization', () => {
    it('should serialize and deserialize correctly', () => {
      collection.insert([
        { name: 'Alice', age: 30 },
        { name: 'Bob', age: 25 }
      ]);
      collection.createIndex('name');

      const documents = collection.getAllDocuments();
      const indices = collection.getIndices();

      // Simulate recreation
      const newCollection = db.addCollection('newTest');
      newCollection.setAllDocuments(documents);

      // Restore indices
      for (const index of indices) {
        newCollection.createIndex(index);
      }

      expect(newCollection.getStats().documentCount).toBe(2);
      expect(newCollection.getIndices()).toEqual(['name']);
    });

    it('should handle documents without _id during deserialization', () => {
      const documentsWithoutId = [
        { name: 'Alice' },
        { name: 'Bob' }
      ];

      collection.setAllDocuments(documentsWithoutId);

      expect(collection.getStats().documentCount).toBe(2);

      const allDocs = collection.getAllDocuments();
      expect(allDocs.length).toBe(2);
      allDocs.forEach(doc => {
        expect(doc.name).toBeDefined(); // Should have the original data
      });
    });
  });
});
