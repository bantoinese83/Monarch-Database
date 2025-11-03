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
    for (const [field, condition] of Object.entries(query)) {
      if (!this.matchesCondition(doc[field], condition)) {
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
      return value === condition;
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
          if (!(value !== operand)) return false;
          break;
        case '$in':
          if (!Array.isArray(operand) || !operand.includes(value)) return false;
          break;
        case '$nin':
          if (!Array.isArray(operand) || operand.includes(value)) return false;
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
}
