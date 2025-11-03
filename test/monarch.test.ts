import { describe, it, expect, beforeEach } from 'vitest';
import { Monarch, Collection } from '../src';

describe('Monarch Database', () => {
  let db: Monarch;

  beforeEach(() => {
    db = new Monarch();
  });

  describe('Database & Collection Management', () => {
    it('should create a collection', () => {
      const users = db.addCollection('users');
      expect(users).toBeInstanceOf(Collection);
      expect(users.getName()).toBe('users');
    });

    it('should throw error when creating duplicate collection', () => {
      db.addCollection('users');
      expect(() => db.addCollection('users')).toThrow("Collection 'users' already exists");
    });

    it('should get an existing collection', () => {
      const users = db.addCollection('users');
      const retrieved = db.getCollection('users');
      expect(retrieved).toBe(users);
    });

    it('should return undefined for non-existent collection', () => {
      const retrieved = db.getCollection('nonexistent');
      expect(retrieved).toBeUndefined();
    });

    it('should remove a collection', () => {
      db.addCollection('users');
      const removed = db.removeCollection('users');
      expect(removed).toBe(true);
      expect(db.getCollection('users')).toBeUndefined();
    });

    it('should return false when removing non-existent collection', () => {
      const removed = db.removeCollection('nonexistent');
      expect(removed).toBe(false);
    });
  });

  describe('Core CRUD Operations', () => {
    let users: Collection;

    beforeEach(() => {
      users = db.addCollection('users');
    });

    it('should insert a single document', () => {
      const result = users.insert({ name: 'Alice', age: 30 });
      expect(result).toHaveLength(1);
      expect(result[0].name).toBe('Alice');
      expect(result[0].age).toBe(30);
      expect(result[0]._id).toBeDefined();
    });

    it('should insert multiple documents', () => {
      const docs = [
        { name: 'Alice', age: 30 },
        { name: 'Bob', age: 25 }
      ];
      const result = users.insert(docs);
      expect(result).toHaveLength(2);
      expect(result[0].name).toBe('Alice');
      expect(result[1].name).toBe('Bob');
    });

    it('should find all documents when no query provided', () => {
      users.insert([
        { name: 'Alice', age: 30 },
        { name: 'Bob', age: 25 }
      ]);

      const result = users.find();
      expect(result).toHaveLength(2);
    });

    it('should find documents by exact match', () => {
      users.insert([
        { name: 'Alice', age: 30 },
        { name: 'Bob', age: 25 },
        { name: 'Charlie', age: 30 }
      ]);

      const result = users.find({ age: 30 });
      expect(result).toHaveLength(2);
      expect(result.every(doc => doc.age === 30)).toBe(true);
    });

    it('should update documents matching query', () => {
      users.insert([
        { name: 'Alice', status: 'active' },
        { name: 'Bob', status: 'pending' }
      ]);

      const updated = users.update({ name: 'Alice' }, { status: 'inactive' });
      expect(updated).toBe(1);

      const alice = users.find({ name: 'Alice' })[0];
      expect(alice.status).toBe('inactive');
    });

    it('should remove documents matching query', () => {
      users.insert([
        { name: 'Alice', status: 'active' },
        { name: 'Bob', status: 'pending' }
      ]);

      const removed = users.remove({ status: 'active' });
      expect(removed).toBe(1);

      const remaining = users.find();
      expect(remaining).toHaveLength(1);
      expect(remaining[0].name).toBe('Bob');
    });
  });

  describe('Query Operators', () => {
    let products: Collection;

    beforeEach(() => {
      products = db.addCollection('products');
      products.insert([
        { name: 'Laptop', price: 1000 },
        { name: 'Mouse', price: 50 },
        { name: 'Keyboard', price: 100 },
        { name: 'Monitor', price: 300 }
      ]);
    });

    it('should support $gt operator', () => {
      const result = products.find({ price: { $gt: 100 } });
      expect(result).toHaveLength(2);
      expect(result.some(p => p.name === 'Laptop')).toBe(true);
      expect(result.some(p => p.name === 'Monitor')).toBe(true);
    });

    it('should support $gte operator', () => {
      const result = products.find({ price: { $gte: 100 } });
      expect(result).toHaveLength(3);
    });

    it('should support $lt operator', () => {
      const result = products.find({ price: { $lt: 100 } });
      expect(result).toHaveLength(1);
      expect(result[0].name).toBe('Mouse');
    });

    it('should support $lte operator', () => {
      const result = products.find({ price: { $lte: 100 } });
      expect(result).toHaveLength(2);
    });

    it('should support $ne operator', () => {
      const result = products.find({ price: { $ne: 1000 } });
      expect(result).toHaveLength(3);
    });

    it('should support $in operator', () => {
      const result = products.find({ price: { $in: [50, 300] } });
      expect(result).toHaveLength(2);
      expect(result.some(p => p.name === 'Mouse')).toBe(true);
      expect(result.some(p => p.name === 'Monitor')).toBe(true);
    });

    it('should support $nin operator', () => {
      const result = products.find({ price: { $nin: [50, 300] } });
      expect(result).toHaveLength(2);
      expect(result.some(p => p.name === 'Laptop')).toBe(true);
      expect(result.some(p => p.name === 'Keyboard')).toBe(true);
    });
  });

  describe('Indexing', () => {
    let users: Collection;

    beforeEach(() => {
      users = db.addCollection('users');
      users.insert([
        { name: 'Alice', email: 'alice@example.com' },
        { name: 'Bob', email: 'bob@example.com' },
        { name: 'Charlie', email: 'charlie@example.com' }
      ]);
    });

    it('should create an index', () => {
      users.createIndex('email');
      const indices = users.getIndices();
      expect(indices).toContain('email');
    });

    it('should throw error when creating duplicate index', () => {
      users.createIndex('email');
      expect(() => users.createIndex('email')).toThrow('Index already exists for field: email');
    });

    it('should use index for exact matches', () => {
      users.createIndex('email');
      const result = users.find({ email: 'alice@example.com' });
      expect(result).toHaveLength(1);
      expect(result[0].name).toBe('Alice');
    });

    it('should drop an index', () => {
      users.createIndex('email');
      users.dropIndex('email');
      const indices = users.getIndices();
      expect(indices).not.toContain('email');
    });
  });

  describe('Database Statistics', () => {
    it('should return correct statistics', () => {
      const users = db.addCollection('users');
      const products = db.addCollection('products');

      users.insert([{ name: 'Alice' }, { name: 'Bob' }]);
      products.insert([{ name: 'Laptop' }]);

      const stats = db.getStats();
      expect(stats.collectionCount).toBe(2);
      expect(stats.totalDocuments).toBe(3);
    });
  });
});
