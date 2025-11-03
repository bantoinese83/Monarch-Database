/**
 * Data Operations Manager
 *
 * Handles all data operations (CRUD, queries, data structures) in a centralized way.
 * Separated from main Monarch class to improve modularity and testing.
 */

import { Collection } from './collection';
import { Query, UpdateOperation, TransactionOptions } from './types';
import { CollectionManager } from './collection-manager';
import { OptimizedDataStructures } from './optimized-data-structures';
import { errorUtils } from './errors';
import { logger } from './logger';

export class DataOperationsManager {
  private operationStats = new Map<string, { count: number; totalTime: number; avgTime: number }>();

  constructor(
    private collectionManager: CollectionManager,
    private dataStructures: OptimizedDataStructures
  ) {}

  /**
   * Get performance statistics for operations
   */
  getPerformanceStats(): Record<string, { count: number; totalTime: number; avgTime: number }> {
    const stats: Record<string, { count: number; totalTime: number; avgTime: number }> = {};
    for (const [op, stat] of this.operationStats) {
      stats[op] = { ...stat };
    }
    return stats;
  }

  /**
   * Record operation timing for performance monitoring
   */
  private recordOperationTime(operation: string, duration: number): void {
    const existing = this.operationStats.get(operation) || { count: 0, totalTime: 0, avgTime: 0 };
    existing.count++;
    existing.totalTime += duration;
    existing.avgTime = existing.totalTime / existing.count;
    this.operationStats.set(operation, existing);
  }

  // ===== COLLECTION OPERATIONS =====

  /**
   * Insert a document into a collection
   */
  async insert(collectionName: string, document: any): Promise<any[]> {
    const startTime = Date.now();
    try {
      const collection = this.getCollection(collectionName);
      const result = await collection.insert(document); // insert returns the inserted documents
      this.recordOperationTime('insert', Date.now() - startTime);
      return result;
    } catch (error) {
      this.recordOperationTime('insert', Date.now() - startTime);
      throw error;
    }
  }

  /**
   * Find documents in a collection
   */
  async find(collectionName: string, query?: Query, options?: { limit?: number; skip?: number }): Promise<any[]> {
    const startTime = Date.now();
    try {
      const collection = this.getCollection(collectionName);
      const result = await collection.findAsync(query, options);
      this.recordOperationTime('find', Date.now() - startTime);
      return result;
    } catch (error) {
      this.recordOperationTime('find', Date.now() - startTime);
      throw error;
    }
  }

  /**
   * Find one document in a collection
   */
  async findOne(collectionName: string, query: Query): Promise<any | null> {
    const collection = this.getCollection(collectionName);
    return collection.findOne(query);
  }

  /**
   * Update documents in a collection
   */
  async update(collectionName: string, query: Query, changes: UpdateOperation): Promise<number> {
    const collection = this.getCollection(collectionName);
    return collection.update(query, changes);
  }

  /**
   * Remove documents from a collection
   */
  async remove(collectionName: string, query: Query): Promise<number> {
    const collection = this.getCollection(collectionName);
    return collection.remove(query);
  }

  /**
   * Count documents in a collection
   */
  async count(collectionName: string, query?: Query): Promise<number> {
    const collection = this.getCollection(collectionName);
    return collection.count(query);
  }

  /**
   * Get distinct values for a field
   */
  async distinct(collectionName: string, field: string, query?: Query): Promise<any[]> {
    const collection = this.getCollection(collectionName);
    return collection.distinct(field, query);
  }

  /**
   * Create an index on a collection
   */
  async createIndex(collectionName: string, field: string, options?: { unique?: boolean }): Promise<void> {
    const collection = this.getCollection(collectionName);
    return collection.createIndex(field, options);
  }

  /**
   * Drop an index from a collection
   */
  async dropIndex(collectionName: string, field: string): Promise<void> {
    const collection = this.getCollection(collectionName);
    return collection.dropIndex(field);
  }

  // ===== TRANSACTION OPERATIONS =====

  /**
   * Begin a transaction
   */
  // eslint-disable-next-line @typescript-eslint/no-unused-vars, no-unused-vars
  beginTransaction(_options?: TransactionOptions): string {
    // Transaction logic would be implemented here
    // For now, return a mock transaction ID
    return `tx_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Commit a transaction
   */
  commitTransaction(transactionId: string): void {
    // Transaction commit logic would be implemented here
    logger.info('Transaction committed', { transactionId });
  }

  /**
   * Rollback a transaction
   */
  rollbackTransaction(transactionId: string): void {
    // Transaction rollback logic would be implemented here
    logger.info('Transaction rolled back', { transactionId });
  }

  // ===== DATA STRUCTURE OPERATIONS =====

  // List operations
  async lpush(key: string, values: any[]): Promise<number> {
    return this.dataStructures.lpush(key, values);
  }

  async rpush(key: string, values: any[]): Promise<number> {
    return this.dataStructures.rpush(key, values);
  }

  async lpop(key: string): Promise<any> {
    return this.dataStructures.lpop(key);
  }

  async rpop(key: string): Promise<any> {
    return this.dataStructures.rpop(key);
  }

  async lrange(key: string, start: number, end: number): Promise<any[]> {
    return this.dataStructures.lrange(key, start, end);
  }

  async lindex(key: string, index: number): Promise<any> {
    return this.dataStructures.lindex(key, index);
  }

  async llen(key: string): Promise<number> {
    return this.dataStructures.llen(key);
  }

  async ltrim(key: string, start: number, end: number): Promise<void> {
    return this.dataStructures.ltrim(key, start, end);
  }

  async lset(key: string, index: number, value: any): Promise<void> {
    return this.dataStructures.lset(key, index, value);
  }

  async lrem(key: string, count: number, value: any): Promise<number> {
    return this.dataStructures.lrem(key, count, value);
  }

  // Set operations
  async sadd(key: string, members: any[]): Promise<number> {
    return this.dataStructures.sadd(key, members);
  }

  async srem(key: string, members: any[]): Promise<number> {
    return this.dataStructures.srem(key, members);
  }

  async smembers(key: string): Promise<any[]> {
    return this.dataStructures.smembers(key);
  }

  async sismember(key: string, member: any): Promise<boolean> {
    return this.dataStructures.sismember(key, member);
  }

  async scard(key: string): Promise<number> {
    return this.dataStructures.scard(key);
  }

  async sdiff(keys: string[]): Promise<any[]> {
    return this.dataStructures.sdiff(keys);
  }

  async sinter(keys: string[]): Promise<any[]> {
    return this.dataStructures.sinter(keys);
  }

  async sunion(keys: string[]): Promise<any[]> {
    return this.dataStructures.sunion(keys);
  }

  async srandmember(key: string, count?: number): Promise<any[]> {
    return this.dataStructures.srandmember(key, count);
  }

  // Hash operations
  async hset(key: string, field: string, value: any): Promise<number> {
    return this.dataStructures.hset(key, field, value);
  }

  async hget(key: string, field: string): Promise<any> {
    return this.dataStructures.hget(key, field);
  }

  async hgetall(key: string): Promise<Record<string, any>> {
    return this.dataStructures.hgetall(key);
  }

  async hdel(key: string, fields: string[]): Promise<number> {
    return this.dataStructures.hdel(key, fields);
  }

  async hexists(key: string, field: string): Promise<boolean> {
    return this.dataStructures.hexists(key, field);
  }

  async hkeys(key: string): Promise<string[]> {
    return this.dataStructures.hkeys(key);
  }

  async hvals(key: string): Promise<any[]> {
    return this.dataStructures.hvals(key);
  }

  async hlen(key: string): Promise<number> {
    return this.dataStructures.hlen(key);
  }

  async hincrby(key: string, field: string, amount: number): Promise<number> {
    return this.dataStructures.hincrby(key, field, amount);
  }

  async hincrbyfloat(key: string, field: string, increment: number): Promise<number> {
    return this.dataStructures.hincrbyfloat(key, field, increment);
  }

  // Sorted set operations
  async zadd(key: string, members: Record<string, number>): Promise<number> {
    return this.dataStructures.zadd(key, members);
  }

  async zrem(key: string, members: string[]): Promise<number> {
    return this.dataStructures.zrem(key, members);
  }

  async zscore(key: string, member: string): Promise<number | null> {
    return this.dataStructures.zscore(key, member);
  }

  async zrange(key: string, start: number, end: number, withScores?: boolean): Promise<any[]> {
    return this.dataStructures.zrange(key, start, end, withScores);
  }

  async zrevrange(key: string, start: number, end: number, withScores?: boolean): Promise<any[]> {
    return this.dataStructures.zrevrange(key, start, end, withScores);
  }

  async zcard(key: string): Promise<number> {
    return this.dataStructures.zcard(key);
  }

  async zrank(key: string, member: any): Promise<number | null> {
    return this.dataStructures.zrank(key, member);
  }

  async zrevrank(key: string, member: any): Promise<number | null> {
    return this.dataStructures.zrevrank(key, member);
  }

  async zrangebyscore(key: string, min: number, max: number): Promise<any[]> {
    return this.dataStructures.zrangebyscore(key, min, max);
  }

  async zcount(key: string, min: number, max: number): Promise<number> {
    return this.dataStructures.zcount(key, min, max);
  }

  async zincrby(key: string, increment: number, member: any): Promise<number> {
    return this.dataStructures.zincrby(key, increment, member);
  }

  // Stream operations
  async xadd(key: string, id: string, fields: Record<string, any>): Promise<string> {
    return this.dataStructures.xadd(key, id, fields);
  }

  async xrange(key: string, start: string, end: string): Promise<any[]> {
    return this.dataStructures.xrange(key, start, end);
  }

  async xlen(key: string): Promise<number> {
    return this.dataStructures.xlen(key);
  }

  async xread(streams: Record<string, string>, count?: number, block?: number): Promise<Record<string, any[]>> {
    return this.dataStructures.xread(streams, count, block);
  }

  async xrevrange(key: string, end: string, start: string, count?: number): Promise<any[]> {
    return this.dataStructures.xrevrange(key, end, start, count);
  }

  async xdel(key: string, ids: string[]): Promise<number> {
    return this.dataStructures.xdel(key, ids);
  }

  async xtrim(key: string, strategy: 'maxlen' | 'minid', threshold: string | number): Promise<number> {
    return this.dataStructures.xtrim(key, strategy, threshold);
  }

  // Geospatial operations
  async geoadd(key: string, longitude: number, latitude: number, member: string): Promise<number> {
    return this.dataStructures.geoadd(key, longitude, latitude, member);
  }

  async geopos(key: string, members: string[]): Promise<Array<{ longitude: number; latitude: number } | null>> {
    return this.dataStructures.geopos(key, members);
  }

  async geodist(key: string, member1: string, member2: string): Promise<number | null> {
    return this.dataStructures.geodist(key, member1, member2);
  }

  async georadius(key: string, longitude: number, latitude: number, radius: number, unit: 'm' | 'km' | 'mi' | 'ft', options?: { withCoord?: boolean; withDist?: boolean; count?: number }): Promise<any[]> {
    return this.dataStructures.georadius(key, longitude, latitude, radius, unit, options);
  }

  async georadiusbymember(key: string, member: string, radius: number, unit: 'm' | 'km' | 'mi' | 'ft', options?: { withCoord?: boolean; withDist?: boolean; count?: number }): Promise<any[]> {
    return this.dataStructures.georadiusbymember(key, member, radius, unit, options);
  }

  async geohash(key: string, members: string[]): Promise<string[]> {
    return this.dataStructures.geohash(key, members);
  }

  // Time series operations
  async tsadd(key: string, timestamp: number, value: number, labels?: Record<string, string>): Promise<void> {
    return this.dataStructures.tsadd(key, timestamp, value, labels);
  }

  async tsget(key: string, timestamp: number): Promise<any> {
    return this.dataStructures.tsget(key, timestamp);
  }

  async tsrange(key: string, startTime: number, endTime: number): Promise<any[]> {
    return this.dataStructures.tsrange(key, startTime, endTime);
  }

  async tslast(key: string): Promise<any> {
    return this.dataStructures.tslast(key);
  }

  async tscount(key: string): Promise<number> {
    return this.dataStructures.tscount(key);
  }

  async tsmin(key: string): Promise<any> {
    return this.dataStructures.tsmin(key);
  }

  async tsmax(key: string): Promise<any> {
    return this.dataStructures.tsmax(key);
  }

  async tsavg(key: string, fromTimestamp?: number, toTimestamp?: number): Promise<number | null> {
    return this.dataStructures.tsavg(key, fromTimestamp, toTimestamp);
  }

  // Vector operations
  async vadd(key: string, id: string, vector: number[], metadata?: Record<string, any>): Promise<void> {
    return this.dataStructures.vadd(key, id, vector, metadata);
  }

  async vget(key: string, id: string): Promise<any> {
    return this.dataStructures.vget(key, id);
  }

  async vsearch(key: string, queryVector: number[], topK?: number, includeMetadata?: boolean): Promise<any[]> {
    return this.dataStructures.vsearch(key, queryVector, topK, includeMetadata);
  }

  async vdel(key: string, ids: string[]): Promise<number> {
    return this.dataStructures.vdel(key, ids);
  }

  async vcount(key: string): Promise<number> {
    return this.dataStructures.vcount(key);
  }

  // ===== UTILITY METHODS =====

  /**
   * Get a collection, creating it if it doesn't exist
   */
  private getCollection(name: string): Collection {
    let collection = this.collectionManager.getCollection(name);
    if (!collection) {
      collection = this.collectionManager.createCollection(name);
    }
    return collection;
  }

  /**
   * Validate operation parameters
   */
  // eslint-disable-next-line @typescript-eslint/no-unused-vars, no-unused-vars
  private validateOperation(collectionName: string, _operation: string): void {
    errorUtils.assert(!!(collectionName && typeof collectionName === 'string'),
      'Collection name must be a string', 'collectionName', collectionName);

    // Check rate limits if needed
    // This could be extended with more sophisticated rate limiting
  }
}
