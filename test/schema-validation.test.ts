import { describe, it, expect, beforeEach } from 'vitest';
import { Monarch } from '../src';

describe('Schema Validation', () => {
  let db: Monarch;

  beforeEach(() => {
    db = new Monarch();
  });

  describe('Schema Management', () => {
    it('should set and get schema for a collection', () => {
      const schema = {
        type: 'object' as const,
        properties: {
          name: { type: 'string' },
          age: { type: 'number', minimum: 0 }
        },
        required: ['name']
      };

      db.setSchema('users', schema);
      const retrievedSchema = db.getSchema('users');

      expect(retrievedSchema).toEqual(schema);
    });

    it('should remove schema from a collection', () => {
      const schema = {
        type: 'object' as const,
        properties: { name: { type: 'string' } }
      };

      db.setSchema('users', schema);
      expect(db.getSchema('users')).toBeDefined();

      const removed = db.removeSchema('users');
      expect(removed).toBe(true);
      expect(db.getSchema('users')).toBeUndefined();
    });

    it('should return undefined for collection without schema', () => {
      expect(db.getSchema('nonexistent')).toBeUndefined();
    });
  });

  describe('Document Validation', () => {
    beforeEach(() => {
      const schema = {
        type: 'object' as const,
        properties: {
          name: { type: 'string', minLength: 2, maxLength: 50 },
          age: { type: 'number', minimum: 0, maximum: 150 },
          email: { type: 'string', pattern: '^[^@]+@[^@]+\\.[^@]+$' }
        },
        required: ['name', 'email']
      };

      db.setSchema('users', schema);
    });

    it('should validate valid documents', () => {
      const validDoc = {
        name: 'John Doe',
        age: 30,
        email: 'john@example.com'
      };

      const result = db.validateDocument('users', validDoc);
      expect(result.valid).toBe(true);
      expect(result.errors).toBeUndefined();
    });

    it('should reject documents missing required fields', () => {
      const invalidDoc = {
        age: 30
        // missing name and email
      };

      const result = db.validateDocument('users', invalidDoc);
      expect(result.valid).toBe(false);
      expect(result.errors?.some(err => err.includes('required property'))).toBe(true);
    });

    it('should reject documents with invalid types', () => {
      const invalidDoc = {
        name: 123, // should be string
        email: 'john@example.com'
      };

      const result = db.validateDocument('users', invalidDoc);
      expect(result.valid).toBe(false);
      expect(result.errors?.some(err => err.includes('should be string'))).toBe(true);
    });

    it('should validate string constraints', () => {
      const invalidDoc = {
        name: 'A', // too short
        email: 'john@example.com'
      };

      const result = db.validateDocument('users', invalidDoc);
      expect(result.valid).toBe(false);
      expect(result.errors?.some(err => err.includes('shorter than 2'))).toBe(true);
    });

    it('should validate number constraints', () => {
      const invalidDoc = {
        name: 'John',
        age: -5, // negative age
        email: 'john@example.com'
      };

      const result = db.validateDocument('users', invalidDoc);
      expect(result.valid).toBe(false);
      expect(result.errors?.some(err => err.includes('should be >= 0'))).toBe(true);
    });

    it('should validate regex patterns', () => {
      const invalidDoc = {
        name: 'John',
        email: 'invalid-email' // doesn't match pattern
      };

      const result = db.validateDocument('users', invalidDoc);
      expect(result.valid).toBe(false);
      expect(result.errors?.some(err => err.includes('should match pattern'))).toBe(true);
    });

    it('should skip validation for collections without schema', () => {
      const doc = { invalid: 'data' };
      const result = db.validateDocument('noschema', doc);
      expect(result.valid).toBe(true);
    });
  });

  describe('Advanced Schema Features', () => {
    it('should validate nested objects', () => {
      const schema = {
        type: 'object' as const,
        properties: {
          name: { type: 'string' },
          address: {
            type: 'object',
            properties: {
              street: { type: 'string' },
              city: { type: 'string' }
            },
            required: ['city']
          }
        },
        required: ['name']
      };

      db.setSchema('users', schema);

      const validDoc = {
        name: 'John',
        address: {
          street: '123 Main St',
          city: 'Anytown'
        }
      };

      const invalidDoc = {
        name: 'John',
        address: {
          street: '123 Main St'
          // missing city
        }
      };

      expect(db.validateDocument('users', validDoc).valid).toBe(true);
      const invalidResult = db.validateDocument('users', invalidDoc);
      expect(invalidResult.valid).toBe(false);
      expect(invalidResult.errors?.some(err => err.includes('city') && err.includes('required'))).toBe(true);
    });

    it('should validate arrays', () => {
      const schema = {
        type: 'object' as const,
        properties: {
          name: { type: 'string' },
          tags: {
            type: 'array',
            items: { type: 'string' }
          }
        }
      };

      db.setSchema('posts', schema);

      const validDoc = {
        name: 'Test Post',
        tags: ['javascript', 'typescript']
      };

      const invalidDoc = {
        name: 'Test Post',
        tags: ['valid', 123] // number in string array
      };

      expect(db.validateDocument('posts', validDoc).valid).toBe(true);
      expect(db.validateDocument('posts', invalidDoc).valid).toBe(false);
    });

    it('should validate enums', () => {
      const schema = {
        type: 'object' as const,
        properties: {
          status: {
            type: 'string',
            enum: ['active', 'inactive', 'pending']
          }
        }
      };

      db.setSchema('items', schema);

      expect(db.validateDocument('items', { status: 'active' }).valid).toBe(true);
      expect(db.validateDocument('items', { status: 'invalid' }).valid).toBe(false);
    });
  });
});
