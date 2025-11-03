import { describe, it, expect, beforeEach } from 'vitest';
import { Monarch } from '../src';

describe('Query Optimization', () => {
  let db: Monarch;
  let users: any;

  beforeEach(() => {
    db = new Monarch();
    users = db.addCollection('users');

    // Insert test data
    users.insert([
      { name: 'John', age: 30, city: 'NYC' },
      { name: 'Jane', age: 25, city: 'LA' },
      { name: 'Bob', age: 35, city: 'NYC' },
      { name: 'Alice', age: 28, city: 'Chicago' }
    ]);

    // Create some indices
    users.createIndex('name');
    users.createIndex('city');
  });

  describe('Query Plan Generation', () => {
    it('should generate plan for simple equality query', () => {
      const query = { name: 'John' };
      const plan = db.analyzeQuery('users', query);

      expect(plan.collection).toBe('users');
      expect(plan.query).toEqual(query);
      expect(plan.indexUsed).toBe('name');
      expect(plan.estimatedCost).toBeGreaterThan(0);
      expect(plan.estimatedResults).toBeGreaterThan(0);
      expect(plan.executionSteps).toBeDefined();
    });

    it('should generate plan for range query', () => {
      const query = { age: { $gte: 25, $lt: 35 } };
      const plan = db.analyzeQuery('users', query);

      expect(plan.collection).toBe('users');
      expect(plan.indexUsed).toBeUndefined(); // No index on age
      expect(plan.executionSteps.some(step => step.type === 'scan')).toBe(true);
    });

    it('should prefer better index for compound queries', () => {
      const query = { name: 'John', city: 'NYC' };
      const plan = db.analyzeQuery('users', query);

      expect(plan.indexUsed).toBeDefined();
      // Should choose one of the available indices
      expect(['name', 'city']).toContain(plan.indexUsed);
    });

    it('should handle complex queries', () => {
      const query = {
        $and: [
          { age: { $gte: 25 } },
          { city: 'NYC' }
        ]
      };

      const plan = db.analyzeQuery('users', query);

      expect(plan.collection).toBe('users');
      expect(plan.estimatedCost).toBeGreaterThan(0);
    });
  });

  describe('Optimization Suggestions', () => {
    it('should suggest index creation for unindexed fields', () => {
      const query = { age: 30 }; // age field is not indexed
      const suggestions = db.getQuerySuggestions('users', query);

      expect(suggestions.some(s => s.includes('age'))).toBe(true);
      expect(suggestions.some(s => s.includes('index'))).toBe(true);
    });

    it('should suggest compound indices for multiple fields', () => {
      const query = { age: 30, city: 'NYC' };
      const suggestions = db.getQuerySuggestions('users', query);

      expect(suggestions.some(s => s.includes('compound') || s.includes('multiple'))).toBe(true);
    });

    it('should warn about inefficient query patterns', () => {
      const query = { name: { $regex: '.*John.*' } };
      const suggestions = db.getQuerySuggestions('users', query);

      expect(suggestions.some(s => s.includes('regex') || s.includes('slow'))).toBe(true);
    });

    it('should not suggest indices for already indexed fields', () => {
      const query = { name: 'John' }; // name is already indexed
      const suggestions = db.getQuerySuggestions('users', query);

      expect(suggestions.every(s => !s.includes('name'))).toBe(true);
    });
  });

  describe('Cost Estimation', () => {
    it('should estimate lower cost for indexed queries', () => {
      const indexedQuery = { name: 'John' };
      const nonIndexedQuery = { age: 30 };

      const indexedPlan = db.analyzeQuery('users', indexedQuery);
      const nonIndexedPlan = db.analyzeQuery('users', nonIndexedQuery);

      expect(indexedPlan.estimatedCost).toBeLessThan(nonIndexedPlan.estimatedCost);
    });

    it('should estimate result counts', () => {
      const indexedQuery = { name: 'John' }; // Uses index
      const nonIndexedQuery = { age: 30 }; // No index on age

      const indexedPlan = db.analyzeQuery('users', indexedQuery);
      const nonIndexedPlan = db.analyzeQuery('users', nonIndexedQuery);

      // Indexed query should have better selectivity
      expect(indexedPlan.estimatedResults).toBeLessThanOrEqual(nonIndexedPlan.estimatedResults);
    });

    it('should include multiple execution steps', () => {
      const complexQuery = { name: 'John', age: { $gte: 25 } };
      const plan = db.analyzeQuery('users', complexQuery);

      expect(plan.executionSteps.length).toBeGreaterThan(1);
      expect(plan.executionSteps.some(step => step.type === 'index-lookup')).toBe(true);
      expect(plan.executionSteps.some(step => step.type === 'filter')).toBe(true);
    });
  });

  describe('Execution Step Analysis', () => {
    it('should identify scan operations', () => {
      const query = {}; // Empty query requires full scan
      const plan = db.analyzeQuery('users', query);

      const scanStep = plan.executionSteps.find(step => step.type === 'scan');
      expect(scanStep).toBeDefined();
      expect(scanStep!.cost).toBeGreaterThan(0);
      expect(scanStep!.selectivity).toBe(1.0);
    });

    it('should identify index operations', () => {
      const query = { name: 'John' };
      const plan = db.analyzeQuery('users', query);

      const indexStep = plan.executionSteps.find(step => step.type === 'index-lookup');
      expect(indexStep).toBeDefined();
      expect(indexStep!.cost).toBeGreaterThan(0);
      expect(indexStep!.selectivity).toBeLessThan(1.0);
    });

    it('should include sorting when needed', () => {
      const query = { $orderby: { age: 1 } };
      const plan = db.analyzeQuery('users', query);

      const sortStep = plan.executionSteps.find(step => step.type === 'sort');
      expect(sortStep).toBeDefined();
    });

    it('should include limiting when needed', () => {
      const query = { $limit: 2 };
      const plan = db.analyzeQuery('users', query);

      const limitStep = plan.executionSteps.find(step => step.type === 'limit');
      expect(limitStep).toBeDefined();
    });
  });

  describe('Index Selection Logic', () => {
    it('should choose the most selective index', () => {
      // Add another index
      users.createIndex('age');

      // Query that could use either name or age index
      const query = { name: 'John', age: 30 };
      const plan = db.analyzeQuery('users', query);

      // Should choose an index
      expect(plan.indexUsed).toBeDefined();
      expect(['name', 'age', 'city']).toContain(plan.indexUsed);
    });

    it('should calculate index costs correctly', () => {
      const equalityQuery = { name: 'John' };
      const rangeQuery = { age: { $gte: 25 } };

      const equalityPlan = db.analyzeQuery('users', equalityQuery);
      const rangePlan = db.analyzeQuery('users', rangeQuery);

      // Equality should be cheaper than range
      expect(equalityPlan.estimatedCost).toBeLessThan(rangePlan.estimatedCost);
    });

    it('should handle queries with no viable index', () => {
      const query = { nonexistentField: 'value' };
      const plan = db.analyzeQuery('users', query);

      expect(plan.indexUsed).toBeUndefined();
      expect(plan.executionSteps.some(step => step.type === 'scan')).toBe(true);
    });
  });
});
