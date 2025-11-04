import { Document, Query, UpdateOperation, ChangeEvent } from './types';
import { generateSequentialId, isValidId } from './utils';
import { QueryEngine } from './query-engine';
import { QueryCache } from './query-cache';
import { globalMonitor } from './performance-monitor';
import { CollectionValidator, DocumentValidator, QueryValidator } from './validators';
import { ValidationError, ResourceLimitError, DataIntegrityError } from './errors';
import { LIMITS, ERROR_MESSAGES } from './constants';
import { logger } from './logger';
import { QueryPlanCache, fastClone, fastMerge, deepMerge, globalProfiler } from './performance-optimizer';
import { BulkInsertOptions, BulkInsertResult, BulkDeleteOptions, BulkDeleteResult } from './types';

export class Collection {
  // Use Map for O(1) document access and removal
  private documents: Map<string, Document> = new Map();
  private indices: Map<string, Map<any, Set<string>>> = new Map(); // field -> value -> Set<docId>
  private queryCache: QueryCache = new QueryCache();
  private queryPlanCache: QueryPlanCache = new QueryPlanCache(1000); // Cache query plans
  private queryEngine: QueryEngine = new QueryEngine(); // Reuse engine instance
  private nextId: number = 0;
  private readonly maxDocuments: number = LIMITS.MAX_DOCUMENTS_PER_COLLECTION;
  private changeCallback?: (event: ChangeEvent) => void;
  
  // Pre-allocated arrays for batch operations (reuse to reduce allocations)
  private batchArrayPool: Document[][] = [];

  constructor(private name: string) {
    CollectionValidator.validateName(name);
  }

  /**
   * Set the change event callback (used by Monarch for change streams)
   */
  setChangeCallback(callback: (event: ChangeEvent) => void): void {
    this.changeCallback = callback;
  }

  /**
   * Calculate collection size in bytes
   * Uses DocumentValidator for consistency
   */
  private calculateCollectionSize(): number {
    let totalSize = 0;
    for (const doc of this.documents.values()) {
      totalSize += DocumentValidator.calculateSize(doc);
    }
    return totalSize;
  }

  /**
   * Check memory limits and throw ResourceLimitError if exceeded
   */
  private checkMemoryLimits(): void {
    const collectionSize = this.calculateCollectionSize();
    if (collectionSize > LIMITS.MAX_COLLECTION_SIZE) {
      throw new ResourceLimitError(
        ERROR_MESSAGES.COLLECTION_SIZE_LIMIT_EXCEEDED(collectionSize, LIMITS.MAX_COLLECTION_SIZE),
        'collectionSize',
        LIMITS.MAX_COLLECTION_SIZE,
        collectionSize
      );
    }
  }

  /**
   * Emit a change event if callback is set
   * Encapsulates change event emission to avoid Law of Demeter violations
   */
  private emitChangeEvent(event: ChangeEvent): void {
    if (this.changeCallback) {
      try {
        this.changeCallback(event);
      } catch (error) {
        logger.warn('Change event callback threw an error', { event }, error as Error);
      }
    }
  }

  /**
   * Cache query result if it's small enough
   * Encapsulates cache logic to avoid Law of Demeter violations
   */
  private cacheQueryResult(query: Query, result: Document[]): void {
    if (result.length <= LIMITS.MAX_QUERY_RESULT_CACHE_SIZE) {
      this.queryCache.set(query, result);
    }
  }

  getName(): string {
    return this.name;
  }

  /**
   * Insert one or more documents into the collection
   */
  insert(doc: Document | Document[]): Document[] {
    if (!doc) {
      throw new ValidationError(ERROR_MESSAGES.DOCUMENT_REQUIRED, 'document', doc);
    }

    const docs = Array.isArray(doc) ? doc : [doc];

    if (docs.length === 0) {
      throw new ValidationError(ERROR_MESSAGES.DOCUMENT_ARRAY_EMPTY, 'documents', docs);
    }

    if (docs.length > LIMITS.MAX_DOCUMENTS_PER_OPERATION) {
      throw new ResourceLimitError(
        ERROR_MESSAGES.DOCUMENT_BATCH_TOO_LARGE(LIMITS.MAX_DOCUMENTS_PER_OPERATION),
        'documentBatch',
        LIMITS.MAX_DOCUMENTS_PER_OPERATION,
        docs.length
      );
    }

    // Validate all documents first using centralized validator
    for (const document of docs) {
      DocumentValidator.validate(document);
    }

    globalMonitor.start('insert');

    try {
      const inserted = this.storeDocuments(docs);

      // Check memory limits after insertion
      this.checkMemoryLimits();

      this.updateIndicesForDocuments(inserted);
      this.invalidateCacheForIndexedFields();

      // Emit change events (optimized: batch timestamp)
      const timestamp = Date.now();
      for (const doc of inserted) {
        this.emitChangeEvent({
          type: 'insert',
          collection: this.name,
          document: fastClone(doc), // Use fastClone instead of spread
          timestamp
        });
      }

      globalMonitor.end('insert');
      return inserted;
    } catch (error) {
      globalMonitor.end('insert');
      throw error;
    }
  }

  /**
   * Bulk insert multiple documents with optimized performance
   * Designed for large-scale data operations (10k+ documents)
   */
  insertMany(documents: Document[], options: BulkInsertOptions = {}): BulkInsertResult {
    const {
      batchSize = 5000, // Process in batches of 5k for memory efficiency
      skipValidation = false,
      emitEvents = true,
      timeout = 300000 // 5 minutes default for bulk operations
    } = options;

    if (!documents || !Array.isArray(documents)) {
      throw new ValidationError(ERROR_MESSAGES.DOCUMENT_ARRAY_REQUIRED, 'documents', documents);
    }

    if (documents.length === 0) {
      return { insertedCount: 0, insertedIds: [] };
    }

    // Higher limit for bulk operations (100k documents)
    const maxBulkDocuments = 100000;
    if (documents.length > maxBulkDocuments) {
      throw new ResourceLimitError(
        `Bulk insert too large: maximum ${maxBulkDocuments} documents allowed, got ${documents.length}`,
        'bulkInsert',
        maxBulkDocuments,
        documents.length
      );
    }

    // Validate documents if not skipped
    if (!skipValidation) {
      logger.info('Validating bulk insert documents', { count: documents.length });
      for (const document of documents) {
        DocumentValidator.validate(document);
      }
    }

    globalMonitor.startWithTimeout('insertMany', timeout);

    try {
      const insertedIds: string[] = [];
      let totalInserted = 0;

      // Process in batches for memory efficiency
      for (let i = 0; i < documents.length; i += batchSize) {
        const batch = documents.slice(i, i + batchSize);
        logger.info('Processing bulk insert batch', {
          batchIndex: Math.floor(i / batchSize) + 1,
          batchSize: batch.length,
          totalProcessed: i + batch.length,
          totalDocuments: documents.length
        });

        const batchInserted = this.storeDocuments(batch);

        // Collect IDs and update indices in batches
        const batchIds: string[] = [];
        for (const doc of batchInserted) {
          batchIds.push(doc._id as string);
        }

        insertedIds.push(...batchIds);
        totalInserted += batchInserted.length;

        // Batch index updates for better performance
        this.updateIndicesForDocuments(batchInserted);
        this.invalidateCacheForIndexedFields();

        // Check memory limits periodically
        if (totalInserted % 10000 === 0) {
          this.checkMemoryLimits();
        }

        // Emit change events if requested (batched)
        if (emitEvents) {
          const timestamp = Date.now();
          for (const doc of batchInserted) {
            this.emitChangeEvent({
              type: 'insert',
              collection: this.name,
              document: { ...doc },
              timestamp
            });
          }
        }
      }

      // Final memory check
      this.checkMemoryLimits();

      logger.info('Bulk insert completed', {
        totalDocuments: documents.length,
        insertedCount: totalInserted,
        batchSize,
        duration: globalMonitor.end('insertMany')
      });

      return {
        insertedCount: totalInserted,
        insertedIds
      };

    } catch (error) {
      globalMonitor.end('insertMany');
      logger.error('Bulk insert failed', { error: (error as Error).message, documentsCount: documents.length });
      throw error;
    }
  }

  private storeDocuments(docs: Document[]): Document[] {
    // Pre-allocate array with known size for better performance
    const inserted: Document[] = new Array(docs.length);
    let insertIndex = 0;

    for (const document of docs) {
      // Use fastClone for better performance on small objects
      const docToInsert = fastClone(document);

      // Generate sequential _id for better performance
      if (!docToInsert._id) {
        // Check bounds to prevent counter overflow
        if (this.nextId >= Number.MAX_SAFE_INTEGER - 1) {
          throw new ResourceLimitError(
            ERROR_MESSAGES.DOCUMENT_ID_COUNTER_OVERFLOW,
            'documentIdCounter',
            Number.MAX_SAFE_INTEGER - 1,
            this.nextId
          );
        }
        docToInsert._id = generateSequentialId(this.nextId++);
      }

      const docId = docToInsert._id as string;

      // Validate ID format and uniqueness using centralized validator
      if (!isValidId(docId)) {
        DocumentValidator.validateId(docId);
      }

      if (this.documents.has(docId)) {
        throw new ValidationError(
          ERROR_MESSAGES.DOCUMENT_ID_EXISTS(docId),
          'documentId',
          docId
        );
      }

      this.documents.set(docId, docToInsert);
      inserted[insertIndex++] = docToInsert;
    }

    // Return exact size array (no unused slots)
    return inserted.slice(0, insertIndex);
  }

  private updateIndicesForDocuments(documents: Document[]): void {
    const indexUpdates: Array<{ field: string; value: any; docId: string }> = [];

    for (const doc of documents) {
      const docId = doc._id as string;

      for (const [fieldName] of this.indices) {
        const value = doc[fieldName];
        if (value !== undefined) {
          indexUpdates.push({ field: fieldName, value, docId });
        }
      }
    }

    this.batchUpdateIndices(indexUpdates);
  }

  private invalidateCacheForIndexedFields(): void {
    for (const fieldName of this.indices.keys()) {
      this.queryCache.invalidateByField(fieldName);
    }
  }

  /**
   * Find documents matching the query
   */
  find(query?: Query): Document[] {
    // Validate query if provided using centralized validator
    if (query && Object.keys(query).length > 0) {
      QueryValidator.validate(query);
    }

    globalMonitor.start('find');

    try {
      // Optimize empty query (fast path)
      if (!query || Object.keys(query).length === 0) {
        // Pre-allocate array with exact size
        const docs = new Array(this.documents.size);
        let index = 0;
        for (const doc of this.documents.values()) {
          docs[index++] = doc;
        }
        return docs;
      }

      // Check cache first
      const cachedResult = this.queryCache.get(query);
      if (cachedResult) {
        globalMonitor.end('find');
        return cachedResult;
      }

      // Execute query (reuse engine instance for better performance)
      const result = this.queryEngine.execute(this.documents, this.indices, query);

      // Cache the result using encapsulated method
      this.cacheQueryResult(query, result);

      globalMonitor.end('find');
      return result;
    } catch (error) {
      globalMonitor.end('find');
      throw error;
    }
  }

  /**
   * Async version of find with options
   */
  async findAsync(query?: Query, options?: { limit?: number; skip?: number }): Promise<Document[]> {
    const results = this.find(query);
    let filtered = results;

    if (options?.skip) {
      filtered = filtered.slice(options.skip);
    }
    if (options?.limit) {
      filtered = filtered.slice(0, options.limit);
    }

    return filtered;
  }

  /**
   * Find one document
   */
  async findOne(query: Query): Promise<Document | null> {
    const results = this.find(query);
    return results.length > 0 ? results[0] : null;
  }

  /**
   * Count documents
   */
  async count(query?: Query): Promise<number> {
    const results = this.find(query);
    return results.length;
  }

  /**
   * Get distinct values
   */
  async distinct(field: string, query?: Query): Promise<any[]> {
    const results = this.find(query);
    const values = new Set();

    for (const doc of results) {
      if (doc[field] !== undefined) {
        values.add(doc[field]);
      }
    }

    return Array.from(values);
  }

  /**
   * Create index (synchronous)
   */
  createIndex(field: string, options?: { unique?: boolean }): void {
    if (this.indices.has(field)) {
      throw new ValidationError(
        ERROR_MESSAGES.INDEX_ALREADY_EXISTS(field),
        'indexField',
        field
      );
    }

    if (this.indices.size >= LIMITS.MAX_INDICES_PER_COLLECTION) {
      throw new ResourceLimitError(
        ERROR_MESSAGES.INDEX_TOO_MANY(LIMITS.MAX_INDICES_PER_COLLECTION),
        'indices',
        LIMITS.MAX_INDICES_PER_COLLECTION,
        this.indices.size + 1
      );
    }

    const indexMap = new Map<any, Set<string>>();
    this.indices.set(field, indexMap);

    // Build index for existing documents
    for (const [docId, doc] of this.documents) {
      const value = doc[field];
      if (value !== undefined) {
        if (!indexMap.has(value)) {
          indexMap.set(value, new Set());
        }
        indexMap.get(value)!.add(docId);
      }
    }

    // Invalidate cache since indexing changes query performance
    this.queryCache.clear();
  }

  /**
   * Create index (async)
   */
  async createIndexAsync(field: string, options?: { unique?: boolean }): Promise<void> {
    return this.createIndex(field, options);
  }

  /**
   * Drop index
   */
  async dropIndex(field: string): Promise<void> {
    this.indices.delete(field);
  }

  /**
   * Update documents matching the query with the provided changes
   * Creates new document instances instead of mutating existing ones to minimize side effects
   */
  update(query: Query, changes: UpdateOperation): number {
    if (!query) {
      throw new ValidationError(ERROR_MESSAGES.QUERY_REQUIRED, 'query', query);
    }

    if (!changes || typeof changes !== 'object') {
      throw new ValidationError(ERROR_MESSAGES.UPDATE_CHANGES_REQUIRED, 'changes', changes);
    }

    // Validate using centralized validators
    QueryValidator.validateUpdateOperation(changes);
    QueryValidator.validate(query);

    globalMonitor.start('update');

    try {
      const matchingDocs = this.find(query);
      let updatedCount = 0;

      // Collect index updates for batch processing
      const indexRemovals: Array<{ field: string; value: any; docId: string }> = [];
      const indexAdditions: Array<{ field: string; value: any; docId: string }> = [];

      for (const doc of matchingDocs) {
        const docId = doc._id as string;

        // Collect current index values for removal
        for (const [fieldName] of this.indices) {
          const oldValue = doc[fieldName];
          if (oldValue !== undefined) {
            indexRemovals.push({ field: fieldName, value: oldValue, docId });
          }
        }

        // Create new document instance using fastMerge for better performance
        const updatedDoc = fastMerge(doc, changes);
        this.documents.set(docId, updatedDoc);
        updatedCount++;

        // Collect new index values for addition
        for (const [fieldName] of this.indices) {
          const newValue = updatedDoc[fieldName];
          if (newValue !== undefined) {
            indexAdditions.push({ field: fieldName, value: newValue, docId });
          }
        }
      }

      // Batch apply index updates
      this.batchRemoveFromIndices(indexRemovals);
      this.batchUpdateIndices(indexAdditions);

      // Invalidate cache for affected fields
      const affectedFields = new Set(Object.keys(changes));
      for (const fieldName of affectedFields) {
        this.queryCache.invalidateByField(fieldName);
      }
      // Also invalidate by query fields
      for (const fieldName of Object.keys(query)) {
        this.queryCache.invalidateByField(fieldName);
      }

      // Emit change events for updated documents (using current document state)
      for (const docId of matchingDocs.map(d => d._id as string)) {
        const updatedDoc = this.documents.get(docId);
        if (updatedDoc) {
          this.emitChangeEvent({
            type: 'update',
            collection: this.name,
            document: { ...updatedDoc },
            timestamp: Date.now()
          });
        }
      }

      globalMonitor.end('update');
      return updatedCount;
    } catch (error) {
      globalMonitor.end('update');
      throw error;
    }
  }

  /**
   * Update documents with deep merge support for nested objects
   * Unlike update(), this method can handle nested object updates
   */
  updateDeep(query: Query, changes: UpdateOperation): number {
    if (!query) {
      throw new ValidationError(ERROR_MESSAGES.QUERY_REQUIRED, 'query', query);
    }

    if (!changes || typeof changes !== 'object') {
      throw new ValidationError(ERROR_MESSAGES.UPDATE_CHANGES_REQUIRED, 'changes', changes);
    }

    // Allow nested object updates for this method
    if (!changes || typeof changes !== 'object') {
      // This should never happen due to the check above, but TypeScript needs it
      throw new ValidationError(ERROR_MESSAGES.UPDATE_CHANGES_REQUIRED, 'changes', changes);
    }

    globalMonitor.start('updateDeep');

    try {
      const matchingDocs = this.find(query);
      let updatedCount = 0;

      // Collect index updates for batch processing
      const indexRemovals: Array<{ field: string; value: any; docId: string }> = [];
      const indexAdditions: Array<{ field: string; value: any; docId: string }> = [];

      for (const doc of matchingDocs) {
        const docId = doc._id as string;

        // Collect current index values for removal
        for (const [fieldName] of this.indices) {
          const oldValue = doc[fieldName];
          if (oldValue !== undefined) {
            indexRemovals.push({ field: fieldName, value: oldValue, docId });
          }
        }

        // Create new document instance using deepMerge for nested object support
        const updatedDoc = deepMerge(doc, changes);
        this.documents.set(docId, updatedDoc);
        updatedCount++;

        // Collect new index values for addition
        for (const [fieldName] of this.indices) {
          const newValue = updatedDoc[fieldName];
          if (newValue !== undefined) {
            indexAdditions.push({ field: fieldName, value: newValue, docId });
          }
        }

        // Emit change event
        this.emitChangeEvent({
          type: 'update',
          collection: this.name,
          document: { ...updatedDoc },
          timestamp: Date.now()
        });
      }

      // Batch apply index updates
      this.batchRemoveFromIndices(indexRemovals);
      this.batchUpdateIndices(indexAdditions);

      // Invalidate cache
      this.invalidateCacheForIndexedFields();

      logger.info('Deep update completed', {
        collection: this.name,
        matched: matchingDocs.length,
        updated: updatedCount
      });

      globalMonitor.end('updateDeep');
      return updatedCount;
    } catch (error) {
      globalMonitor.end('updateDeep');
      throw error;
    }
  }

  /**
   * Remove documents matching the query
   */
  remove(query: Query): number {
    if (!query) {
      throw new ValidationError(ERROR_MESSAGES.QUERY_REQUIRED, 'query', query);
    }

    QueryValidator.validate(query);

    globalMonitor.start('remove');

    try {
      const matchingDocs = this.find(query);
      let removedCount = 0;

      // Collect index removals for batch processing
      const indexRemovals: Array<{ field: string; value: any; docId: string }> = [];

      // Emit change events for documents being removed
      for (const doc of matchingDocs) {
        this.emitChangeEvent({
          type: 'remove',
          collection: this.name,
          document: { ...doc },
          timestamp: Date.now()
        });
      }

      for (const doc of matchingDocs) {
        const docId = doc._id as string;

        // Collect index values for removal
        for (const [fieldName] of this.indices) {
          const value = doc[fieldName];
          if (value !== undefined) {
            indexRemovals.push({ field: fieldName, value, docId });
          }
        }

        // Remove from documents map (O(1))
        this.documents.delete(docId);
        removedCount++;
      }

      // Batch remove from indices
      this.batchRemoveFromIndices(indexRemovals);

      // Invalidate cache for affected fields
      for (const fieldName of Object.keys(query)) {
        this.queryCache.invalidateByField(fieldName);
      }

      globalMonitor.end('remove');
      return removedCount;
    } catch (error) {
      globalMonitor.end('remove');
      throw error;
    }
  }

  /**
   * Bulk delete multiple documents with optimized performance
   * Designed for large-scale deletion operations
   */
  removeMany(query: Query, options: BulkDeleteOptions = {}): BulkDeleteResult {
    const {
      limit,
      emitEvents = true,
      timeout = 120000 // 2 minutes default for bulk deletes
    } = options;

    if (!query) {
      throw new ValidationError(ERROR_MESSAGES.QUERY_REQUIRED, 'query', query);
    }

    globalMonitor.startWithTimeout('removeMany', timeout);

    try {
      let matchingDocs = this.find(query);

      // Apply limit if specified
      if (limit && limit > 0) {
        matchingDocs = matchingDocs.slice(0, limit);
      }

      if (matchingDocs.length === 0) {
        globalMonitor.end('removeMany');
        return { deletedCount: 0, deletedIds: [] };
      }

      let removedCount = 0;
      const deletedIds: string[] = [];

      // Collect index removals for batch processing
      const indexRemovals: Array<{ field: string; value: any; docId: string }> = [];

      // Emit change events for documents being removed
      for (const doc of matchingDocs) {
        const docId = doc._id as string;

        // Collect current index values for removal
        for (const [fieldName] of this.indices) {
          const value = doc[fieldName];
          if (value !== undefined) {
            indexRemovals.push({ field: fieldName, value, docId });
          }
        }

        // Emit change event if requested
        if (emitEvents) {
          this.emitChangeEvent({
            type: 'remove',
            collection: this.name,
            document: { ...doc },
            timestamp: Date.now()
          });
        }

        // Remove from documents map
        this.documents.delete(docId);
        deletedIds.push(docId);
        removedCount++;
      }

      // Batch remove from indices
      this.batchRemoveFromIndices(indexRemovals);

      // Invalidate cache
      this.invalidateCacheForIndexedFields();

      logger.info('Bulk delete completed', {
        collection: this.name,
        matched: matchingDocs.length,
        deleted: removedCount,
        limit: limit || 'unlimited'
      });

      globalMonitor.end('removeMany');
      return {
        deletedCount: removedCount,
        deletedIds
      };

    } catch (error) {
      globalMonitor.end('removeMany');
      logger.error('Bulk delete failed', { error: (error as Error).message, query });
      throw error;
    }
  }

  /**
   * Get all indices
   */
  getIndices(): string[] {
    return Array.from(this.indices.keys());
  }

  /**
   * Get collection statistics
   */
  getStats(): { documentCount: number; indexCount: number; cacheSize: number; memoryUsage: number } {
    const memoryUsage = this.calculateCollectionSize();
    return {
      documentCount: this.documents.size,
      indexCount: this.indices.size,
      cacheSize: this.queryCache.getStats().size,
      memoryUsage
    };
  }

  /**
   * Clear all documents and indices
   */
  clear(): void {
    globalMonitor.start('clear');

    try {
      // For large collections, clear in batches to avoid blocking
      if (this.documents.size > 10000) {
        const batchSize = 1000;
        const docIds = Array.from(this.documents.keys());

        for (let i = 0; i < docIds.length; i += batchSize) {
          const batch = docIds.slice(i, i + batchSize);
          batch.forEach(id => this.documents.delete(id));
        }
      } else {
        this.documents.clear();
      }

      this.indices.clear();
      this.queryCache.clear();
      this.nextId = 0;

      globalMonitor.end('clear');
    } catch (error) {
      globalMonitor.end('clear');
      throw error;
    }
  }

  /**
   * Get performance metrics for this collection
   */
  getPerformanceMetrics(): any {
    return {
      documents: this.documents.size,
      indices: this.indices.size,
      cacheStats: this.queryCache.getStats(),
      globalMetrics: globalMonitor.getAllMetrics()
    };
  }

  /**
   * Get performance report
   */
  getPerformanceReport(): string {
    return globalMonitor.getReport();
  }


  /**
   * Get all documents (used for serialization)
   */
  getAllDocuments(): Document[] {
    return Array.from(this.documents.values());
  }

  /**
   * Replace all documents (used for deserialization)
   */
  setAllDocuments(documents: Document[]): void {
    this.loadDocuments(documents);
    this.rebuildIndices();
  }

  /**
   * Load documents into the collection
   */
  private loadDocuments(documents: Document[]): void {
    for (const doc of documents) {
      const docId = doc._id as string || `doc_${this.nextId++}`;
      this.documents.set(docId, doc);
    }
  }

  /**
   * Rebuild all indices for existing documents
   */
  private rebuildIndices(): void {
    const indexUpdates: Array<{ field: string; value: any; docId: string }> = [];

    for (const [docId, doc] of this.documents) {
      for (const [fieldName] of this.indices) {
        const value = doc[fieldName];
        if (value !== undefined) {
          indexUpdates.push({ field: fieldName, value, docId });
        }
      }
    }

    this.batchUpdateIndices(indexUpdates);
  }

  /**
   * Batch update indices for better performance
   * 
   * Optimizes index updates by grouping operations by field before applying.
   * This reduces the number of map lookups and improves performance for bulk operations.
   * 
   * Algorithm:
   * 1. Group all updates by field name
   * 2. For each field, process all value updates together
   * 3. For each value, add the document ID to the appropriate set
   * 
   * Time Complexity: O(n) where n is the number of updates
   * Space Complexity: O(n) for grouping structure
   * 
   * @param updates - Array of index updates to apply, grouped by field
   */
  private batchUpdateIndices(updates: Array<{ field: string; value: any; docId: string }>): void {
    if (updates.length === 0) return;
    
    // Optimize: skip grouping for single-field updates (common case)
    if (updates.length === 1) {
      const update = updates[0];
      const indexMap = this.indices.get(update.field);
      if (indexMap) {
        let valueSet = indexMap.get(update.value);
        if (!valueSet) {
          valueSet = new Set();
          indexMap.set(update.value, valueSet);
        }
        valueSet.add(update.docId);
      }
      return;
    }
    
    // Group updates by field for more efficient processing (multi-field case)
    const updatesByField = new Map<string, Array<{ value: any; docId: string }>>();

    for (const update of updates) {
      let fieldUpdates = updatesByField.get(update.field);
      if (!fieldUpdates) {
        fieldUpdates = [];
        updatesByField.set(update.field, fieldUpdates);
      }
      fieldUpdates.push({ value: update.value, docId: update.docId });
    }

    // Apply updates field by field
    for (const [fieldName, fieldUpdates] of updatesByField) {
      const indexMap = this.indices.get(fieldName);
      if (!indexMap) continue;

      for (const { value, docId } of fieldUpdates) {
        let valueSet = indexMap.get(value);
        if (!valueSet) {
          valueSet = new Set();
          indexMap.set(value, valueSet);
        }
        valueSet.add(docId);
      }
    }
  }

  /**
   * Batch remove from indices for better performance
   * 
   * Optimizes index removals by grouping operations by field before applying.
   * Also cleans up empty value sets to prevent memory leaks.
   * 
   * Algorithm:
   * 1. Group all removals by field name
   * 2. For each field, process all value removals together
   * 3. For each value, remove the document ID from the appropriate set
   * 4. Remove empty sets to free memory
   * 
   * Time Complexity: O(n) where n is the number of removals
   * Space Complexity: O(n) for grouping structure
   * 
   * @param removals - Array of index removals to apply, grouped by field
   */
  private batchRemoveFromIndices(removals: Array<{ field: string; value: any; docId: string }>): void {
    if (removals.length === 0) return;
    
    // Optimize: skip grouping for single removal (common case)
    if (removals.length === 1) {
      const removal = removals[0];
      const indexMap = this.indices.get(removal.field);
      if (indexMap) {
        const valueSet = indexMap.get(removal.value);
        if (valueSet) {
          valueSet.delete(removal.docId);
          if (valueSet.size === 0) {
            indexMap.delete(removal.value);
          }
        }
      }
      return;
    }
    
    // Group removals by field for more efficient processing (multi-removal case)
    const removalsByField = new Map<string, Array<{ value: any; docId: string }>>();

    for (const removal of removals) {
      let fieldRemovals = removalsByField.get(removal.field);
      if (!fieldRemovals) {
        fieldRemovals = [];
        removalsByField.set(removal.field, fieldRemovals);
      }
      fieldRemovals.push({ value: removal.value, docId: removal.docId });
    }

    // Apply removals field by field
    for (const [fieldName, fieldRemovals] of removalsByField) {
      const indexMap = this.indices.get(fieldName);
      if (!indexMap) continue;

      for (const { value, docId } of fieldRemovals) {
        const valueSet = indexMap.get(value);
        if (valueSet) {
          valueSet.delete(docId);
          if (valueSet.size === 0) {
            indexMap.delete(value);
          }
        }
      }
    }
  }

  /**
   * Serialize collection for persistence
   */
  serialize(): any {
    return {
      name: this.name,
      documents: Array.from(this.documents.entries()),
      indices: Array.from(this.indices.entries()).map(([field, valueMap]) => [
        field,
        Array.from(valueMap.entries()).map(([value, docIds]) => [
          value,
          Array.from(docIds)
        ])
      ]),
      nextId: this.nextId,
      queryCache: this.queryCache.serialize()
    };
  }

  /**
   * Deserialize collection from persistence
   */
  deserialize(data: any): void {
    if (!data) return;

    // Clear existing data
    this.clear();

    // Restore documents
    if (data.documents) {
      for (const [id, doc] of data.documents) {
        this.documents.set(id, doc);
      }
    }

    // Restore indices
    if (data.indices) {
      for (const [field, valueMapData] of data.indices) {
        const valueMap = new Map();
        for (const [value, docIds] of valueMapData) {
          valueMap.set(value, new Set(docIds));
        }
        this.indices.set(field, valueMap);
      }
    }

    // Restore ID counter
    if (data.nextId) {
      this.nextId = data.nextId;
    }

    // Restore query cache
    if (data.queryCache) {
      this.queryCache.deserialize(data.queryCache);
    }
  }
}
