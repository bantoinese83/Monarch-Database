import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Monarch, FileSystemAdapter, IndexedDBAdapter } from '../src';

describe('Monarch Advanced Features', () => {
  let db: Monarch;

  beforeEach(() => {
    db = new Monarch();
  });

  describe('Persistence Integration', () => {
    it('should create FileSystemAdapter correctly', () => {
      const adapter = Monarch.createFileSystemAdapter('/tmp/test.db');
      expect(adapter).toBeInstanceOf(FileSystemAdapter);
    });

    it('should create IndexedDBAdapter correctly', () => {
      const adapter = Monarch.createIndexedDBAdapter('test-db', 'test-store');
      expect(adapter).toBeInstanceOf(IndexedDBAdapter);
    });

    it('should accept adapter in constructor', () => {
      const adapter = Monarch.createFileSystemAdapter('/tmp/test.db');
      const dbWithAdapter = new Monarch(adapter);
      expect(dbWithAdapter).toBeInstanceOf(Monarch);
    });

    it('should save database state', async () => {
      const mockAdapter = {
        save: vi.fn().mockResolvedValue(void 0),
        load: vi.fn().mockResolvedValue({})
      };

      const db = new Monarch(mockAdapter);
      db.addCollection('users');

      await db.save();

      expect(mockAdapter.save).toHaveBeenCalledWith({
        collections: {
          users: {
            documents: [],
            indices: []
          }
        }
      });
    });

    it('should load database state', async () => {
      const mockData = {
        collections: {
          users: {
            documents: [{ name: 'test', _id: 'test-1' }],
            indices: ['name']
          }
        }
      };

      const mockAdapter = {
        save: vi.fn().mockResolvedValue(void 0),
        load: vi.fn().mockResolvedValue(mockData)
      };

      const db = new Monarch(mockAdapter);
      await db.load();

      const collection = db.getCollection('users');
      expect(collection).toBeDefined();
      expect(collection!.getStats().documentCount).toBe(1);
    });

    it('should handle save without adapter', async () => {
      await expect(db.save()).rejects.toThrow('No persistence adapter configured');
    });

    it('should handle load without adapter', async () => {
      await expect(db.load()).rejects.toThrow('No persistence adapter configured');
    });
  });

  describe('Error Handling', () => {
    it('should handle deserialization errors gracefully', async () => {
      const invalidData = { invalid: 'data' };

      const mockAdapter = {
        save: vi.fn().mockResolvedValue(void 0),
        load: vi.fn().mockResolvedValue(invalidData)
      };

      const db = new Monarch(mockAdapter);

      // Should not throw even with invalid data
      await expect(db.load()).resolves.not.toThrow();
    });

    it('should handle corrupted collection data', async () => {
      const corruptedData = {
        collections: {
          users: {
            // Missing documents and indices
          }
        }
      };

      const mockAdapter = {
        save: vi.fn().mockResolvedValue(void 0),
        load: vi.fn().mockResolvedValue(corruptedData)
      };

      const db = new Monarch(mockAdapter);
      await db.load();

      const collection = db.getCollection('users');
      expect(collection).toBeDefined();
      expect(collection!.getStats().documentCount).toBe(0);
    });
  });

  describe('Statistics and Monitoring', () => {
    it('should return correct statistics', () => {
      const users = db.addCollection('users');
      const products = db.addCollection('products');

      users.insert([
        { name: 'Alice', age: 30 },
        { name: 'Bob', age: 25 }
      ]);

      products.insert([
        { name: 'Laptop', price: 1000 }
      ]);

      const stats = db.getStats();
      expect(stats.collectionCount).toBe(2);
      expect(stats.totalDocuments).toBe(3);
    });

    it('should clear all collections', () => {
      db.addCollection('users');
      db.addCollection('products');

      expect(db.getCollectionNames().length).toBe(2);

      db.clear();

      expect(db.getCollectionNames().length).toBe(0);
      expect(db.getStats().collectionCount).toBe(0);
    });

    it('should handle collection removal', () => {
      const users = db.addCollection('users');
      users.insert([{ name: 'test' }]);

      expect(db.removeCollection('users')).toBe(true);
      expect(db.getCollection('users')).toBeUndefined();
      expect(db.removeCollection('nonexistent')).toBe(false);
    });
  });

  describe('Edge Cases', () => {
    it('should handle empty collection names', () => {
      expect(() => db.addCollection('')).toThrow('Collection name must be a non-empty string');
    });

    it('should handle special characters in collection names', () => {
      const collection = db.addCollection('test_collection-123');
      expect(collection.getName()).toBe('test_collection-123');
    });

    it('should handle multiple collections with different operations', () => {
      const users = db.addCollection('users');
      const products = db.addCollection('products');

      users.insert([{ name: 'Alice' }]);
      products.insert([{ name: 'Laptop' }, { name: 'Mouse' }]);

      users.createIndex('name');

      expect(db.getStats().totalDocuments).toBe(3);
      expect(users.getIndices()).toContain('name');
      expect(products.getIndices()).toEqual([]);
    });

    it('should maintain collection isolation', () => {
      const users = db.addCollection('users');
      const products = db.addCollection('products');

      users.insert([{ name: 'Alice' }]);
      products.insert([{ name: 'Laptop' }]);

      users.clear();

      expect(users.getStats().documentCount).toBe(0);
      expect(products.getStats().documentCount).toBe(1);
    });
  });
});
