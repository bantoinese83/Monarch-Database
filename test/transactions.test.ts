import { describe, it, expect, beforeEach } from 'vitest';
import { Monarch } from '../src';

describe('Transactions', () => {
  let db: Monarch;

  beforeEach(() => {
    db = new Monarch();
  });

  describe('Basic Transaction Operations', () => {
    it('should begin a transaction', () => {
      const txId = db.beginTransaction();
      expect(typeof txId).toBe('string');
      expect(txId.length).toBeGreaterThan(0);
    });

    it('should begin a transaction with options', () => {
      const txId = db.beginTransaction({ isolation: 'read-committed', timeout: 5000 });
      expect(typeof txId).toBe('string');

      const tx = (db as any).getTransaction(txId);
      expect(tx).toBeDefined();
      expect(tx.options.isolation).toBe('read-committed');
      expect(tx.options.timeout).toBe(5000);
    });

    it('should add operations to a transaction', () => {
      const users = db.addCollection('users');
      const txId = db.beginTransaction();

      db.addToTransaction(txId, 'users', 'insert', { name: 'John', age: 30 });

      const tx = (db as any).getTransaction(txId);
      expect(tx.operations).toHaveLength(1);
      expect(tx.operations[0].type).toBe('insert');
      expect(tx.operations[0].collection).toBe('users');
    });

    it('should commit a transaction successfully', () => {
      const users = db.addCollection('users');
      const txId = db.beginTransaction();

      db.addToTransaction(txId, 'users', 'insert', { name: 'John', age: 30 });
      db.commitTransaction(txId);

      const docs = users.find();
      expect(docs).toHaveLength(1);
      expect(docs[0].name).toBe('John');
    });

    it('should rollback a transaction', () => {
      const users = db.addCollection('users');
      const txId = db.beginTransaction();

      db.addToTransaction(txId, 'users', 'insert', { name: 'John', age: 30 });
      db.rollbackTransaction(txId);

      const docs = users.find();
      expect(docs).toHaveLength(0);
    });
  });

  describe('Transaction Atomicity', () => {
    it('should rollback all operations if one fails', () => {
      const users = db.addCollection('users');
      const products = db.addCollection('products');
      const txId = db.beginTransaction();

      // Add valid operations
      db.addToTransaction(txId, 'users', 'insert', { name: 'John', age: 30 });
      db.addToTransaction(txId, 'products', 'insert', { name: 'Widget', price: 10 });

      // Add an operation that will fail during commit (trying to remove non-existent document)
      db.addToTransaction(txId, 'users', 'remove', { _id: 'nonexistent' });

      expect(() => db.commitTransaction(txId)).toThrow();

      // All operations should be rolled back
      expect(users.find()).toHaveLength(0);
      expect(products.find()).toHaveLength(0);
    });

    it('should handle multiple collections in a transaction', () => {
      const users = db.addCollection('users');
      const orders = db.addCollection('orders');
      const txId = db.beginTransaction();

      db.addToTransaction(txId, 'users', 'insert', { name: 'John', email: 'john@example.com' });
      db.addToTransaction(txId, 'orders', 'insert', { userId: 'will-be-generated', amount: 100 });

      db.commitTransaction(txId);

      expect(users.find()).toHaveLength(1);
      expect(orders.find()).toHaveLength(1);
    });
  });

  describe('Transaction Edge Cases', () => {
    it('should reject operations on non-existent collections', () => {
      const txId = db.beginTransaction();

      db.addToTransaction(txId, 'nonexistent', 'insert', { data: 'test' });

      expect(() => db.commitTransaction(txId)).toThrow('Collection \'nonexistent\' not found');
    });

    it('should timeout long-running transactions', async () => {
      const txId = db.beginTransaction({ timeout: 100 }); // 100ms timeout

      // Wait for timeout
      await new Promise(resolve => setTimeout(resolve, 150));

      // Try to add an operation after timeout - this should fail
      expect(() => {
        db.addToTransaction(txId, 'users', 'insert', { name: 'John' });
      }).toThrow('timed out');
    });

    it('should prevent concurrent transactions beyond limit', () => {
      // Create maximum allowed transactions
      const txIds: string[] = [];
      for (let i = 0; i < 10; i++) {
        txIds.push(db.beginTransaction());
      }

      // This should fail
      expect(() => db.beginTransaction()).toThrow('Maximum number of concurrent transactions exceeded');
    });
  });
});
