/**
 * Query Validator
 *
 * Centralized validation logic for queries.
 * Follows DRY principle - single source of truth for query validation.
 */

import { Query } from '../types';
import { ValidationError } from '../errors';
import { LIMITS, ERROR_MESSAGES } from '../constants';

export class QueryValidator {
  /**
   * Validate a query object
   * @throws ValidationError if query is invalid
   */
  static validate(query: Query): void {
    if (query === null || typeof query !== 'object') {
      throw new ValidationError(ERROR_MESSAGES.QUERY_MUST_BE_OBJECT, 'query', query);
    }

    this.validateDepth(query);
    this.validateOperators(query);
    this.validateSize(query);
  }

  /**
   * Validate query depth (prevent deep nesting)
   * @throws ValidationError if query is too deeply nested
   */
  static validateDepth(query: unknown, depth = 0): void {
    if (depth > LIMITS.MAX_QUERY_DEPTH) {
      throw new ValidationError(
        ERROR_MESSAGES.QUERY_TOO_DEEP(LIMITS.MAX_QUERY_DEPTH),
        'queryDepth',
        depth
      );
    }

    if (typeof query === 'object' && query !== null) {
      for (const value of Object.values(query)) {
        this.validateDepth(value, depth + 1);
      }
    }
  }

  /**
   * Validate query operators
   * @throws ValidationError if invalid operators are used
   */
  static validateOperators(query: unknown): void {
    if (typeof query !== 'object' || query === null) return;
    for (const [, value] of Object.entries(query)) {
      if (typeof value === 'object' && value !== null) {
        const operators = Object.keys(value);
        const invalidOperators = operators.filter(op => !this.isValidOperator(op));

        if (invalidOperators.length > 0) {
          throw new ValidationError(
            ERROR_MESSAGES.QUERY_INVALID_OPERATORS(invalidOperators),
            'queryOperators',
            invalidOperators
          );
        }
      }
    }
  }

  /**
   * Validate query size
   * @throws ValidationError if query is too large
   */
  static validateSize(query: Query): void {
    const querySize = JSON.stringify(query).length;
    if (querySize > LIMITS.MAX_QUERY_SIZE) {
      throw new ValidationError(
        ERROR_MESSAGES.QUERY_TOO_LARGE(LIMITS.MAX_QUERY_SIZE),
        'querySize',
        querySize
      );
    }

    // Count operators
    let operatorCount = 0;
    const countOperators = (obj: unknown): void => {
      if (typeof obj === 'object' && obj !== null) {
        for (const value of Object.values(obj)) {
          if (typeof value === 'object' && value !== null) {
            for (const key of Object.keys(value)) {
              if (key.startsWith('$')) operatorCount++;
            }
          }
          countOperators(value);
        }
      }
    };

    countOperators(query);
    if (operatorCount > LIMITS.MAX_QUERY_OPERATORS) {
      throw new ValidationError(
        ERROR_MESSAGES.QUERY_TOO_COMPLEX(LIMITS.MAX_QUERY_OPERATORS),
        'queryOperators',
        operatorCount
      );
    }
  }

  /**
   * Check if an operator is valid
   */
  static isValidOperator(operator: string): boolean {
    const validOperators = ['$gt', '$gte', '$lt', '$lte', '$ne', '$in', '$nin', '$eq', '$regex'];
    return validOperators.includes(operator);
  }

  /**
   * Validate update operation
   * @throws ValidationError if update operation is invalid
   */
  static validateUpdateOperation(changes: Record<string, unknown>): void {
    if (Object.keys(changes).length === 0) {
      throw new ValidationError(ERROR_MESSAGES.UPDATE_MUST_SPECIFY_FIELD, 'updateChanges', changes);
    }

    // Check for dangerous operations
    if ('_id' in changes) {
      throw new ValidationError(ERROR_MESSAGES.UPDATE_ID_FORBIDDEN, 'updateChanges', '_id');
    }

    // Check for nested updates (not supported yet)
    for (const value of Object.values(changes)) {
      if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
        // Allow Date objects and simple objects (not nested)
        if (value instanceof Date || Object.keys(value).length === 0) {
          continue;
        }
        throw new ValidationError(
          ERROR_MESSAGES.UPDATE_NESTED_NOT_SUPPORTED,
          'updateChanges',
          changes
        );
      }
    }
  }
}
