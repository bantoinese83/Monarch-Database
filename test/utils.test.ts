import { describe, it, expect } from 'vitest';
import { generateId, generateSequentialId, isValidId } from '../src/utils';

describe('Utility Functions', () => {
  describe('generateId', () => {
    it('should generate unique IDs', () => {
      const id1 = generateId();
      const id2 = generateId();

      expect(id1).not.toBe(id2);
      expect(typeof id1).toBe('string');
      expect(id1.length).toBeGreaterThan(10);
    });

    it('should generate IDs with correct format', () => {
      const id = generateId();

      // Should contain timestamp, counter, and random parts separated by hyphens
      const parts = id.split('-');
      expect(parts).toHaveLength(3);

      // Each part should be non-empty
      parts.forEach(part => {
        expect(part.length).toBeGreaterThan(0);
      });
    });

    it('should generate valid IDs', () => {
      const id = generateId();
      expect(isValidId(id)).toBe(true);
    });
  });

  describe('generateSequentialId', () => {
    it('should generate sequential IDs with correct format', () => {
      expect(generateSequentialId(0)).toBe('doc_0');
      expect(generateSequentialId(123)).toBe('doc_123');
      expect(generateSequentialId(999)).toBe('doc_999');
    });

    it('should generate valid IDs', () => {
      expect(isValidId(generateSequentialId(42))).toBe(true);
    });
  });

  describe('isValidId', () => {
    it('should validate correct ID formats', () => {
      expect(isValidId('doc_123')).toBe(true);
      expect(isValidId('abc-123-def')).toBe(true);
      expect(isValidId('test.id_123')).toBe(true);
      expect(isValidId('a')).toBe(true);
      expect(isValidId('valid-id.with_underscores')).toBe(true);
    });

    it('should reject invalid ID formats', () => {
      expect(isValidId('')).toBe(false);
      expect(isValidId(null as any)).toBe(false);
      expect(isValidId(undefined as any)).toBe(false);
      expect(isValidId(123 as any)).toBe(false);
      expect(isValidId('id with spaces')).toBe(false);
      expect(isValidId('id@with#special')).toBe(false);
      expect(isValidId('a'.repeat(101))).toBe(false); // Too long
    });

    it('should handle edge cases', () => {
      expect(isValidId('x'.repeat(100))).toBe(true); // Max length
      expect(isValidId('a1')).toBe(true); // Numbers allowed
      expect(isValidId('test_123-abc.def')).toBe(true); // Mixed valid chars
    });
  });
});
