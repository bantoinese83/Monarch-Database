/**
 * Collection Validator
 *
 * Centralized validation logic for collection names and operations.
 * Follows DRY principle - single source of truth for collection validation.
 */

import { ValidationError } from '../errors';
import { LIMITS, ERROR_MESSAGES } from '../constants';

export class CollectionValidator {
  /**
   * Validate a collection name
   * @throws ValidationError if name is invalid
   */
  static validateName(name: string): void {
    if (!name || typeof name !== 'string') {
      throw new ValidationError(ERROR_MESSAGES.COLLECTION_NAME_REQUIRED, 'collectionName', name);
    }

    if (name.length > LIMITS.MAX_COLLECTION_NAME_LENGTH) {
      throw new ValidationError(
        ERROR_MESSAGES.COLLECTION_NAME_TOO_LONG(LIMITS.MAX_COLLECTION_NAME_LENGTH),
        'collectionName',
        name.length
      );
    }

    // Check for valid collection name characters (allow underscores, dashes, and dots)
    if (!/^[a-zA-Z_$][a-zA-Z0-9_$.-]*$/.test(name)) {
      throw new ValidationError(
        ERROR_MESSAGES.COLLECTION_NAME_INVALID_CHARS,
        'collectionName',
        name
      );
    }
  }

  /**
   * Check if collection name is valid (non-throwing version)
   */
  static isValidName(name: string): boolean {
    try {
      this.validateName(name);
      return true;
    } catch {
      return false;
    }
  }
}
