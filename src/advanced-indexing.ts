import { Document, IndexOptions } from './types';
import { logger } from './logger';

/**
 * Advanced Indexing Engine for Monarch Database
 * Supports compound indexes, unique constraints, and specialized index types
 */
export class AdvancedIndexingEngine {
  private indexes = new Map<string, AdvancedIndex>();

  /**
   * Create an advanced index
   */
  createIndex(collection: string, fields: string[], options: IndexOptions = {}): string {
    const indexName = options.name || `idx_${collection}_${fields.join('_')}_${Date.now()}`;

    const index: AdvancedIndex = {
      name: indexName,
      collection,
      fields,
      options,
      data: new Map(),
      unique: options.unique || false,
      sparse: options.sparse || false,
      text: options.text || false,
      expiresAt: options.expireAfterSeconds ? Date.now() + (options.expireAfterSeconds * 1000) : undefined
    };

    this.indexes.set(indexName, index);

    logger.info('Advanced index created', {
      indexName,
      collection,
      fields,
      options: { unique: options.unique, sparse: options.sparse, text: options.text }
    });

    return indexName;
  }

  /**
   * Insert document into all relevant indexes
   */
  insertDocument(docId: string, document: Document): void {
    for (const index of this.indexes.values()) {
      if (this.shouldIndexDocument(document, index)) {
        this.insertIntoIndex(index, docId, document);
      }
    }
  }

  /**
   * Update document in all relevant indexes
   */
  updateDocument(docId: string, oldDocument: Document, newDocument: Document): void {
    for (const index of this.indexes.values()) {
      // Remove old document
      this.removeFromIndex(index, docId);

      // Insert new document if it should be indexed
      if (this.shouldIndexDocument(newDocument, index)) {
        this.insertIntoIndex(index, docId, newDocument);
      }
    }
  }

  /**
   * Remove document from all indexes
   */
  removeDocument(docId: string): void {
    for (const index of this.indexes.values()) {
      this.removeFromIndex(index, docId);
    }
  }

  /**
   * Query using index
   */
  queryIndex(indexName: string, query: any): string[] {
    const index = this.indexes.get(indexName);
    if (!index) {
      throw new Error(`Index '${indexName}' not found`);
    }

    const results = new Set<string>();

    // For compound indexes, we need to match all fields
    if (index.fields.length > 1) {
      this.queryCompoundIndex(index, query, results);
    } else {
      this.querySingleFieldIndex(index, query, results);
    }

    return Array.from(results);
  }

  /**
   * Get index statistics
   */
  getIndexStats(indexName: string): any {
    const index = this.indexes.get(indexName);
    if (!index) {
      throw new Error(`Index '${indexName}' not found`);
    }

    let totalEntries = 0;
    let uniqueKeys = 0;

    for (const valueMap of index.data.values()) {
      uniqueKeys++;
      totalEntries += valueMap.size;
    }

    return {
      name: index.name,
      collection: index.collection,
      fields: index.fields,
      unique: index.unique,
      sparse: index.sparse,
      text: index.text,
      totalEntries,
      uniqueKeys,
      avgEntriesPerKey: uniqueKeys > 0 ? totalEntries / uniqueKeys : 0
    };
  }

  /**
   * Drop index
   */
  dropIndex(indexName: string): void {
    const index = this.indexes.get(indexName);
    if (!index) {
      throw new Error(`Index '${indexName}' not found`);
    }

    this.indexes.delete(indexName);
    logger.info('Advanced index dropped', { indexName });
  }

  /**
   * Clean up expired documents (TTL indexes)
   */
  cleanupExpiredDocuments(): number {
    let cleanedCount = 0;
    const now = Date.now();

    for (const index of this.indexes.values()) {
      if (index.expiresAt && index.expiresAt <= now) {
        // This is a TTL index - clean up expired documents
        const expiredDocIds = new Set<string>();

        for (const [key, docIds] of index.data) {
          // Check if the key represents an expiration timestamp
          if (typeof key === 'number' && key <= now) {
            for (const docId of docIds) {
              expiredDocIds.add(docId);
            }
          }
        }

        cleanedCount += expiredDocIds.size;

        // Remove expired documents from this index
        for (const docId of expiredDocIds) {
          this.removeFromIndex(index, docId);
        }
      }
    }

    if (cleanedCount > 0) {
      logger.info('TTL cleanup completed', { cleanedDocuments: cleanedCount });
    }

    return cleanedCount;
  }

  private shouldIndexDocument(document: Document, index: AdvancedIndex): boolean {
    if (index.sparse) {
      // For sparse indexes, only index documents that have at least one of the indexed fields
      return index.fields.some(field => this.getNestedValue(document, field) !== undefined);
    }
    return true;
  }

  private insertIntoIndex(index: AdvancedIndex, docId: string, document: Document): void {
    const key = this.generateIndexKey(index.fields, document);

    if (!index.data.has(key)) {
      index.data.set(key, new Set());
    }

    const docIds = index.data.get(key)!;

    // Check unique constraint
    if (index.unique && docIds.size > 0) {
      throw new Error(`Unique index violation: ${index.name} on key ${key}`);
    }

    docIds.add(docId);
  }

  private removeFromIndex(index: AdvancedIndex, docId: string): void {
    for (const docIds of index.data.values()) {
      docIds.delete(docId);
    }

    // Clean up empty entries
    for (const [key, docIds] of index.data) {
      if (docIds.size === 0) {
        index.data.delete(key);
      }
    }
  }

  private generateIndexKey(fields: string[], document: Document): string {
    const values = fields.map(field => {
      const value = this.getNestedValue(document, field);
      return value === undefined ? null : value;
    });

    return JSON.stringify(values);
  }

  private querySingleFieldIndex(index: AdvancedIndex, query: any, results: Set<string>): void {
    const field = index.fields[0];

    for (const [operator, value] of Object.entries(query)) {
      switch (operator) {
        case '$eq':
        case field: // Direct field match
          const searchValue = operator === field ? value : value;
          const docIds = index.data.get(JSON.stringify([searchValue]));
          if (docIds) {
            docIds.forEach(id => results.add(id));
          }
          break;

        case '$in':
          if (Array.isArray(value)) {
            value.forEach(val => {
              const docIds = index.data.get(JSON.stringify([val]));
              if (docIds) {
                docIds.forEach(id => results.add(id));
              }
            });
          }
          break;

        case '$gt':
        case '$gte':
        case '$lt':
        case '$lte':
          // Range queries - need to scan all keys (inefficient for large indexes)
          this.performRangeQuery(index, field, operator, value as any, results);
          break;
      }
    }
  }

  private queryCompoundIndex(index: AdvancedIndex, query: any, results: Set<string>): void {
    // For compound indexes, we need exact matches on all fields for now
    // More sophisticated compound index queries would require index intersection/union
    const queryFields = Object.keys(query);

    if (queryFields.length === index.fields.length &&
        queryFields.every(field => index.fields.includes(field))) {

      const key = this.generateIndexKey(index.fields, query);
      const docIds = index.data.get(key);
      if (docIds) {
        docIds.forEach(id => results.add(id));
      }
    }
  }

  private performRangeQuery(index: AdvancedIndex, field: string, operator: string, value: any, results: Set<string>): void {
    // This is a simplified range query - in production, you'd want a more efficient data structure
    for (const [keyStr, docIds] of index.data) {
      const keyValues = JSON.parse(keyStr);
      const fieldValue = keyValues[index.fields.indexOf(field)];

      if (fieldValue !== undefined && fieldValue !== null) {
        let matches = false;

        switch (operator) {
          case '$gt': matches = fieldValue > value; break;
          case '$gte': matches = fieldValue >= value; break;
          case '$lt': matches = fieldValue < value; break;
          case '$lte': matches = fieldValue <= value; break;
        }

        if (matches) {
          docIds.forEach(id => results.add(id));
        }
      }
    }
  }

  private getNestedValue(obj: any, path: string): any {
    return path.split('.').reduce((current, key) => current?.[key], obj);
  }
}

interface AdvancedIndex {
  name: string;
  collection: string;
  fields: string[];
  options: IndexOptions;
  data: Map<string, Set<string>>; // key -> Set<docId>
  unique: boolean;
  sparse: boolean;
  text: boolean;
  expiresAt?: number;
}
