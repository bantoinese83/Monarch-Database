import { PersistenceAdapter, TransactionOptions, SchemaDefinition, ChangeStreamOptions, QueryPlan, DurabilityOptions } from './types';
import { Collection } from './collection';
import { FileSystemAdapter } from './adapters/filesystem';
import { IndexedDBAdapter } from './adapters/indexeddb';
import { CollectionManager } from './collection-manager';
import { DataOperationsManager } from './data-operations-manager';
import { TransactionManager } from './transaction-manager';
import { ChangeStreamsManager } from './change-streams';
import { SchemaValidator } from './schema-validator';
import { QueryOptimizer } from './query-optimizer';
import { OptimizedDataStructures } from './optimized-data-structures';
import { DurabilityManagerImpl } from './durability-manager';
import { SecurityManager } from './security-manager';
import { ClusteringManagerImpl } from './clustering-manager';
import { AIMLIntegration } from './ai-ml-integration';
import { ScriptingEngineImpl } from './scripting-engine';
import { ValidationError, ResourceLimitError } from './errors';
import { logger } from './logger';
import { MonarchConfig } from './monarch-config';
import { ERROR_MESSAGES, LIMITS } from './constants';

/**
 * Monarch Database - Enterprise-Grade In-Memory Database
 *
 * Refactored from god object pattern into focused, modular components:
 * - CollectionManager: Handles collection lifecycle
 * - DataOperationsManager: Handles CRUD and data structure operations
 * - Separate managers for each enterprise feature
 * 
 * Supports dependency injection for better testability and flexibility.
 */
export class Monarch {
  // Core managers - separated concerns
  private collectionManager: CollectionManager;
  private dataOperationsManager: DataOperationsManager;

  // Enterprise feature managers
  private transactionManager: TransactionManager;
  private changeStreams: ChangeStreamsManager;
  private schemaValidator: SchemaValidator;
  private queryOptimizer: QueryOptimizer;
  
  // Lazy-loaded optional enterprise features
  private _durabilityManager?: DurabilityManagerImpl;
  private _securityManager?: SecurityManager;
  private _clusteringManager?: ClusteringManagerImpl;
  private _aiIntegration?: AIMLIntegration;
  private _scriptingEngine?: ScriptingEngineImpl;

  // Configuration and factories for dependency injection
  private config: MonarchConfig;
  private adapter?: PersistenceAdapter;

  // Optimized data structures
  private dataStructures = new OptimizedDataStructures();

  // Schema storage
  private schemas = new Map<string, SchemaDefinition>();

  /**
   * Creates a new Monarch Database instance
   *
   * @param configOrAdapter - Either a MonarchConfig object or a PersistenceAdapter for backward compatibility
   *
   * @example
   * ```typescript
   * // Modern configuration approach
   * const db = new Monarch({
   *   adapter: new FileSystemAdapter('./data'),
   *   enableClustering: true,
   *   security: { encryption: true }
   * });
   *
   * // Legacy adapter approach (still supported)
   * const db = new Monarch(new FileSystemAdapter('./data'));
   *
   * // Default configuration (in-memory only)
   * const db = new Monarch();
   * ```
   */
  constructor(configOrAdapter?: MonarchConfig | PersistenceAdapter) {
    // Handle backward compatibility: if PersistenceAdapter, wrap it in config
    if (configOrAdapter && 'save' in configOrAdapter && typeof configOrAdapter.save === 'function') {
      // It's a PersistenceAdapter (backward compatibility)
      this.config = { adapter: configOrAdapter as PersistenceAdapter };
      this.adapter = configOrAdapter as PersistenceAdapter;
    } else {
      // It's a MonarchConfig or undefined
      this.config = (configOrAdapter as MonarchConfig) || {};
      this.adapter = this.config.adapter;
    }

    // Validate adapter if provided
    if (this.adapter) {
      this.validateAdapter(this.adapter);
    }

    // Initialize core managers
    this.collectionManager = new CollectionManager(this.adapter);
    this.dataOperationsManager = new DataOperationsManager(
      this.collectionManager,
      this.dataStructures
    );

    // Initialize required managers (using factory or default)
    this.transactionManager = this.config.transactionManagerFactory?.() || new TransactionManager();
    this.changeStreams = new ChangeStreamsManager();
    this.schemaValidator = new SchemaValidator();
    this.queryOptimizer = new QueryOptimizer();
  }

  /**
   * Validate adapter implementation
   * @throws ValidationError if adapter is invalid
   */
  private validateAdapter(adapter: PersistenceAdapter): void {
    if (typeof adapter.save !== 'function') {
      throw new ValidationError(
        ERROR_MESSAGES.ADAPTER_SAVE_METHOD_REQUIRED,
        'adapter',
        adapter
      );
    }
    if (typeof adapter.load !== 'function') {
      throw new ValidationError(
        ERROR_MESSAGES.ADAPTER_LOAD_METHOD_REQUIRED,
        'adapter',
        adapter
      );
    }
  }

  // Lazy getters for optional enterprise features (using factories if provided)
  private get durabilityManager(): DurabilityManagerImpl {
    if (!this._durabilityManager) {
      this._durabilityManager = this.config.durabilityManagerFactory?.() 
        || new DurabilityManagerImpl(this.config.durabilityDataPath || './data');
    }
    return this._durabilityManager;
  }

  private get securityManager(): SecurityManager {
    if (!this._securityManager) {
      // Use factory if provided, otherwise use default with configurable key
      if (this.config.securityManagerFactory) {
        this._securityManager = this.config.securityManagerFactory();
      } else {
        // Get encryption key from config or environment, with fallback warning
        // Use typeof check to avoid issues in browser environments
        const envKey = typeof process !== 'undefined' && process.env ? process.env.MONARCH_ENCRYPTION_KEY : undefined;
        const encryptionKey = this.config.encryptionKey 
          || envKey
          || 'monarch-encryption-key-2025-secure-db'; // Default for development
        
        if (!this.config.encryptionKey && !envKey) {
          logger.warn(
            'Using default encryption key. Set MONARCH_ENCRYPTION_KEY environment variable or provide encryptionKey in config for production.',
            {},
            undefined
          );
        }
        
        this._securityManager = new SecurityManager(encryptionKey);
      }
    }
    return this._securityManager;
  }

  private get clusteringManager(): ClusteringManagerImpl {
    if (!this._clusteringManager) {
      this._clusteringManager = this.config.clusteringManagerFactory?.() 
        || new ClusteringManagerImpl();
    }
    return this._clusteringManager;
  }

  private get aiIntegration(): AIMLIntegration {
    if (!this._aiIntegration) {
      this._aiIntegration = this.config.aiIntegrationFactory?.() 
        || new AIMLIntegration();
    }
    return this._aiIntegration;
  }

  private get scriptingEngine(): ScriptingEngineImpl {
    if (!this._scriptingEngine) {
      this._scriptingEngine = this.config.scriptingEngineFactory?.() 
        || new ScriptingEngineImpl();
    }
    return this._scriptingEngine;
  }

  // ===== TRANSACTION METHODS =====

  /**
   * Begin a new transaction
   */
  beginTransaction(options?: TransactionOptions): string {
    return this.transactionManager.begin(options);
  }

  /**
   * Commit a transaction
   */
  commitTransaction(transactionId: string): void {
    const operations = this.transactionManager.commit(transactionId);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const executedOperations: Array<{ collection: string; type: string; data: any; result: any }> = [];

    // Execute all operations atomically
    try {
      for (const operation of operations) {
        const collection = this.getCollection(operation.collection);
        if (!collection) {
          throw new ValidationError(
            ERROR_MESSAGES.COLLECTION_NOT_FOUND(operation.collection),
            'collection',
            operation.collection
          );
        }

        let result;
        switch (operation.type) {
          case 'insert':
            result = collection.insert(operation.data);
            executedOperations.push({ collection: operation.collection, type: operation.type, data: result, result });
            break;
          case 'update': {
            const query = operation.data.query;
            const changes = operation.data.changes;
            result = collection.update(query, changes);
            if (result === 0) {
              throw new ValidationError(
                ERROR_MESSAGES.TRANSACTION_AFFECTED_ZERO('Update'),
                'transactionOperation',
                operation
              );
            }
            executedOperations.push({ collection: operation.collection, type: operation.type, data: { query, changes }, result });
            break;
          }
          case 'remove':
            result = collection.remove(operation.data);
            if (result === 0) {
              throw new ValidationError(
                ERROR_MESSAGES.TRANSACTION_AFFECTED_ZERO('Remove'),
                'transactionOperation',
                operation
              );
            }
            executedOperations.push({ collection: operation.collection, type: operation.type, data: operation.data, result });
            break;
        }
      }
    } catch (error) {
      // If any operation fails, rollback the executed operations
      this.rollbackExecutedOperations(executedOperations);
      throw error;
    }
  }

  /**
   * Rollback executed operations
   * 
   * IMPORTANT LIMITATIONS:
   * - Insert operations: Fully supported - removes inserted documents
   * - Update operations: NOT SUPPORTED - requires storing previous document state
   * - Remove operations: NOT SUPPORTED - requires storing removed document copies
   * 
   * To support full rollback of updates and removes, transactions would need to:
   * 1. Store snapshot of document state before each operation
   * 2. Maintain a log of original values for update operations
   * 3. Store copies of removed documents
   * 
   * This would add significant memory overhead. Currently, only insert rollback
   * is implemented following YAGNI principle - full rollback can be added if needed.
   * 
   * @param executedOperations - Operations that have been executed and need rollback
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private rollbackExecutedOperations(executedOperations: Array<{ collection: string; type: string; data: any; result: any }>): void {
    // Rollback in reverse order
    for (let i = executedOperations.length - 1; i >= 0; i--) {
      const op = executedOperations[i];
      const collection = this.getCollection(op.collection);
      if (!collection) continue;

      try {
        switch (op.type) {
          case 'insert': {
            // Remove the inserted documents - FULLY SUPPORTED
            const insertedDocs = op.result;
            for (const doc of insertedDocs) {
              collection.remove({ _id: doc._id });
            }
            break;
          }
          case 'update':
            // NOT SUPPORTED: Would need to store original document state before update
            // Implementing this would require:
            // - Storing snapshots of documents before each update operation
            // - Significant memory overhead for large transactions
            // Following YAGNI: Only implement if this limitation becomes a problem
            logger.warn(
              ERROR_MESSAGES.TRANSACTION_ROLLBACK_UPDATE_NOT_SUPPORTED,
              { collection: op.collection, operation: op },
              undefined
            );
            break;
          case 'remove':
            // NOT SUPPORTED: Would need to store copies of removed documents
            // Implementing this would require:
            // - Storing full document copies before removal
            // - Significant memory overhead
            // Following YAGNI: Only implement if this limitation becomes a problem
            logger.warn(
              ERROR_MESSAGES.TRANSACTION_ROLLBACK_REMOVE_NOT_SUPPORTED,
              { collection: op.collection, operation: op },
              undefined
            );
            break;
        }
      } catch (rollbackError) {
        logger.error('Error during transaction rollback', { operation: op }, rollbackError as Error);
      }
    }
  }

  /**
   * Rollback a transaction
   */
  rollbackTransaction(transactionId: string): void {
    this.transactionManager.rollback(transactionId);
  }

  /**
   * Add an operation to a transaction
   */
  addToTransaction(
    transactionId: string,
    collection: string,
    operation: 'insert' | 'update' | 'remove',
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    data: any
  ): void {
    this.transactionManager.addOperation(transactionId, operation, collection, data);
  }

  /**
   * Get transaction status
   */
  getTransaction(transactionId: string) {
    return this.transactionManager.getTransaction(transactionId);
  }

  // ===== SCHEMA VALIDATION METHODS =====

  /**
   * Set a schema for a collection
   */
  setSchema(collectionName: string, schema: SchemaDefinition): void {
    this.schemas.set(collectionName, schema);
  }

  /**
   * Get the schema for a collection
   */
  getSchema(collectionName: string): SchemaDefinition | undefined {
    return this.schemas.get(collectionName);
  }

  /**
   * Remove schema from a collection
   */
  removeSchema(collectionName: string): boolean {
    return this.schemas.delete(collectionName);
  }

  /**
   * Validate a document against a collection's schema
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  validateDocument(collectionName: string, document: any): { valid: boolean; errors?: string[] } {
    const schema = this.schemas.get(collectionName);
    if (!schema) {
      return { valid: true }; // No schema means no validation
    }

    return this.schemaValidator.validate(document, schema);
  }

  // ===== CHANGE STREAMS METHODS =====

  /**
   * Add a change stream listener
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  watch(options: ChangeStreamOptions, callback: (event: any) => void): string {
    return this.changeStreams.addListener(options, callback);
  }

  /**
   * Remove a change stream listener
   */
  unwatch(listenerId: string): boolean {
    return this.changeStreams.removeListener(listenerId);
  }

  /**
   * Get change stream statistics
   */
  getChangeStreamStats() {
    return this.changeStreams.getStats();
  }

  // ===== QUERY OPTIMIZATION METHODS =====

  /**
   * Analyze and optimize a query
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  analyzeQuery(collectionName: string, query: any): QueryPlan {
    const collection = this.getCollection(collectionName);
    if (!collection) {
      throw new ValidationError(
        ERROR_MESSAGES.COLLECTION_NOT_FOUND(collectionName),
        'collectionName',
        collectionName
      );
    }

    const indices = collection.getIndices();
    return this.queryOptimizer.optimize(collectionName, query, indices);
  }

  /**
   * Get query optimization suggestions
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  getQuerySuggestions(collectionName: string, query: any): string[] {
    const collection = this.getCollection(collectionName);
    if (!collection) {
      throw new ValidationError(
        ERROR_MESSAGES.COLLECTION_NOT_FOUND(collectionName),
        'collectionName',
        collectionName
      );
    }

    const indices = collection.getIndices();
    return this.queryOptimizer.getOptimizationSuggestions(collectionName, query, indices);
  }

  /**
   * Create a new collection
   */
  addCollection(name: string): Collection {
    const collection = this.collectionManager.createCollection(name);

    // Wire up change event callback to change streams
    collection.setChangeCallback((event) => {
      this.changeStreams.emit(event);
    });

    return collection;
  }

  /**
   * Get an existing collection
   */
  getCollection(name: string): Collection | undefined {
    return this.collectionManager.getCollection(name) || undefined;
  }

  /**
   * Remove a collection
   */
  removeCollection(name: string): boolean {
    return this.collectionManager.deleteCollection(name);
  }

  /**
   * Get all collection names
   */
  getCollectionNames(): string[] {
    return this.collectionManager.getCollectionNames();
  }

  /**
   * Save the database state using the configured adapter
   */
  async save(): Promise<void> {
    if (!this.adapter) {
      throw new ValidationError(
        ERROR_MESSAGES.ADAPTER_NOT_CONFIGURED,
        'adapter',
        this.adapter
      );
    }

    try {
      const data = this.serialize();

      // Validate serialized data size using constants
      const dataSize = JSON.stringify(data).length;
      if (dataSize > LIMITS.MAX_DATABASE_SAVE_SIZE) {
        throw new ResourceLimitError(
          ERROR_MESSAGES.DATABASE_TOO_LARGE_TO_SAVE(dataSize),
          'databaseSize',
          LIMITS.MAX_DATABASE_SAVE_SIZE,
          dataSize
        );
      }

      await this.adapter.save(data);
    } catch (error) {
      // Re-throw specific errors
      if (error instanceof ValidationError || error instanceof ResourceLimitError) {
        throw error;
      }
      throw new ValidationError(
        ERROR_MESSAGES.DATABASE_SAVE_FAILED(error instanceof Error ? error.message : String(error)),
        'saveError',
        error
      );
    }
  }

  /**
   * Load the database state using the configured adapter
   */
  async load(): Promise<void> {
    if (!this.adapter) {
      throw new ValidationError(
        ERROR_MESSAGES.ADAPTER_NOT_CONFIGURED,
        'adapter',
        this.adapter
      );
    }

    try {
      const data = await this.adapter.load();

      // Validate loaded data
      if (data && typeof data !== 'object') {
        throw new ValidationError(
          ERROR_MESSAGES.DATABASE_INVALID_FORMAT,
          'dataFormat',
          typeof data
        );
      }

      // Check data size using constants
      const dataSize = JSON.stringify(data).length;
      if (dataSize > LIMITS.MAX_DATABASE_LOAD_SIZE) {
        throw new ResourceLimitError(
          ERROR_MESSAGES.DATABASE_FILE_TOO_LARGE(dataSize),
          'databaseSize',
          LIMITS.MAX_DATABASE_LOAD_SIZE,
          dataSize
        );
      }

      this.deserialize(data);
    } catch (error) {
      // Re-throw specific errors
      if (error instanceof ValidationError || error instanceof ResourceLimitError) {
        throw error;
      }
      throw new ValidationError(
        ERROR_MESSAGES.DATABASE_LOAD_FAILED(error instanceof Error ? error.message : String(error)),
        'loadError',
        error
      );
    }
  }

  /**
   * Preloads all collections from disk into memory for faster subsequent access.
   * Useful for applications that need to warm up the cache on startup.
   *
   * @returns Promise that resolves when all collections are loaded
   *
   * @example
   * ```typescript
   * const db = new Monarch(new FileSystemAdapter('./data'));
   * await db.preloadCollections(); // Warm up the cache
   * // Now all collections are ready for fast access
   * ```
   */
  async preloadCollections(): Promise<void> {
    if (!this.adapter) {
      logger.warn('No adapter configured, skipping collection preload');
      return;
    }

    try {
      // Load database state if not already loaded
      const data = await this.adapter.load();
      if (data && typeof data === 'object') {
        // Pre-create collection instances for all collections in the data
        for (const collectionName of Object.keys(data)) {
          if (!this.collectionManager.getCollection(collectionName)) {
            this.collectionManager.createCollection(collectionName);
          }
        }
        logger.info('Collections preloaded successfully', { count: Object.keys(data).length });
      }
    } catch (error) {
      logger.warn('Collection preload failed, continuing without preload', { error });
      // Don't throw - preload failure shouldn't break the application
    }
  }

  /**
   * Performs a health check on the database and its components.
   * Useful for monitoring and ensuring database availability.
   *
   * @returns Promise resolving to health status object
   *
   * @example
   * ```typescript
   * const health = await db.healthCheck();
   * if (health.status === 'healthy') {
   *   console.log('Database is operating normally');
   * }
   * ```
   */
  async healthCheck(): Promise<{
    status: 'healthy' | 'degraded' | 'unhealthy';
    uptime: number;
    collections: number;
    memoryUsage: number;
    adapter: string;
    timestamp: number;
  }> {
    const startTime = Date.now();
    let status: 'healthy' | 'degraded' | 'unhealthy' = 'healthy';

    try {
      // Check adapter availability
      if (!this.adapter) {
        status = 'unhealthy';
      } else {
        // Try a simple adapter operation
        await this.adapter.load();
      }

      // Check collection manager
      const collections = this.collectionManager.getCollectionNames().length;

      // Basic memory usage (rough estimate)
      const memoryUsage = process.memoryUsage().heapUsed;

      return {
        status,
        uptime: Date.now() - startTime,
        collections,
        memoryUsage,
        adapter: this.adapter?.constructor.name || 'None',
        timestamp: Date.now()
      };
    } catch (error) {
      logger.error('Health check failed', { error });
      return {
        status: 'unhealthy',
        uptime: Date.now() - startTime,
        collections: 0,
        memoryUsage: 0,
        adapter: 'Unknown',
        timestamp: Date.now()
      };
    }
  }

  /**
   * Create a FileSystemAdapter for Node.js
   */
  static createFileSystemAdapter(filePath: string): FileSystemAdapter {
    return new FileSystemAdapter(filePath);
  }

  /**
   * Create an IndexedDBAdapter for browsers
   */
  static createIndexedDBAdapter(dbName?: string, storeName?: string): IndexedDBAdapter {
    return new IndexedDBAdapter(dbName, storeName);
  }

  /**
   * Get database statistics
   * Uses aggregate method to avoid Law of Demeter violations
   */
  getStats(): { collectionCount: number; totalDocuments: number } {
    return {
      collectionCount: this.collectionManager.getCollectionNames().length,
      totalDocuments: this.collectionManager.getTotalDocumentCount()
    };
  }

  /**
   * Clear all collections and data
   */
  clear(): void {
    for (const collection of this.collectionManager.getAllCollections()) {
      collection.clear();
    }
    this.collectionManager.clearAllCollections();
  }

  // ===== DATA STRUCTURES METHODS =====

  // List Operations
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  async lpush(key: string, values: any[]): Promise<number> {
    return this.dataOperationsManager.lpush(key, values);
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  async rpush(key: string, values: any[]): Promise<number> {
    return this.dataOperationsManager.rpush(key, values);
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  async lpop(key: string): Promise<any> {
    return this.dataOperationsManager.lpop(key);
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  async rpop(key: string): Promise<any> {
    return this.dataOperationsManager.rpop(key);
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  async lrange(key: string, start: number, end: number): Promise<any[]> {
    return this.dataOperationsManager.lrange(key, start, end);
  }

  async llen(key: string): Promise<number> {
    return this.dataOperationsManager.llen(key);
  }

  async ltrim(key: string, start: number, end: number): Promise<void> {
    return this.dataOperationsManager.ltrim(key, start, end);
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  async lindex(key: string, index: number): Promise<any> {
    return this.dataOperationsManager.lindex(key, index);
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  async lset(key: string, index: number, value: any): Promise<void> {
    return this.dataOperationsManager.lset(key, index, value);
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  async lrem(key: string, count: number, value: any): Promise<number> {
    return this.dataOperationsManager.lrem(key, count, value);
  }

  // Set Operations
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  async sadd(key: string, members: any[]): Promise<number> {
    return this.dataOperationsManager.sadd(key, members);
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  async srem(key: string, members: any[]): Promise<number> {
    return this.dataOperationsManager.srem(key, members);
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  async smembers(key: string): Promise<any[]> {
    return this.dataOperationsManager.smembers(key);
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  async sismember(key: string, member: any): Promise<boolean> {
    return this.dataOperationsManager.sismember(key, member);
  }

  async scard(key: string): Promise<number> {
    return this.dataOperationsManager.scard(key);
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  async sdiff(keys: string[]): Promise<any[]> {
    return this.dataOperationsManager.sdiff(keys);
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  async sinter(keys: string[]): Promise<any[]> {
    return this.dataOperationsManager.sinter(keys);
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  async sunion(keys: string[]): Promise<any[]> {
    return this.dataOperationsManager.sunion(keys);
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  async srandmember(key: string, count?: number): Promise<any[]> {
    return this.dataOperationsManager.srandmember(key, count);
  }

  // Hash Operations
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  async hset(key: string, field: string, value: any): Promise<number> {
    return this.dataOperationsManager.hset(key, field, value);
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  async hget(key: string, field: string): Promise<any> {
    return this.dataOperationsManager.hget(key, field);
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  async hgetall(key: string): Promise<Record<string, any>> {
    return this.dataOperationsManager.hgetall(key);
  }

  async hdel(key: string, fields: string[]): Promise<number> {
    return this.dataOperationsManager.hdel(key, fields);
  }

  async hexists(key: string, field: string): Promise<boolean> {
    return this.dataOperationsManager.hexists(key, field);
  }

  async hkeys(key: string): Promise<string[]> {
    return this.dataOperationsManager.hkeys(key);
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  async hvals(key: string): Promise<any[]> {
    return this.dataOperationsManager.hvals(key);
  }

  async hlen(key: string): Promise<number> {
    return this.dataOperationsManager.hlen(key);
  }

  async hincrby(key: string, field: string, increment: number): Promise<number> {
    return this.dataOperationsManager.hincrby(key, field, increment);
  }

  async hincrbyfloat(key: string, field: string, increment: number): Promise<number> {
    return this.dataOperationsManager.hincrbyfloat(key, field, increment);
  }

  // Sorted Set Operations
  async zadd(key: string, scores: Record<string, number>): Promise<number> {
    return this.dataOperationsManager.zadd(key, scores);
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  async zrem(key: string, members: any[]): Promise<number> {
    return this.dataOperationsManager.zrem(key, members);
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  async zscore(key: string, member: any): Promise<number | null> {
    return this.dataOperationsManager.zscore(key, member);
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  async zrank(key: string, member: any): Promise<number | null> {
    return this.dataOperationsManager.zrank(key, member);
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  async zrevrank(key: string, member: any): Promise<number | null> {
    return this.dataOperationsManager.zrevrank(key, member);
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  async zrange(key: string, start: number, end: number, withScores?: boolean): Promise<any[]> {
    return this.dataOperationsManager.zrange(key, start, end, withScores);
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  async zrevrange(key: string, start: number, end: number, withScores?: boolean): Promise<any[]> {
    return this.dataOperationsManager.zrevrange(key, start, end, withScores);
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  async zrangebyscore(key: string, min: number, max: number): Promise<any[]> {
    return this.dataOperationsManager.zrangebyscore(key, min, max);
  }

  async zcard(key: string): Promise<number> {
    return this.dataOperationsManager.zcard(key);
  }

  async zcount(key: string, min: number, max: number): Promise<number> {
    return this.dataOperationsManager.zcount(key, min, max);
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  async zincrby(key: string, increment: number, member: any): Promise<number> {
    return this.dataOperationsManager.zincrby(key, increment, member);
  }

  // Stream Operations
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  async xadd(key: string, id: string, fields: Record<string, any>): Promise<string> {
    return this.dataOperationsManager.xadd(key, id, fields);
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  async xread(streams: Record<string, string>, count?: number, block?: number): Promise<Record<string, any[]>> {
    return this.dataOperationsManager.xread(streams, count, block);
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars, no-unused-vars, @typescript-eslint/no-explicit-any
  async xrange(key: string, start: string, end: string, _count?: number): Promise<any[]> {
    return this.dataOperationsManager.xrange(key, start, end);
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  async xrevrange(key: string, end: string, start: string, count?: number): Promise<any[]> {
    return this.dataOperationsManager.xrevrange(key, end, start, count);
  }

  async xlen(key: string): Promise<number> {
    return this.dataOperationsManager.xlen(key);
  }

  async xdel(key: string, ids: string[]): Promise<number> {
    return this.dataOperationsManager.xdel(key, ids);
  }

  async xtrim(key: string, strategy: 'maxlen' | 'minid', threshold: string | number): Promise<number> {
    return this.dataOperationsManager.xtrim(key, strategy, threshold);
  }

  // Geospatial Operations
  // eslint-disable-next-line @typescript-eslint/no-unused-vars, no-unused-vars
  async geoadd(key: string, longitude: number, latitude: number, member: string, _name?: string): Promise<number> {
    return this.dataOperationsManager.geoadd(key, longitude, latitude, member);
  }

  async geopos(key: string, members: string[]): Promise<Array<{ longitude: number; latitude: number } | null>> {
    return this.dataOperationsManager.geopos(key, members);
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars, no-unused-vars
  async geodist(key: string, member1: string, member2: string, _unit?: 'm' | 'km' | 'mi' | 'ft'): Promise<number | null> {
    return this.dataOperationsManager.geodist(key, member1, member2);
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  async georadius(key: string, longitude: number, latitude: number, radius: number, unit: 'm' | 'km' | 'mi' | 'ft', options?: { withCoord?: boolean; withDist?: boolean; count?: number }): Promise<any[]> {
    return this.dataOperationsManager.georadius(key, longitude, latitude, radius, unit || 'm', options);
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  async georadiusbymember(key: string, member: string, radius: number, unit: 'm' | 'km' | 'mi' | 'ft', options?: { withCoord?: boolean; withDist?: boolean; count?: number }): Promise<any[]> {
    return this.dataOperationsManager.georadiusbymember(key, member, radius, unit, options);
  }

  async geohash(key: string, members: string[]): Promise<string[]> {
    return this.dataOperationsManager.geohash(key, members);
  }

  // Time Series Operations
  async tsadd(key: string, timestamp: number, value: number, labels?: Record<string, string>): Promise<void> {
    return this.dataOperationsManager.tsadd(key, timestamp, value, labels);
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  async tsget(key: string, timestamp: number): Promise<any> {
    return this.dataOperationsManager.tsget(key, timestamp);
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  async tsrange(key: string, fromTimestamp: number, toTimestamp: number): Promise<any[]> {
    return this.dataOperationsManager.tsrange(key, fromTimestamp, toTimestamp);
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  async tsrevrange(key: string, fromTimestamp: number, toTimestamp: number): Promise<any[]> {
    const results = await this.dataOperationsManager.tsrange(key, toTimestamp, fromTimestamp);
    return results.reverse();
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  async tslast(key: string): Promise<any> {
    return this.dataOperationsManager.tslast(key);
  }

  async tscount(key: string): Promise<number> {
    return this.dataOperationsManager.tscount(key);
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  async tsmin(key: string): Promise<any> {
    return this.dataOperationsManager.tsmin(key);
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  async tsmax(key: string): Promise<any> {
    return this.dataOperationsManager.tsmax(key);
  }

  async tsavg(key: string, fromTimestamp?: number, toTimestamp?: number): Promise<number | null> {
    return this.dataOperationsManager.tsavg(key, fromTimestamp, toTimestamp);
  }

  // Vector Operations
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  async vadd(key: string, id: string, vector: number[], metadata?: Record<string, any>): Promise<void> {
    return this.dataOperationsManager.vadd(key, id, vector, metadata);
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  async vget(key: string, id: string): Promise<any> {
    return this.dataOperationsManager.vget(key, id);
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars, no-unused-vars, @typescript-eslint/no-explicit-any
  async vsearch(key: string, queryVector: number[], topK?: number, includeMetadata?: boolean): Promise<any[]> {
    return this.dataOperationsManager.vsearch(key, queryVector, topK, includeMetadata);
  }

  async vdel(key: string, ids: string[]): Promise<number> {
    return this.dataOperationsManager.vdel(key, ids);
  }

  async vcount(key: string): Promise<number> {
    return this.dataOperationsManager.vcount(key);
  }

  // ===== DURABILITY METHODS =====

  /**
   * Configure durability options
   */
  configureDurability(options: DurabilityOptions): Promise<void> {
    return this.durabilityManager.configure(options);
  }

  /**
   * Create a database snapshot
   */
  createSnapshot(): Promise<string> {
    return this.durabilityManager.createSnapshot();
  }

  /**
   * Get durability statistics
   */
  getDurabilityStats(): Promise<{ walSize: number; snapshots: number; lastSync: number }> {
    return this.durabilityManager.getStats();
  }

  // ===== SECURITY METHODS =====

  /**
   * Authenticate a user
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  authenticateUser(username: string, password: string): Promise<any> {
    return this.securityManager.authenticate(username, password);
  }

  /**
   * Create a new user
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  createUser(username: string, password: string, roles: string[] = ['user']): Promise<any> {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return this.securityManager.createUser(username, password, roles as any);
  }

  /**
   * Authorize a permission for the current context
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  authorize(context: any, permission: string): boolean {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return this.securityManager.authorize(context, permission as any);
  }

  /**
   * Hash a password
   */
  hashPassword(password: string): Promise<string> {
    return this.securityManager.hashPassword(password);
  }

  /**
   * Verify a password
   */
  verifyPassword(password: string, hash: string): Promise<boolean> {
    return this.securityManager.verifyPassword(password, hash);
  }

  /**
   * Update user roles
   */
  updateUserRoles(username: string, roles: string[]): void {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    this.securityManager.updateUserRoles(username, roles as any);
  }

  /**
   * Delete a user
   */
  deleteUser(username: string): void {
    this.securityManager.deleteUser(username);
  }

  /**
   * Check resource-level access
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  checkResourceAccess(context: any, resource: string, permission: string): boolean {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return this.securityManager.checkResourceAccess(context, resource, permission as any);
  }

  /**
   * Encrypt data
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  encrypt(data: any): Promise<string> {
    return this.securityManager.encrypt(data);
  }

  /**
   * Decrypt data
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  decrypt(encryptedData: string): Promise<any> {
    return this.securityManager.decrypt(encryptedData);
  }

  // Alias methods for backward compatibility
  authorizePermission = this.authorize;
  encryptData = this.encrypt;
  decryptData = this.decrypt;

  /**
   * Get security statistics
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  getSecurityStats(): any {
    return this.securityManager.getSecurityStats();
  }

  // ===== CLUSTERING METHODS =====

  /**
   * Join a cluster
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  joinCluster(config: any): Promise<void> {
    return this.clusteringManager.joinCluster(config);
  }

  /**
   * Leave the cluster
   */
  leaveCluster(): Promise<void> {
    return this.clusteringManager.leaveCluster();
  }

  /**
   * Get cluster statistics
   */
  getClusterStats(): Promise<{ nodes: number; shards: number; health: number }> {
    return this.clusteringManager.getClusterStats();
  }

  /**
   * Redistribute data across cluster
   */
  redistributeClusterData(): Promise<void> {
    return this.clusteringManager.redistributeData();
  }

  // ===== AI/ML METHODS =====

  /**
   * Load an ML model
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  loadMLModel(model: any, modelData: Buffer): Promise<string> {
    return this.aiIntegration.loadModel(model, modelData);
  }

  /**
   * Run ML inference
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  runMLInference(modelId: string, input: number[][]): Promise<any> {
    return this.aiIntegration.runInference(modelId, input);
  }

  /**
   * Train an ML model
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  trainMLModel(modelId: string, data: any, options?: any): Promise<any> {
    return this.aiIntegration.trainModel(modelId, data, options);
  }

  /**
   * Get ML model statistics
   */
  getMLModelStats(modelId: string): Promise<{ accuracy: number; latency: number; throughput: number }> {
    return this.aiIntegration.getModelStats(modelId);
  }

  // ===== SCRIPTING METHODS =====

  /**
   * Load a script
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  loadScript(script: any): Promise<string> {
    return this.scriptingEngine.loadScript(script);
  }

  /**
   * Execute a script
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  executeScript(scriptId: string, context?: any): Promise<any> {
    return this.scriptingEngine.executeScript(scriptId, context || {});
  }

  /**
   * Get script statistics
   */
  getScriptStats(scriptId: string): Promise<{ executions: number; avgTime: number; errors: number }> {
    return this.scriptingEngine.getScriptStats(scriptId);
  }

  /**
   * Create a stored procedure
   */
  createStoredProcedure(name: string, scriptId: string, parameters: string[]): Promise<string> {
    return this.scriptingEngine.createStoredProcedure(name, scriptId, parameters);
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private serialize(): any {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const data: any = {
      collections: {}
    };

    for (const collection of this.collectionManager.getAllCollections()) {
      const name = collection.getName();
      data.collections[name] = collection.serialize();
    }

    return data;
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private deserialize(data: any): void {
    this.clear();

    if (!data) return;

    try {
      this.loadCollectionsFromData(data);
    } catch (error) {
      // If deserialization fails, try to recover with empty state
      logger.warn('Database deserialization failed, starting with empty database', { error: error instanceof Error ? error.message : String(error) });
      this.clear();
    }
  }

  /**
   * Load collections from deserialized data
   * Uses constants and specific error types
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private loadCollectionsFromData(data: any): void {
    if (!data.collections || typeof data.collections !== 'object') return;

    const collectionEntries = Object.entries(data.collections);
    if (collectionEntries.length > LIMITS.MAX_COLLECTIONS_PER_DB) {
      throw new ResourceLimitError(
        ERROR_MESSAGES.TOO_MANY_COLLECTIONS(LIMITS.MAX_COLLECTIONS_PER_DB),
        'collections',
        LIMITS.MAX_COLLECTIONS_PER_DB,
        collectionEntries.length
      );
    }

    for (const [name, collectionData] of collectionEntries) {
      try {
        this.createCollectionFromData(name, collectionData);
      } catch (error) {
        logger.warn(
          ERROR_MESSAGES.COLLECTION_LOAD_FAILED(
            name,
            error instanceof Error ? error.message : String(error)
          ),
          { collectionName: name },
          error as Error
        );
        // Continue with other collections
      }
    }
  }

  /**
   * Create a collection from deserialized data
   * Uses constants and specific error types
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private createCollectionFromData(name: string, collectionData: any): void {
    if (!collectionData || typeof collectionData !== 'object') {
      throw new ValidationError(
        ERROR_MESSAGES.COLLECTION_DATA_INVALID(name),
        'collectionData',
        collectionData
      );
    }

    const collection = this.addCollection(name);

    // Use collection's deserialize method to restore full state
    collection.deserialize(collectionData);
  }

  /**
   * Restore collection indices from deserialized data
   * Uses constants and specific error types
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private restoreCollectionIndices(collection: Collection, indices: any[]): void {
    if (indices.length > LIMITS.MAX_INDICES_PER_COLLECTION) {
      throw new ResourceLimitError(
        ERROR_MESSAGES.INDEX_TOO_MANY(LIMITS.MAX_INDICES_PER_COLLECTION),
        'indices',
        LIMITS.MAX_INDICES_PER_COLLECTION,
        indices.length
      );
    }

    for (const indexField of indices) {
      if (typeof indexField !== 'string') {
        throw new ValidationError(
          ERROR_MESSAGES.INDEX_FIELD_MUST_BE_STRING,
          'indexField',
          indexField
        );
      }
      try {
        collection.createIndex(indexField);
      } catch (error) {
        logger.warn(
          `Failed to restore index on field '${indexField}'`,
          { indexField },
          error as Error
        );
        // Continue with other indices
      }
    }
  }
}
