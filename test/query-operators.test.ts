import { describe, it, expect, beforeEach } from 'vitest';
import { Monarch } from '../src';

describe('Query Operators', () => {
  let db: Monarch;
  let collection: any;

  beforeEach(() => {
    db = new Monarch();
    collection = db.addCollection('test');
  });

  describe('$eq operator', () => {
    it('should find documents with exact equality', () => {
      collection.insert([
        { name: 'Alice', age: 30, city: 'NYC' },
        { name: 'Bob', age: 25, city: 'LA' },
        { name: 'Charlie', age: 30, city: 'NYC' }
      ]);

      const results = collection.find({ age: { $eq: 30 } });
      expect(results.length).toBe(2);
      expect(results.every(r => r.age === 30)).toBe(true);
    });

    it('should handle object equality', () => {
      collection.insert([
        { name: 'Alice', profile: { city: 'NYC', zip: '10001' } },
        { name: 'Bob', profile: { city: 'LA', zip: '90210' } }
      ]);

      const results = collection.find({ profile: { $eq: { city: 'NYC', zip: '10001' } } });
      expect(results.length).toBe(1);
      expect(results[0].name).toBe('Alice');
    });
  });

  describe('$and operator', () => {
    it('should combine multiple conditions with AND logic', () => {
      collection.insert([
        { name: 'Alice', age: 30, city: 'NYC', active: true },
        { name: 'Bob', age: 25, city: 'LA', active: true },
        { name: 'Charlie', age: 30, city: 'NYC', active: false }
      ]);

      const results = collection.find({
        $and: [
          { age: { $gte: 25 } },
          { city: 'NYC' },
          { active: true }
        ]
      });

      expect(results.length).toBe(1);
      expect(results[0].name).toBe('Alice');
    });
  });

  describe('$or operator', () => {
    it('should combine multiple conditions with OR logic', () => {
      collection.insert([
        { name: 'Alice', age: 30, city: 'NYC' },
        { name: 'Bob', age: 25, city: 'LA' },
        { name: 'Charlie', age: 35, city: 'SF' }
      ]);

      const results = collection.find({
        $or: [
          { age: { $lt: 26 } },
          { city: 'NYC' }
        ]
      });

      expect(results.length).toBe(2);
      expect(results.map(r => r.name)).toEqual(expect.arrayContaining(['Alice', 'Bob']));
    });
  });

  describe('$regex operator', () => {
    it('should match strings using regular expressions', () => {
      collection.insert([
        { name: 'Alice Johnson', email: 'alice@test.com' },
        { name: 'Bob Smith', email: 'bob@test.com' },
        { name: 'Charlie Brown', email: 'charlie@test.com' }
      ]);

      const results = collection.find({ name: { $regex: '^A' } });
      expect(results.length).toBe(1);
      expect(results[0].name).toBe('Alice Johnson');
    });

    it('should handle case-sensitive regex by default', () => {
      collection.insert([
        { name: 'Alice', email: 'alice@test.com' },
        { name: 'alice', email: 'alice2@test.com' }
      ]);

      const results = collection.find({ name: { $regex: '^Alice$' } });
      expect(results.length).toBe(1);
      expect(results[0].name).toBe('Alice');
    });
  });

  describe('$exists operator', () => {
    it('should find documents where field exists', () => {
      collection.insert([
        { name: 'Alice', email: 'alice@test.com' },
        { name: 'Bob', phone: '555-1234' },
        { name: 'Charlie' }
      ]);

      const results = collection.find({ email: { $exists: true } });
      expect(results.length).toBe(1);
      expect(results[0].name).toBe('Alice');
    });

    it('should find documents where field does not exist', () => {
      collection.insert([
        { name: 'Alice', email: 'alice@test.com' },
        { name: 'Bob' }
      ]);

      const results = collection.find({ email: { $exists: false } });
      expect(results.length).toBe(1);
      expect(results[0].name).toBe('Bob');
    });
  });

  describe('$all operator', () => {
    it('should find arrays containing all specified values', () => {
      collection.insert([
        { name: 'Alice', tags: ['developer', 'react', 'typescript'] },
        { name: 'Bob', tags: ['developer', 'node'] },
        { name: 'Charlie', tags: ['designer', 'react'] }
      ]);

      const results = collection.find({ tags: { $all: ['developer', 'react'] } });
      expect(results.length).toBe(1);
      expect(results[0].name).toBe('Alice');
    });

    it('should work with single element arrays', () => {
      collection.insert([
        { name: 'Alice', tags: ['developer'] },
        { name: 'Bob', tags: ['designer'] }
      ]);

      const results = collection.find({ tags: { $all: ['developer'] } });
      expect(results.length).toBe(1);
      expect(results[0].name).toBe('Alice');
    });
  });

  describe('$size operator', () => {
    it('should find arrays with specific length', () => {
      collection.insert([
        { name: 'Alice', tags: ['developer', 'react', 'typescript'] },
        { name: 'Bob', tags: ['developer', 'node'] },
        { name: 'Charlie', tags: ['designer'] }
      ]);

      const results = collection.find({ tags: { $size: 3 } });
      expect(results.length).toBe(1);
      expect(results[0].name).toBe('Alice');
    });

    it('should work with empty arrays', () => {
      collection.insert([
        { name: 'Alice', tags: [] },
        { name: 'Bob', tags: ['developer'] }
      ]);

      const results = collection.find({ tags: { $size: 0 } });
      expect(results.length).toBe(1);
      expect(results[0].name).toBe('Alice');
    });
  });

  describe('nested field queries', () => {
    it('should work with dot notation', () => {
      collection.insert([
        { name: 'Alice', profile: { address: { city: 'NYC' } } },
        { name: 'Bob', profile: { address: { city: 'LA' } } }
      ]);

      const results = collection.find({ 'profile.address.city': 'NYC' });
      expect(results.length).toBe(1);
      expect(results[0].name).toBe('Alice');
    });

    it('should work with operators on nested fields', () => {
      collection.insert([
        { name: 'Alice', profile: { age: 30, skills: ['react', 'node'] } },
        { name: 'Bob', profile: { age: 25, skills: ['python'] } }
      ]);

      const results = collection.find({
        'profile.age': { $gte: 28 },
        'profile.skills': { $all: ['react'] }
      });

      expect(results.length).toBe(1);
      expect(results[0].name).toBe('Alice');
    });
  });

  describe('complex queries', () => {
    it('should combine multiple operators', () => {
      collection.insert([
        { name: 'Alice', age: 30, tags: ['developer', 'react'], active: true },
        { name: 'Bob', age: 25, tags: ['developer'], active: true },
        { name: 'Charlie', age: 35, tags: ['designer', 'react'], active: false }
      ]);

      const results = collection.find({
        $and: [
          { age: { $gte: 25 } },
          { tags: { $all: ['developer'] } },
          { active: { $eq: true } }
        ]
      });

      expect(results.length).toBe(2);
      expect(results.map(r => r.name)).toEqual(expect.arrayContaining(['Alice', 'Bob']));
    });
  });
});
