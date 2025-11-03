/**
 * Tests for Centralized Validators
 * 
 * Tests the DRY-compliant validation logic extracted from various classes.
 */

import { describe, it, expect } from 'vitest';
import { CollectionValidator, DocumentValidator, QueryValidator } from '../src/validators';
import { ValidationError, ResourceLimitError } from '../src/errors';
import { LIMITS, ERROR_MESSAGES } from '../src/constants';

describe('CollectionValidator', () => {
  describe('validateName', () => {
    it('should accept valid collection names', () => {
      expect(() => CollectionValidator.validateName('users')).not.toThrow();
      expect(() => CollectionValidator.validateName('user_profiles')).not.toThrow();
      expect(() => CollectionValidator.validateName('test-collection')).not.toThrow();
      expect(() => CollectionValidator.validateName('collection123')).not.toThrow();
      expect(() => CollectionValidator.validateName('_private')).not.toThrow();
      expect(() => CollectionValidator.validateName('$system')).not.toThrow();
    });

    it('should reject empty or invalid collection names', () => {
      expect(() => CollectionValidator.validateName('')).toThrow(ValidationError);
      expect(() => CollectionValidator.validateName('   ')).toThrow(ValidationError);
      expect(() => CollectionValidator.validateName(null as any)).toThrow(ValidationError);
      expect(() => CollectionValidator.validateName(undefined as any)).toThrow(ValidationError);
      expect(() => CollectionValidator.validateName(123 as any)).toThrow(ValidationError);
    });

    it('should reject collection names that are too long', () => {
      const longName = 'a'.repeat(LIMITS.MAX_COLLECTION_NAME_LENGTH + 1);
      expect(() => CollectionValidator.validateName(longName)).toThrow(ValidationError);
      expect(() => CollectionValidator.validateName(longName)).toThrow(
        expect.objectContaining({
          message: expect.stringContaining('too long')
        })
      );
    });

    it('should reject collection names with invalid characters', () => {
      expect(() => CollectionValidator.validateName('collection name')).toThrow(ValidationError);
      expect(() => CollectionValidator.validateName('collection@name')).toThrow(ValidationError);
      expect(() => CollectionValidator.validateName('collection#name')).toThrow(ValidationError);
      expect(() => CollectionValidator.validateName('collection!name')).toThrow(ValidationError);
    });
  });
});

describe('DocumentValidator', () => {
  describe('validate', () => {
    it('should accept valid documents', () => {
      expect(() => DocumentValidator.validate({ name: 'John', age: 30 })).not.toThrow();
      expect(() => DocumentValidator.validate({ _id: '123', data: 'test' })).not.toThrow();
      expect(() => DocumentValidator.validate({ nested: { value: 1 } })).not.toThrow();
      expect(() => DocumentValidator.validate({ array: [1, 2, 3] })).not.toThrow();
    });

    it('should reject null or non-object documents', () => {
      expect(() => DocumentValidator.validate(null)).toThrow(ValidationError);
      expect(() => DocumentValidator.validate(undefined)).toThrow(ValidationError);
      expect(() => DocumentValidator.validate('string')).toThrow(ValidationError);
      expect(() => DocumentValidator.validate(123)).toThrow(ValidationError);
      expect(() => DocumentValidator.validate([])).toThrow(ValidationError);
    });

    it('should reject documents that are too large', () => {
      const largeDoc = {
        data: 'x'.repeat(LIMITS.MAX_DOCUMENT_SIZE + 1)
      };
      expect(() => DocumentValidator.validate(largeDoc)).toThrow(ResourceLimitError);
    });

    it('should detect circular references', () => {
      const circular: any = { name: 'test' };
      circular.self = circular;
      
      expect(() => DocumentValidator.validate(circular)).toThrow(ValidationError);
      expect(() => DocumentValidator.validate(circular)).toThrow(
        expect.objectContaining({
          message: expect.stringContaining('circular')
        })
      );
    });

    it('should validate nested circular references', () => {
      const nested: any = { 
        level1: { 
          level2: {} 
        } 
      };
      nested.level1.level2.ref = nested;
      
      expect(() => DocumentValidator.validate(nested)).toThrow(ValidationError);
    });
  });

  describe('validateFieldNames', () => {
    it('should accept valid field names', () => {
      expect(() => DocumentValidator.validateFieldNames({ name: 'test' })).not.toThrow();
      expect(() => DocumentValidator.validateFieldNames({ _id: '123' })).not.toThrow();
      expect(() => DocumentValidator.validateFieldNames({ fieldName: 'value' })).not.toThrow();
    });

    it('should reject field names that are not strings', () => {
      expect(() => DocumentValidator.validateFieldNames({ 123: 'value' })).toThrow(ValidationError);
      expect(() => DocumentValidator.validateFieldNames({ null: 'value' })).toThrow(ValidationError);
    });

    it('should reject field names that are too long', () => {
      const longField = 'a'.repeat(LIMITS.MAX_FIELD_NAME_LENGTH + 1);
      expect(() => DocumentValidator.validateFieldNames({ [longField]: 'value' })).toThrow(ValidationError);
    });

    it('should reject top-level field names starting with $', () => {
      expect(() => DocumentValidator.validateFieldNames({ $dangerous: 'value' })).toThrow(ValidationError);
      expect(() => DocumentValidator.validateFieldNames({ $gt: 10 })).toThrow(ValidationError);
      
      // But should allow nested fields starting with $
      expect(() => DocumentValidator.validateFieldNames({ 
        nested: { $operators: 'allowed' } 
      })).not.toThrow();
    });

    it('should validate nested field names', () => {
      const invalidNested = {
        valid: {
          [123]: 'invalid' // Non-string key in nested object
        }
      };
      expect(() => DocumentValidator.validateFieldNames(invalidNested)).toThrow(ValidationError);
    });
  });

  describe('calculateSize', () => {
    it('should calculate approximate document size', () => {
      const doc = { name: 'John', age: 30 };
      const size = DocumentValidator.calculateSize(doc);
      expect(size).toBeGreaterThan(0);
      expect(typeof size).toBe('number');
    });

    it('should handle empty objects', () => {
      const size = DocumentValidator.calculateSize({});
      expect(size).toBeGreaterThan(0);
    });

    it('should reject non-serializable data', () => {
      const nonSerializable = {
        func: () => {},
        symbol: Symbol('test'),
        undefinedValue: undefined
      };
      // JSON.stringify will remove undefined and fail on functions/symbols
      expect(() => DocumentValidator.calculateSize(nonSerializable)).toThrow();
    });
  });

  describe('validateId', () => {
    it('should accept valid document IDs', () => {
      expect(() => DocumentValidator.validateId('doc_123')).not.toThrow();
      expect(() => DocumentValidator.validateId('123')).not.toThrow();
      expect(() => DocumentValidator.validateId('invalid-id-format')).not.toThrow(); // Hyphens are allowed
      expect(() => DocumentValidator.validateId('test.id')).not.toThrow(); // Dots are allowed
    });

    it('should reject invalid document IDs', () => {
      expect(() => DocumentValidator.validateId('')).toThrow(ValidationError);
      expect(() => DocumentValidator.validateId('id with spaces')).toThrow(ValidationError);
      expect(() => DocumentValidator.validateId('id@special')).toThrow(ValidationError);
      expect(() => DocumentValidator.validateId('a'.repeat(101))).toThrow(ValidationError); // Too long
      expect(() => DocumentValidator.validateId(null as any)).toThrow(ValidationError);
      expect(() => DocumentValidator.validateId(undefined as any)).toThrow(ValidationError);
    });
  });
});

describe('QueryValidator', () => {
  describe('validate', () => {
    it('should accept valid queries', () => {
      expect(() => QueryValidator.validate({ name: 'John' })).not.toThrow();
      expect(() => QueryValidator.validate({ age: { $gt: 18 } })).not.toThrow();
      expect(() => QueryValidator.validate({ status: { $in: ['active', 'pending'] } })).not.toThrow();
    });

    it('should reject null or non-object queries', () => {
      expect(() => QueryValidator.validate(null)).toThrow(ValidationError);
      expect(() => QueryValidator.validate(undefined)).toThrow(ValidationError);
      expect(() => QueryValidator.validate('string')).toThrow(ValidationError);
      expect(() => QueryValidator.validate(123)).toThrow(ValidationError);
    });

    it('should reject queries that are too large', () => {
      const largeQuery = {
        data: 'x'.repeat(LIMITS.MAX_QUERY_SIZE + 1)
      };
      expect(() => QueryValidator.validate(largeQuery)).toThrow(ValidationError);
    });

    it('should validate query depth', () => {
      const createDeepQuery = (depth: number): any => {
        if (depth === 0) return { value: 'test' };
        return { nested: createDeepQuery(depth - 1) };
      };
      
      // Create a query that exceeds max depth
      const deepQuery = createDeepQuery(LIMITS.MAX_QUERY_DEPTH + 1);
      
      expect(() => QueryValidator.validate(deepQuery)).toThrow(ValidationError);
      expect(() => QueryValidator.validate(deepQuery)).toThrow(
        expect.objectContaining({
          message: expect.stringContaining('too deeply nested')
        })
      );
    });
  });

  describe('validateOperators', () => {
    it('should accept valid query operators', () => {
      expect(() => QueryValidator.validate({
        age: { $gt: 18, $lt: 65 },
        status: { $in: ['active'] },
        name: { $regex: 'John' }
      })).not.toThrow();
    });

    it('should reject invalid query operators', () => {
      expect(() => QueryValidator.validate({
        age: { $invalidOp: 18 }
      })).toThrow(ValidationError);
    });

    it('should reject queries with too many operators', () => {
      const query: any = {};
      for (let i = 0; i < LIMITS.MAX_QUERY_OPERATORS + 1; i++) {
        query[`field${i}`] = { $gt: i };
      }
      
      expect(() => QueryValidator.validate(query)).toThrow(ValidationError);
      expect(() => QueryValidator.validate(query)).toThrow(
        expect.objectContaining({
          message: expect.stringContaining('too complex')
        })
      );
    });

    it('should validate nested operators', () => {
      // Operators should be in field values, not top-level
      expect(() => QueryValidator.validate({
        age: { $invalidOp: 18 } // Invalid operator at field level
      })).toThrow(ValidationError);
    });
  });

  describe('validateUpdateOperation', () => {
    it('should accept valid update operations', () => {
      expect(() => QueryValidator.validateUpdateOperation({ name: 'John' })).not.toThrow();
      expect(() => QueryValidator.validateUpdateOperation({ age: 30, status: 'active' })).not.toThrow();
    });

    it('should reject empty update operations', () => {
      expect(() => QueryValidator.validateUpdateOperation({})).toThrow(ValidationError);
    });

    it('should reject updates to _id field', () => {
      expect(() => QueryValidator.validateUpdateOperation({ _id: 'new-id' })).toThrow(ValidationError);
      expect(() => QueryValidator.validateUpdateOperation({ _id: 'new-id' })).toThrow(
        expect.objectContaining({
          message: expect.stringContaining('_id')
        })
      );
    });

    it('should reject nested object updates', () => {
      expect(() => QueryValidator.validateUpdateOperation({
        nested: { field: 'value' }
      })).toThrow(ValidationError);
      expect(() => QueryValidator.validateUpdateOperation({
        nested: { field: 'value' }
      })).toThrow(
        expect.objectContaining({
          message: expect.stringContaining('Nested object updates')
        })
      );
    });

    it('should accept array updates', () => {
      expect(() => QueryValidator.validateUpdateOperation({ tags: ['a', 'b'] })).not.toThrow();
    });

    // Note: QueryValidator.validateUpdateOperation does not validate field names
    // Field name validation is handled by DocumentValidator.validateFieldNames
    // when the full document is validated during the update operation
  });
});

