/**
 * Centralized Constants
 * 
 * All magic numbers and configuration constants used throughout the codebase.
 * This prevents duplication and makes limits easy to adjust.
 */

export const LIMITS = {
  // Document limits
  MAX_DOCUMENT_SIZE: 10 * 1024 * 1024, // 10MB per document
  MAX_COLLECTION_SIZE: 100 * 1024 * 1024, // 100MB per collection
  MAX_DOCUMENTS_PER_COLLECTION: 100000,
  MAX_DOCUMENTS_PER_OPERATION: 10000, // 10k documents per batch
  
  // Naming limits
  MAX_FIELD_NAME_LENGTH: 255,
  MAX_COLLECTION_NAME_LENGTH: 100,
  
  // Query limits
  MAX_QUERY_DEPTH: 10, // Maximum nested query depth
  MAX_QUERY_OPERATORS: 20,
  MAX_QUERY_SIZE: 1024 * 1024, // 1MB limit for query objects
  MAX_QUERY_RESULT_CACHE_SIZE: 1000, // Don't cache results larger than this
  
  // Transaction limits
  MAX_COLLECTIONS_PER_DB: 100,
  MAX_INDICES_PER_COLLECTION: 10,
  
  // Serialization limits
  MAX_DATABASE_SAVE_SIZE: 50 * 1024 * 1024, // 50MB
  MAX_DATABASE_LOAD_SIZE: 100 * 1024 * 1024, // 100MB
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
} as const;

