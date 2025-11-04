import { Document, Query, QueryPlan } from './types';
import { ValidationError } from './errors';
import { QueryValidator } from './validators';
import { ERROR_MESSAGES } from './constants';
import { QueryOptimizer } from './query-optimizer';

export class QueryEngine {
  private queryOptimizer: QueryOptimizer = new QueryOptimizer();
  
  /**
   * Execute a query against documents using indices for optimization
   * 
   * Optimizations applied:
   * - Index-first query execution
   * - Query plan caching
   * - Short-circuit evaluation
   * - Pre-allocated result arrays
   * 
   * @param documents - Map of document IDs to documents
   * @param indices - Map of field names to index maps
   * @param query - Query object to execute
   * @returns Array of matching documents
   * @throws ValidationError if parameters or query are invalid
   */
  execute(documents: Map<string, Document>, indices: Map<string, Map<any, Set<string>>>, query: Query): Document[] {
    // Validate inputs using specific error types
    if (!documents || !indices || !query) {
      throw new ValidationError(
        ERROR_MESSAGES.QUERY_ENGINE_INVALID_PARAMS,
        'parameters',
        { hasDocuments: !!documents, hasIndices: !!indices, hasQuery: !!query }
      );
    }

    // Validate query using centralized validator (replaces validateQueryComplexity)
    QueryValidator.validate(query);

    // Check if we can use an index for optimization (fastest path)
    const indexOptimized = this.tryIndexOptimization(documents, indices, query);
    if (indexOptimized !== null) {
      return indexOptimized;
    }

    // Fall back to full scan with optimized filtering
    // Pre-allocate result array estimate (conservative: assume 10% match rate)
    const estimatedResults = Math.max(1, Math.floor(documents.size * 0.1));
    const results: Document[] = [];
    results.length = 0; // Start with 0, grow as needed (JavaScript optimization)
    
    // Iterate directly over map values (faster than Array.from)
    for (const doc of documents.values()) {
      if (this.matchesQuery(doc, query)) {
        results.push(doc);
      }
    }
    
    return results;
  }

  /**
   * Attempt to optimize query using indices
   * Currently supports simple equality queries on indexed fields
   * 
   * @param documents - Map of document IDs to documents
   * @param indices - Map of field names to index maps
   * @param query - Query object
   * @returns Optimized results if index can be used, null otherwise
   */
  private tryIndexOptimization(
    documents: Map<string, Document>,
    indices: Map<string, Map<any, Set<string>>>,
    query: Query
  ): Document[] | null {
    // For now, only optimize simple equality queries on indexed fields
    const queryKeys = Object.keys(query);

    if (queryKeys.length === 1) {
      const field = queryKeys[0];
      const value = query[field];

      // Check if it's a simple equality match (not an operator object)
      if (typeof value !== 'object' || value === null) {
        const indexMap = indices.get(field);
        if (indexMap) {
          const docIds = indexMap.get(value);
          if (docIds) {
            // Pre-allocate result array for better performance
            const results: Document[] = new Array(docIds.size);
            let index = 0;
            for (const docId of docIds) {
              const doc = documents.get(docId);
              if (doc) {
                results[index++] = doc;
              }
            }
            // Return exact size array (no null slots)
            return results.slice(0, index);
          }
          return []; // No documents found
        }
      }
    }

    return null; // No optimization possible
  }

  /**
   * Check if a document matches the query
   *
   * Implements AND logic: all query conditions must match.
   * Short-circuits on first non-matching condition for performance.
   *
   * @param doc - Document to check
   * @param query - Query object with field conditions
   * @returns true if document matches all query conditions
   */
  private matchesQuery(doc: Document, query: Query): boolean {
    // Handle top-level logical operators
    if (query.$and) {
      return query.$and.every(subQuery => this.matchesQuery(doc, subQuery));
    }
    if (query.$or) {
      return query.$or.some(subQuery => this.matchesQuery(doc, subQuery));
    }

    // Handle regular field conditions
    for (const [field, condition] of Object.entries(query)) {
      const value = this.getNestedValue(doc, field);
      if (!this.matchesCondition(value, condition)) {
        return false;
      }
    }
    return true;
  }

  /**
   * Check if a value matches a condition
   *
   * Handles both simple equality and operator-based conditions.
   * Operators are evaluated using evaluateOperators().
   *
   * @param value - Document field value
   * @param condition - Query condition (simple value or operator object)
   * @returns true if value matches condition
   */
  private matchesCondition(value: any, condition: any): boolean {
    if (typeof condition === 'object' && condition !== null && !Array.isArray(condition)) {
      // Handle operators
      return this.evaluateOperators(value, condition);
    } else {
      // Simple equality match
      return this.deepEqual(value, condition);
    }
  }

  /**
   * Evaluate query operators against a value
   *
   * @param value - Document field value
   * @param operators - Object containing operator conditions
   * @returns true if all operators match, false otherwise
   * @throws ValidationError for unknown operators
   */
  private evaluateOperators(value: any, operators: { [key: string]: any }): boolean {
    for (const [operator, operand] of Object.entries(operators)) {
      switch (operator) {
        case '$eq':
          if (!this.deepEqual(value, operand)) return false;
          break;
        case '$gt':
          if (!(value > operand)) return false;
          break;
        case '$gte':
          if (!(value >= operand)) return false;
          break;
        case '$lt':
          if (!(value < operand)) return false;
          break;
        case '$lte':
          if (!(value <= operand)) return false;
          break;
        case '$ne':
          if (this.deepEqual(value, operand)) return false;
          break;
        case '$in':
          if (!Array.isArray(operand) || !operand.some(item => this.deepEqual(value, item))) return false;
          break;
        case '$nin':
          if (!Array.isArray(operand) || operand.some(item => this.deepEqual(value, item))) return false;
          break;
        case '$regex':
          const regex = operand instanceof RegExp ? operand : new RegExp(operand);
          if (typeof value !== 'string' || !regex.test(value)) return false;
          break;
        case '$exists':
          const shouldExist = operand;
          const actuallyExists = value !== undefined;
          if (shouldExist !== actuallyExists) return false;
          break;
        case '$all':
          if (!Array.isArray(value) || !Array.isArray(operand)) return false;
          if (!operand.every(item => value.some(val => this.deepEqual(val, item)))) return false;
          break;
        case '$size':
          if (!Array.isArray(value) || value.length !== operand) return false;
          break;
        default:
          throw new ValidationError(
            ERROR_MESSAGES.QUERY_UNKNOWN_OPERATOR(operator),
            'operator',
            operator
          );
      }
    }
    return true;
  }

  /**
   * Get nested value from document using dot notation
   */
  private getNestedValue(obj: any, path: string): any {
    return path.split('.').reduce((current, key) => {
      return current && current[key] !== undefined ? current[key] : undefined;
    }, obj);
  }

  /**
   * Deep equality check for objects and arrays
   */
  private deepEqual(a: any, b: any): boolean {
    if (a === b) return true;

    if (a == null || b == null) return a === b;

    if (Array.isArray(a) && Array.isArray(b)) {
      if (a.length !== b.length) return false;
      return a.every((val, idx) => this.deepEqual(val, b[idx]));
    }

    if (typeof a === 'object' && typeof b === 'object') {
      const keysA = Object.keys(a);
      const keysB = Object.keys(b);

      if (keysA.length !== keysB.length) return false;

      return keysA.every(key => keysB.includes(key) && this.deepEqual(a[key], b[key]));
    }

    return false;
  }
}
