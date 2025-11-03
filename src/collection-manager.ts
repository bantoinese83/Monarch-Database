/**
 * Collection Manager
 *
 * Handles all collection-related operations and lifecycle management.
 * Separated from the main Monarch class to reduce coupling and improve maintainability.
 */

import { Collection } from './collection';
import { PersistenceAdapter } from './types';
import { globalConfig } from './config';
import { ValidationError, ResourceLimitError } from './errors';
import { CollectionValidator } from './validators';
import { LIMITS, ERROR_MESSAGES } from './constants';
import { logger } from './logger';

export class CollectionManager {
  private collections: Map<string, Collection> = new Map();

  constructor(private adapter?: PersistenceAdapter) {}

  /**
   * Create and register a new collection
   */
  createCollection(name: string): Collection {
    if (this.collections.has(name)) {
      throw new ValidationError(
        ERROR_MESSAGES.COLLECTION_ALREADY_EXISTS(name),
        'collectionName',
        name
      );
    }

    // Validate collection name using centralized validator
    CollectionValidator.validateName(name);

    // Check collection limit
    if (this.collections.size >= LIMITS.MAX_COLLECTIONS_PER_DB) {
      throw new ResourceLimitError(
        ERROR_MESSAGES.COLLECTIONS_LIMIT_EXCEEDED(LIMITS.MAX_COLLECTIONS_PER_DB),
        'collections',
        LIMITS.MAX_COLLECTIONS_PER_DB,
        this.collections.size + 1
      );
    }

    const collection = new Collection(name);
    this.collections.set(name, collection);

    return collection;
  }

  /**
   * Get an existing collection
   */
  getCollection(name: string): Collection | null {
    return this.collections.get(name) || null;
  }

  /**
   * Check if collection exists
   */
  hasCollection(name: string): boolean {
    return this.collections.has(name);
  }

  /**
   * Delete a collection
   */
  deleteCollection(name: string): boolean {
    const collection = this.collections.get(name);
    if (!collection) {
      return false;
    }

    // Clear collection data
    collection.clear();

    // Remove from map
    this.collections.delete(name);
    return true;
  }

  /**
   * Get all collection names
   */
  getCollectionNames(): string[] {
    return Array.from(this.collections.keys());
  }

  getAllCollections(): Collection[] {
    return Array.from(this.collections.values());
  }

  clearAllCollections(): void {
    this.collections.clear();
  }

  /**
   * Get collection statistics
   * Encapsulates collection access to avoid Law of Demeter violations
   */
  getCollectionStats(name: string): any {
    const collection = this.collections.get(name);
    if (!collection) {
      throw new ValidationError(
        ERROR_MESSAGES.COLLECTION_NOT_FOUND(name),
        'collectionName',
        name
      );
    }

    return collection.getStats();
  }

  /**
   * Get total document count across all collections
   * Aggregates statistics to avoid Law of Demeter violations
   */
  getTotalDocumentCount(): number {
    let total = 0;
    for (const collection of this.collections.values()) {
      total += collection.getStats().documentCount;
    }
    return total;
  }

  /**
   * Get overall statistics
   * Uses aggregate methods to avoid Law of Demeter violations
   */
  getOverallStats(): {
    totalCollections: number;
    totalDocuments: number;
    totalSize: number;
    collections: Record<string, any>;
  } {
    const stats = {
      totalCollections: this.collections.size,
      totalDocuments: this.getTotalDocumentCount(),
      totalSize: 0,
      collections: {} as Record<string, any>
    };

    for (const [name, collection] of this.collections) {
      const collectionStats = collection.getStats();
      stats.totalSize += JSON.stringify(collectionStats).length * 2; // Rough estimate
      stats.collections[name] = collectionStats;
    }

    return stats;
  }

  /**
   * Persist all collections
   */
  async persistAll(): Promise<void> {
    if (!this.adapter) {
      throw new ValidationError(
        ERROR_MESSAGES.ADAPTER_NOT_CONFIGURED,
        'adapter',
        this.adapter
      );
    }

    const data: Record<string, any> = {};

    for (const [name, collection] of this.collections) {
      data[name] = collection.serialize();
    }

    await this.adapter.save(data);
  }

  /**
   * Load collections from persistence
   */
  async loadAll(): Promise<void> {
    if (!this.adapter) {
      throw new ValidationError(
        ERROR_MESSAGES.ADAPTER_NOT_CONFIGURED,
        'adapter',
        this.adapter
      );
    }

    const data = await this.adapter.load();

    if (data && typeof data === 'object') {
      for (const [name, collectionData] of Object.entries(data)) {
        try {
          const collection = this.createCollection(name);
          if (collectionData && typeof collectionData === 'object') {
            collection.deserialize(collectionData);
          }
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
  }

  /**
   * Clear all collections
   */
  clearAll(): void {
    for (const collection of this.collections.values()) {
      collection.clear();
    }
    this.collections.clear();
  }

}
