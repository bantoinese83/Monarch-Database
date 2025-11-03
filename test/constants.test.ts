/**
 * Tests for Centralized Constants
 * 
 * Ensures all constants are properly exported and have expected values.
 */

import { describe, it, expect } from 'vitest';
import { LIMITS, ERROR_MESSAGES } from '../src/constants';

describe('LIMITS', () => {
  it('should export all limit constants', () => {
    expect(LIMITS).toBeDefined();
    expect(LIMITS.MAX_DOCUMENT_SIZE).toBe(10 * 1024 * 1024);
    expect(LIMITS.MAX_COLLECTION_SIZE).toBe(100 * 1024 * 1024);
    expect(LIMITS.MAX_DOCUMENTS_PER_COLLECTION).toBe(100000);
    expect(LIMITS.MAX_DOCUMENTS_PER_OPERATION).toBe(10000);
    expect(LIMITS.MAX_FIELD_NAME_LENGTH).toBe(255);
    expect(LIMITS.MAX_COLLECTION_NAME_LENGTH).toBe(100);
    expect(LIMITS.MAX_QUERY_DEPTH).toBe(10);
    expect(LIMITS.MAX_QUERY_OPERATORS).toBe(20);
    expect(LIMITS.MAX_QUERY_SIZE).toBe(1024 * 1024);
    expect(LIMITS.MAX_COLLECTIONS_PER_DB).toBe(100);
    expect(LIMITS.MAX_INDICES_PER_COLLECTION).toBe(10);
    expect(LIMITS.MAX_DATABASE_SAVE_SIZE).toBe(50 * 1024 * 1024);
    expect(LIMITS.MAX_DATABASE_LOAD_SIZE).toBe(100 * 1024 * 1024);
  });

  it('should have positive limit values', () => {
    const limits = Object.values(LIMITS) as number[];
    for (const limit of limits) {
      expect(limit).toBeGreaterThan(0);
      expect(typeof limit).toBe('number');
    }
  });
});

describe('ERROR_MESSAGES', () => {
  it('should export all error message templates', () => {
    expect(ERROR_MESSAGES).toBeDefined();
    expect(typeof ERROR_MESSAGES.COLLECTION_NAME_REQUIRED).toBe('string');
    expect(typeof ERROR_MESSAGES.DOCUMENT_REQUIRED).toBe('string');
    expect(typeof ERROR_MESSAGES.QUERY_REQUIRED).toBe('string');
    expect(typeof ERROR_MESSAGES.UPDATE_CHANGES_REQUIRED).toBe('string');
  });

  it('should have function templates for parameterized messages', () => {
    expect(typeof ERROR_MESSAGES.COLLECTION_NAME_TOO_LONG).toBe('function');
    expect(typeof ERROR_MESSAGES.DOCUMENT_TOO_LARGE).toBe('function');
    expect(typeof ERROR_MESSAGES.COLLECTION_NOT_FOUND).toBe('function');
    expect(typeof ERROR_MESSAGES.TRANSACTION_NOT_FOUND).toBe('function');
  });

  it('should generate correct error messages from templates', () => {
    const nameTooLong = ERROR_MESSAGES.COLLECTION_NAME_TOO_LONG(100);
    expect(nameTooLong).toContain('too long');
    expect(nameTooLong).toContain('100');

    const docTooLarge = ERROR_MESSAGES.DOCUMENT_TOO_LARGE(5000, 10000);
    expect(docTooLarge).toContain('too large');
    expect(docTooLarge).toContain('5000');
    expect(docTooLarge).toContain('10000');

    const collectionNotFound = ERROR_MESSAGES.COLLECTION_NOT_FOUND('users');
    expect(collectionNotFound).toContain('users');
    expect(collectionNotFound).toContain('not found');

    const transactionNotFound = ERROR_MESSAGES.TRANSACTION_NOT_FOUND('tx-123');
    expect(transactionNotFound).toContain('tx-123');
  });

  it('should have all required error message categories', () => {
    // Collection validation
    expect(ERROR_MESSAGES.COLLECTION_NAME_REQUIRED).toBeDefined();
    expect(ERROR_MESSAGES.COLLECTION_NAME_TOO_LONG).toBeDefined();
    expect(ERROR_MESSAGES.COLLECTION_NAME_INVALID_CHARS).toBeDefined();
    expect(ERROR_MESSAGES.COLLECTION_NOT_FOUND).toBeDefined();
    expect(ERROR_MESSAGES.COLLECTION_ALREADY_EXISTS).toBeDefined();

    // Document validation
    expect(ERROR_MESSAGES.DOCUMENT_REQUIRED).toBeDefined();
    expect(ERROR_MESSAGES.DOCUMENT_MUST_BE_OBJECT).toBeDefined();
    expect(ERROR_MESSAGES.DOCUMENT_TOO_LARGE).toBeDefined();
    expect(ERROR_MESSAGES.DOCUMENT_CIRCULAR_REF).toBeDefined();

    // Field validation
    expect(ERROR_MESSAGES.FIELD_NAME_MUST_BE_STRING).toBeDefined();
    expect(ERROR_MESSAGES.FIELD_NAME_TOO_LONG).toBeDefined();
    expect(ERROR_MESSAGES.FIELD_NAME_DANGEROUS).toBeDefined();

    // Query validation
    expect(ERROR_MESSAGES.QUERY_MUST_BE_OBJECT).toBeDefined();
    expect(ERROR_MESSAGES.QUERY_REQUIRED).toBeDefined();
    expect(ERROR_MESSAGES.QUERY_TOO_DEEP).toBeDefined();
    expect(ERROR_MESSAGES.QUERY_INVALID_OPERATORS).toBeDefined();

    // Update validation
    expect(ERROR_MESSAGES.UPDATE_CHANGES_REQUIRED).toBeDefined();
    expect(ERROR_MESSAGES.UPDATE_ID_FORBIDDEN).toBeDefined();

    // Transaction
    expect(ERROR_MESSAGES.TRANSACTION_NOT_FOUND).toBeDefined();
    expect(ERROR_MESSAGES.TRANSACTION_NOT_ACTIVE).toBeDefined();
    expect(ERROR_MESSAGES.TRANSACTION_TIMEOUT).toBeDefined();

    // Resource limits
    expect(ERROR_MESSAGES.COLLECTION_SIZE_LIMIT_EXCEEDED).toBeDefined();
    expect(ERROR_MESSAGES.COLLECTIONS_LIMIT_EXCEEDED).toBeDefined();
  });
});

