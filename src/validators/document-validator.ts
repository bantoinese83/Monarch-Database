/**
 * Document Validator
 *
 * Centralized validation logic for documents.
 * Follows DRY principle - single source of truth for document validation.
 */

import { Document } from '../types';
import { ValidationError, DataIntegrityError, ResourceLimitError } from '../errors';
import { LIMITS, ERROR_MESSAGES } from '../constants';

export class DocumentValidator {
  /**
   * Validate a document structure and content
   * @throws ValidationError or DataIntegrityError if document is invalid
   */
  static validate(doc: Document): void {
    if (!doc || typeof doc !== 'object' || Array.isArray(doc)) {
      throw new ValidationError(ERROR_MESSAGES.DOCUMENT_MUST_BE_OBJECT, 'document', doc);
    }

    // Check document size
    const docSize = this.calculateSize(doc);
    if (docSize > LIMITS.MAX_DOCUMENT_SIZE) {
      throw new ResourceLimitError(
        ERROR_MESSAGES.DOCUMENT_TOO_LARGE(docSize, LIMITS.MAX_DOCUMENT_SIZE),
        'documentSize',
        LIMITS.MAX_DOCUMENT_SIZE,
        docSize
      );
    }

    // Check for circular references
    this.detectCircularReferences(doc);

    // Validate field names
    this.validateFieldNames(doc);
  }

  /**
   * Calculate the size of an object in bytes (rough estimate)
   */
  static calculateSize(obj: unknown): number {
    // First check for circular references before attempting JSON.stringify
    this.detectCircularReferences(obj);

    try {
      return JSON.stringify(obj).length * 2; // Rough estimate in bytes
    } catch {
      throw new DataIntegrityError(ERROR_MESSAGES.DOCUMENT_NON_SERIALIZABLE, undefined, undefined);
    }
  }

  /**
   * Detect circular references in an object
   * @throws ValidationError if circular reference found
   */
  static detectCircularReferences(obj: unknown, seen = new WeakSet<object>()): void {
    if (obj === null || typeof obj !== 'object') return;

    if (seen.has(obj)) {
      throw new ValidationError(ERROR_MESSAGES.DOCUMENT_CIRCULAR_REF, 'document', obj);
    }

    seen.add(obj);

    for (const value of Object.values(obj)) {
      this.detectCircularReferences(value, seen);
    }

    seen.delete(obj);
  }

  /**
   * Validate field names in a document
   * @throws ValidationError if field names are invalid
   */
  static validateFieldNames(obj: unknown, path: string[] = []): void {
    if (typeof obj !== 'object' || obj === null) return;

    for (const [key, value] of Object.entries(obj)) {
      if (typeof key !== 'string') {
        throw new ValidationError(ERROR_MESSAGES.FIELD_NAME_MUST_BE_STRING, 'fieldName', key);
      }

      if (key.length > LIMITS.MAX_FIELD_NAME_LENGTH) {
        throw new ValidationError(
          ERROR_MESSAGES.FIELD_NAME_TOO_LONG(key, LIMITS.MAX_FIELD_NAME_LENGTH),
          'fieldName',
          key
        );
      }

      // Check for dangerous field names
      if (key.startsWith('$') && path.length === 0) {
        throw new ValidationError(ERROR_MESSAGES.FIELD_NAME_DANGEROUS(key), 'fieldName', key);
      }

      // Recursively validate nested objects
      if (typeof value === 'object' && value !== null) {
        this.validateFieldNames(value, [...path, key]);
      }
    }
  }

  /**
   * Validate document ID format
   */
  static validateId(id: string): void {
    if (!id || typeof id !== 'string') {
      throw new ValidationError(ERROR_MESSAGES.DOCUMENT_ID_INVALID(id), 'documentId', id);
    }

    if (id.length < 1 || id.length > 100) {
      throw new ValidationError(ERROR_MESSAGES.DOCUMENT_ID_INVALID(id), 'documentId', id);
    }

    // Allow alphanumeric characters, underscores, hyphens, and dots
    if (!/^[a-zA-Z0-9_.-]+$/.test(id)) {
      throw new ValidationError(ERROR_MESSAGES.DOCUMENT_ID_INVALID(id), 'documentId', id);
    }
  }
}
