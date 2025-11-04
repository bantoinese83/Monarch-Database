/**
 * Centralized Constants
 * 
 * All magic numbers and configuration constants used throughout the codebase.
 * This prevents duplication and makes limits easy to adjust.
 */

export const LIMITS = {
  // Document limits
  MAX_DOCUMENT_SIZE: 50 * 1024 * 1024, // 50MB per document (increased for flexibility)
  MAX_COLLECTION_SIZE: 1024 * 1024 * 1024, // 1GB per collection (increased)
  MAX_DOCUMENTS_PER_COLLECTION: 1000000, // 1M documents per collection
  MAX_DOCUMENTS_PER_OPERATION: 50000, // 50k documents per batch (increased)

  // Naming limits
  MAX_FIELD_NAME_LENGTH: 255,
  MAX_COLLECTION_NAME_LENGTH: 100,

  // Query limits
  MAX_QUERY_DEPTH: 20, // Increased nested query depth
  MAX_QUERY_OPERATORS: 50, // Increased operator limit
  MAX_QUERY_SIZE: 10 * 1024 * 1024, // 10MB limit for query objects
  MAX_QUERY_RESULT_CACHE_SIZE: 10000, // Increased cache size

  // Database limits
  MAX_COLLECTIONS_PER_DB: 1000, // Increased from 100 to 1000 for testing
  MAX_INDICES_PER_COLLECTION: 20, // Increased index limit

  // Concurrent operation limits
  MAX_CONCURRENT_OPERATIONS: 100, // Max concurrent operations
  MAX_OPERATIONS_PER_SECOND: 10000, // Rate limiting (ops/sec)
  CIRCUIT_BREAKER_THRESHOLD: 0.8, // Circuit breaker activation threshold

  // Serialization limits
  MAX_DATABASE_SAVE_SIZE: 10 * 1024 * 1024 * 1024, // 10GB (increased)
  MAX_DATABASE_LOAD_SIZE: 20 * 1024 * 1024 * 1024, // 20GB (increased)

  // Memory limits
  MAX_MEMORY_USAGE: 2048 * 1024 * 1024, // 2GB memory limit
  MAX_CACHE_SIZE: 500 * 1024 * 1024, // 500MB cache limit

  // Timeout limits
  DEFAULT_OPERATION_TIMEOUT: 30000, // 30 seconds
  BULK_OPERATION_TIMEOUT: 600000, // 10 minutes for bulk ops
  CONNECTION_TIMEOUT: 5000, // 5 seconds
} as const;

export const ERROR_MESSAGES = {
  // Collection validation
  COLLECTION_NAME_REQUIRED: 'Collection name must be a non-empty string',
  COLLECTION_NAME_TOO_LONG: (maxLength: number) => `Collection name too long (max ${maxLength} characters)`,
  COLLECTION_NAME_INVALID_CHARS: 'Collection name contains invalid characters',
  COLLECTION_NOT_FOUND: (name: string) => `Collection '${name}' not found`,
  COLLECTION_ALREADY_EXISTS: (name: string) => `Collection '${name}' already exists`,
  
  // Document validation
  DOCUMENT_REQUIRED: 'Document(s) required for insert operation',
  DOCUMENT_ARRAY_REQUIRED: 'Document array required for bulk operations',
  DOCUMENT_MUST_BE_OBJECT: 'Document must be a valid object',
  DOCUMENT_TOO_LARGE: (size: number, max: number) => `Document too large (${size} bytes, max ${max} bytes)`,
  DOCUMENT_CIRCULAR_REF: 'Document contains circular references',
  DOCUMENT_NON_SERIALIZABLE: 'Document contains non-serializable data',
  DOCUMENT_ID_INVALID: (id: string) => `Invalid document ID format: ${id}`,
  DOCUMENT_ID_EXISTS: (id: string) => `Document with ID '${id}' already exists`,
  DOCUMENT_ARRAY_EMPTY: 'Cannot insert empty document array',
  DOCUMENT_BATCH_TOO_LARGE: (max: number) => `Too many documents in batch (max ${max})`,
  
  // Field validation
  FIELD_NAME_MUST_BE_STRING: 'Field names must be strings',
  FIELD_NAME_TOO_LONG: (field: string, maxLength: number) => `Field name "${field}" too long (max ${maxLength} characters)`,
  FIELD_NAME_DANGEROUS: (field: string) => `Top-level field names cannot start with "$": ${field}`,
  
  // Query validation
  QUERY_MUST_BE_OBJECT: 'Query must be a valid object',
  QUERY_REQUIRED: 'Query required for update operation',
  QUERY_TOO_DEEP: (maxDepth: number) => `Query too deeply nested (max depth ${maxDepth})`,
  QUERY_TOO_COMPLEX: (maxOperators: number) => `Query too complex (max ${maxOperators} operators)`,
  QUERY_TOO_LARGE: (maxSize: number) => `Query too complex (max ${maxSize} bytes)`,
  QUERY_INVALID_OPERATORS: (operators: string[]) => `Invalid query operators: ${operators.join(', ')}`,
  QUERY_UNKNOWN_OPERATOR: (operator: string) => `Unknown operator: ${operator}`,
  
  // Update validation
  UPDATE_CHANGES_REQUIRED: 'Changes object required for update operation',
  UPDATE_MUST_SPECIFY_FIELD: 'Update operation must specify at least one field to change',
  UPDATE_ID_FORBIDDEN: 'Cannot update _id field',
  UPDATE_NESTED_NOT_SUPPORTED: 'Nested object updates not supported',
  
  // Transaction
  TRANSACTION_NOT_FOUND: (id: string) => `Transaction ${id} not found`,
  TRANSACTION_NOT_ACTIVE: (id: string) => `Transaction ${id} is not active`,
  TRANSACTION_TIMEOUT: (id: string) => `Transaction ${id} timed out`,
  TRANSACTION_MAX_EXCEEDED: 'Maximum number of concurrent transactions exceeded',
  TRANSACTION_ROLLBACK_UPDATE_NOT_SUPPORTED: 'Transaction rollback for updates is not fully supported',
  TRANSACTION_ROLLBACK_REMOVE_NOT_SUPPORTED: 'Transaction rollback for removes is not fully supported',
  TRANSACTION_AFFECTED_ZERO: (operation: string) => `${operation} operation in transaction affected 0 documents`,
  
  // Resource limits
  COLLECTION_SIZE_LIMIT_EXCEEDED: (size: number, max: number) => `Collection size limit exceeded (${size} bytes, max ${max} bytes)`,
  COLLECTIONS_LIMIT_EXCEEDED: (limit: number) => `Maximum collections limit reached (max ${limit})`,
  DOCUMENT_ID_COUNTER_OVERFLOW: 'Document ID counter overflow - too many documents created',
  
  // Adapter
  ADAPTER_NOT_CONFIGURED: 'No persistence adapter configured',
  ADAPTER_SAVE_METHOD_REQUIRED: 'Adapter must implement save() method',
  ADAPTER_LOAD_METHOD_REQUIRED: 'Adapter must implement load() method',
  DATABASE_TOO_LARGE_TO_SAVE: (size: number) => `Database too large to save (${size} bytes, max ${LIMITS.MAX_DATABASE_SAVE_SIZE} bytes)`,
  DATABASE_INVALID_FORMAT: 'Invalid database format: expected object',
  DATABASE_FILE_TOO_LARGE: (size: number) => `Database file too large (${size} bytes, max ${LIMITS.MAX_DATABASE_LOAD_SIZE} bytes)`,
  DATABASE_SAVE_FAILED: (message: string) => `Failed to save database: ${message}`,
  DATABASE_LOAD_FAILED: (message: string) => `Failed to load database: ${message}`,
  
  // Index
  INDEX_ALREADY_EXISTS: (field: string) => `Index already exists for field: ${field}`,
  INDEX_TOO_MANY: (max: number) => `Too many indices in collection (max ${max})`,
  INDEX_FIELD_MUST_BE_STRING: 'Index field must be a string',
  
  // Deserialization
  TOO_MANY_COLLECTIONS: (max: number) => `Too many collections in database file (max ${max})`,
  COLLECTION_LOAD_FAILED: (name: string, message: string) => `Failed to load collection '${name}': ${message}`,
  COLLECTION_DATA_INVALID: (name: string) => `Invalid collection data for '${name}'`,
  DOCUMENTS_FORMAT_INVALID: (name: string) => `Invalid documents format for collection '${name}'`,
  DOCUMENTS_TOO_MANY: (name: string, max: number) => `Too many documents in collection '${name}' (max ${max})`,
  INDICES_FORMAT_INVALID: (name: string) => `Invalid indices format for collection '${name}'`,
  
  // Query Engine
  QUERY_ENGINE_INVALID_PARAMS: 'Invalid parameters for query execution',

  // Concurrency and Performance
  CONCURRENT_OPERATIONS_EXCEEDED: (current: number, max: number) =>
    `Concurrent operations limit exceeded: ${current}/${max} operations active`,
  RATE_LIMIT_EXCEEDED: (current: number, max: number) =>
    `Rate limit exceeded: ${current.toFixed(1)}/${max} operations per second`,
  CIRCUIT_BREAKER_OPEN: 'Circuit breaker is open due to high failure rate - operations temporarily blocked',
  CIRCUIT_BREAKER_ACTIVATED: (failures: number, threshold: number) =>
    `Circuit breaker activated: ${failures} recent failures exceeded ${(threshold * 100).toFixed(0)}% threshold`,
  OPERATION_TIMEOUT: (operation: string, timeout: number) =>
    `Operation '${operation}' timed out after ${timeout}ms`,
  BULK_OPERATION_PARTIAL_FAILURE: (success: number, failed: number, total: number) =>
    `Bulk operation completed with partial failure: ${success}/${total} successful, ${failed} failed`,
  MEMORY_LIMIT_EXCEEDED: (current: number, max: number) =>
    `Memory limit exceeded: ${(current / 1024 / 1024).toFixed(1)}MB used, ${(max / 1024 / 1024).toFixed(1)}MB limit`,
  SYSTEM_OVERLOAD: 'System temporarily overloaded - please retry later',
  RESOURCE_CONTENTION: 'Resource contention detected - operation queued for later execution',
} as const;

