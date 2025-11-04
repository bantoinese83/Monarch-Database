import { Document } from './types';
import { logger } from './logger';

/**
 * Time-Series Data Engine for Monarch Database
 * Specialized storage and querying for time-series data
 */
export class TimeSeriesEngine {
  private collections = new Map<string, TimeSeriesCollection>();

  /**
   * Create a time-series collection
   */
  createCollection(name: string, options: TimeSeriesOptions = {}): void {
    const collection: TimeSeriesCollection = {
      name,
      options,
      data: new Map(),
      metadata: {
        createdAt: Date.now(),
        totalPoints: 0,
        timeRange: { start: 0, end: 0 },
        compressionRatio: 1.0,
        lastCompaction: Date.now()
      },
      indexes: new Map()
    };

    this.collections.set(name, collection);
    logger.info('Time-series collection created', { name, options });
  }

  /**
   * Insert time-series data points
   */
  insert(collectionName: string, points: TimeSeriesPoint[]): void {
    const collection = this.collections.get(collectionName);
    if (!collection) {
      throw new Error(`Time-series collection '${collectionName}' not found`);
    }

    for (const point of points) {
      this.insertPoint(collection, point);
    }

    // Update metadata
    collection.metadata.totalPoints += points.length;
    this.updateTimeRange(collection);

    // Trigger compression if needed
    if (this.shouldCompress(collection)) {
      this.compressCollection(collection);
    }

    logger.debug('Time-series points inserted', {
      collection: collectionName,
      points: points.length,
      totalPoints: collection.metadata.totalPoints
    });
  }

  /**
   * Query time-series data
   */
  query(collectionName: string, query: TimeSeriesQuery): TimeSeriesResult {
    const collection = this.collections.get(collectionName);
    if (!collection) {
      throw new Error(`Time-series collection '${collectionName}' not found`);
    }

    const { startTime, endTime, tags, aggregation, limit = 1000 } = query;
    let results: TimeSeriesPoint[] = [];

    // Query data points
    for (const [timestamp, points] of collection.data) {
      if (timestamp >= startTime && timestamp <= endTime) {
        for (const point of points) {
          if (this.matchesTags(point.tags || {}, tags || {})) {
            results.push(point);
          }
        }
      }
    }

    // Apply aggregation if specified
    if (aggregation) {
      results = this.applyAggregation(results, aggregation);
    }

    // Sort by timestamp
    results.sort((a, b) => a.timestamp - b.timestamp);

    // Apply limit
    if (results.length > limit) {
      results = results.slice(-limit);
    }

    const result: TimeSeriesResult = {
      collection: collectionName,
      points: results,
      query,
      executionTime: Date.now(),
      metadata: {
        totalPoints: results.length,
        timeRange: {
          start: results.length > 0 ? results[0].timestamp : 0,
          end: results.length > 0 ? results[results.length - 1].timestamp : 0
        }
      }
    };

    logger.debug('Time-series query executed', {
      collection: collectionName,
      pointsReturned: results.length,
      timeRange: query.startTime + ' to ' + query.endTime
    });

    return result;
  }

  /**
   * Downsample time-series data
   */
  downsample(collectionName: string, options: DownsampleOptions): void {
    const collection = this.collections.get(collectionName);
    if (!collection) {
      throw new Error(`Time-series collection '${collectionName}' not found`);
    }

    const { interval, aggregation, startTime, endTime } = options;
    const newData = new Map<number, TimeSeriesPoint[]>();

    // Group points by time buckets
    for (const [timestamp, points] of collection.data) {
      if (timestamp >= startTime && timestamp <= endTime) {
        const bucket = Math.floor(timestamp / interval) * interval;

        if (!newData.has(bucket)) {
          newData.set(bucket, []);
        }

        newData.get(bucket)!.push(...points);
      }
    }

    // Apply aggregation to each bucket
    for (const [bucket, points] of newData) {
      const aggregated = this.applyAggregation(points, aggregation);
      if (aggregated.length > 0) {
        newData.set(bucket, aggregated);
      }
    }

    // Replace data
    collection.data = newData;
    collection.metadata.lastCompaction = Date.now();

    logger.info('Time-series downsampling completed', {
      collection: collectionName,
      originalPoints: collection.metadata.totalPoints,
      newBuckets: newData.size,
      interval,
      aggregation
    });
  }

  /**
   * Compact time-series data (remove old data)
   */
  compact(collectionName: string, retentionPeriod: number): void {
    const collection = this.collections.get(collectionName);
    if (!collection) {
      throw new Error(`Time-series collection '${collectionName}' not found`);
    }

    const cutoffTime = Date.now() - retentionPeriod;
    let removedPoints = 0;

    for (const [timestamp, points] of collection.data) {
      if (timestamp < cutoffTime) {
        removedPoints += points.length;
        collection.data.delete(timestamp);
      }
    }

    collection.metadata.totalPoints -= removedPoints;
    collection.metadata.lastCompaction = Date.now();

    logger.info('Time-series compaction completed', {
      collection: collectionName,
      removedPoints,
      remainingPoints: collection.metadata.totalPoints,
      retentionPeriod
    });
  }

  /**
   * Create time-series index
   */
  createIndex(collectionName: string, indexSpec: TimeSeriesIndexSpec): string {
    const collection = this.collections.get(collectionName);
    if (!collection) {
      throw new Error(`Time-series collection '${collectionName}' not found`);
    }

    const indexName = `ts_idx_${collectionName}_${Date.now()}`;
    const index: TimeSeriesIndex = {
      name: indexName,
      spec: indexSpec,
      data: new Map(),
      createdAt: Date.now()
    };

    // Build index
    this.buildIndex(collection, index);

    collection.indexes.set(indexName, index);

    logger.info('Time-series index created', { collection: collectionName, indexName });
    return indexName;
  }

  /**
   * Get time-series statistics
   */
  getStats(collectionName: string): TimeSeriesStats {
    const collection = this.collections.get(collectionName);
    if (!collection) {
      throw new Error(`Time-series collection '${collectionName}' not found`);
    }

    const dataSize = this.calculateDataSize(collection);
    const indexSize = this.calculateIndexSize(collection);

    return {
      collection: collectionName,
      totalPoints: collection.metadata.totalPoints,
      timeRange: collection.metadata.timeRange,
      dataSize,
      indexSize,
      compressionRatio: collection.metadata.compressionRatio,
      indexes: Array.from(collection.indexes.keys()),
      createdAt: collection.metadata.createdAt,
      lastCompaction: collection.metadata.lastCompaction
    };
  }

  /**
   * Export time-series data
   */
  exportData(collectionName: string, format: 'json' | 'csv' = 'json'): any {
    const collection = this.collections.get(collectionName);
    if (!collection) {
      throw new Error(`Time-series collection '${collectionName}' not found`);
    }

    if (format === 'csv') {
      return this.exportAsCSV(collection);
    }

    return this.exportAsJSON(collection);
  }

  // Private helper methods
  private insertPoint(collection: TimeSeriesCollection, point: TimeSeriesPoint): void {
    const timestamp = point.timestamp;
    const bucketTimestamp = this.getBucketTimestamp(timestamp, collection.options.bucketSize || 60000); // Default 1 minute buckets

    if (!collection.data.has(bucketTimestamp)) {
      collection.data.set(bucketTimestamp, []);
    }

    collection.data.get(bucketTimestamp)!.push(point);
  }

  private getBucketTimestamp(timestamp: number, bucketSize: number): number {
    return Math.floor(timestamp / bucketSize) * bucketSize;
  }

  private updateTimeRange(collection: TimeSeriesCollection): void {
    let minTime = Infinity;
    let maxTime = -Infinity;

    for (const [timestamp, points] of collection.data) {
      for (const point of points) {
        minTime = Math.min(minTime, point.timestamp);
        maxTime = Math.max(maxTime, point.timestamp);
      }
    }

    collection.metadata.timeRange = {
      start: minTime === Infinity ? 0 : minTime,
      end: maxTime === -Infinity ? 0 : maxTime
    };
  }

  private matchesTags(pointTags: Record<string, any>, queryTags: Record<string, any>): boolean {
    if (!queryTags) return true;

    for (const [key, value] of Object.entries(queryTags)) {
      if (pointTags[key] !== value) {
        return false;
      }
    }

    return true;
  }

  private applyAggregation(points: TimeSeriesPoint[], aggregation: AggregationSpec): TimeSeriesPoint[] {
    if (!aggregation || !aggregation.function) {
      return points;
    }

    const { function: aggFunc, interval, groupBy } = aggregation;
    const groups = new Map<string, TimeSeriesPoint[]>();

    // Group points
    for (const point of points) {
      let groupKey = 'all';

      if (groupBy) {
        const groupValues = groupBy.map(field => point.tags[field] || 'null');
        groupKey = groupValues.join('|');
      }

      if (!groups.has(groupKey)) {
        groups.set(groupKey, []);
      }
      groups.get(groupKey)!.push(point);
    }

    // Apply aggregation to each group
    const results: TimeSeriesPoint[] = [];

    for (const [groupKey, groupPoints] of groups) {
      if (groupPoints.length === 0) continue;

      const aggregated = this.aggregatePoints(groupPoints, aggFunc);
      if (aggregated) {
        results.push(aggregated);
      }
    }

    return results;
  }

  private aggregatePoints(points: TimeSeriesPoint[], func: AggregationFunction): TimeSeriesPoint | null {
    if (points.length === 0) return null;

    const values = points.map(p => p.value);
    let aggregatedValue: number;

    switch (func) {
      case 'avg':
        aggregatedValue = values.reduce((a, b) => a + b, 0) / values.length;
        break;
      case 'sum':
        aggregatedValue = values.reduce((a, b) => a + b, 0);
        break;
      case 'min':
        aggregatedValue = Math.min(...values);
        break;
      case 'max':
        aggregatedValue = Math.max(...values);
        break;
      case 'count':
        aggregatedValue = values.length;
        break;
      case 'first':
        aggregatedValue = values[0];
        break;
      case 'last':
        aggregatedValue = values[values.length - 1];
        break;
      default:
        return null;
    }

    // Use the timestamp of the first point
    return {
      timestamp: points[0].timestamp,
      value: aggregatedValue,
      tags: { ...points[0].tags, _aggregated: func }
    };
  }

  private shouldCompress(collection: TimeSeriesCollection): boolean {
    const { options } = collection;
    if (!options.compression) return false;

    const { threshold = 10000 } = options.compression;
    return collection.metadata.totalPoints > threshold;
  }

  private compressCollection(collection: TimeSeriesCollection): void {
    // Simple compression - could be enhanced with more sophisticated algorithms
    const { options } = collection;
    if (!options.compression) return;

    const { algorithm = 'simple' } = options.compression;

    if (algorithm === 'simple') {
      // Remove duplicate consecutive values
      for (const [timestamp, points] of collection.data) {
        const compressed: TimeSeriesPoint[] = [];
        let lastValue: any = undefined;

        for (const point of points) {
          if (point.value !== lastValue) {
            compressed.push(point);
            lastValue = point.value;
          }
        }

        collection.data.set(timestamp, compressed);
      }
    }

    // Update compression ratio
    const newTotalPoints = Array.from(collection.data.values()).reduce((sum, points) => sum + points.length, 0);
    collection.metadata.compressionRatio = newTotalPoints / collection.metadata.totalPoints;
    collection.metadata.totalPoints = newTotalPoints;

    logger.info('Time-series compression completed', {
      collection: collection.name,
      compressionRatio: collection.metadata.compressionRatio
    });
  }

  private buildIndex(collection: TimeSeriesCollection, index: TimeSeriesIndex): void {
    const { spec } = index;

    for (const [timestamp, points] of collection.data) {
      for (const point of points) {
        const indexKey = this.generateIndexKey(point, spec);
        if (!index.data.has(indexKey)) {
          index.data.set(indexKey, []);
        }
        index.data.get(indexKey)!.push(point);
      }
    }
  }

  private generateIndexKey(point: TimeSeriesPoint, spec: TimeSeriesIndexSpec): string {
    const keyParts: string[] = [];

    if (spec.timeBucket) {
      const bucket = Math.floor(point.timestamp / spec.timeBucket);
      keyParts.push(bucket.toString());
    }

    if (spec.tags) {
      for (const tag of spec.tags) {
        keyParts.push(String(point.tags[tag] || 'null'));
      }
    }

    return keyParts.join('|');
  }

  private calculateDataSize(collection: TimeSeriesCollection): number {
    let size = 0;
    for (const [timestamp, points] of collection.data) {
      size += 8; // timestamp
      size += points.length * (8 + 50); // rough estimate per point
    }
    return size;
  }

  private calculateIndexSize(collection: TimeSeriesCollection): number {
    let size = 0;
    for (const index of collection.indexes.values()) {
      for (const [key, points] of index.data) {
        size += key.length + points.length * 8; // rough estimate
      }
    }
    return size;
  }

  private exportAsJSON(collection: TimeSeriesCollection): any {
    const data: any[] = [];

    for (const [timestamp, points] of collection.data) {
      for (const point of points) {
        data.push({
          timestamp: point.timestamp,
          value: point.value,
          tags: point.tags
        });
      }
    }

    return {
      collection: collection.name,
      metadata: collection.metadata,
      data
    };
  }

  private exportAsCSV(collection: TimeSeriesCollection): string {
    const lines: string[] = ['timestamp,value,tags'];

    for (const [timestamp, points] of collection.data) {
      for (const point of points) {
        const tagsJson = JSON.stringify(point.tags);
        lines.push(`${point.timestamp},${point.value},"${tagsJson}"`);
      }
    }

    return lines.join('\n');
  }
}

// Type definitions
export interface TimeSeriesOptions {
  bucketSize?: number; // Time bucket size in milliseconds
  retentionPeriod?: number; // Data retention period
  compression?: {
    enabled?: boolean;
    threshold?: number; // Points threshold for compression
    algorithm?: 'simple' | 'advanced';
  };
  maxPoints?: number; // Maximum points per collection
}

export interface TimeSeriesPoint {
  timestamp: number;
  value: number;
  tags: Record<string, any>;
}

export interface TimeSeriesQuery {
  startTime: number;
  endTime: number;
  tags?: Record<string, any>;
  aggregation?: AggregationSpec;
  limit?: number;
}

export interface AggregationSpec {
  function: AggregationFunction;
  interval?: number;
  groupBy?: string[];
}

export type AggregationFunction = 'avg' | 'sum' | 'min' | 'max' | 'count' | 'first' | 'last';

export interface TimeSeriesResult {
  collection: string;
  points: TimeSeriesPoint[];
  query: TimeSeriesQuery;
  executionTime: number;
  metadata: {
    totalPoints: number;
    timeRange: {
      start: number;
      end: number;
    };
  };
}

export interface DownsampleOptions {
  interval: number; // Downsampling interval in milliseconds
  aggregation: AggregationSpec;
  startTime: number;
  endTime: number;
}

export interface TimeSeriesIndexSpec {
  tags?: string[];
  timeBucket?: number;
}

export interface TimeSeriesStats {
  collection: string;
  totalPoints: number;
  timeRange: {
    start: number;
    end: number;
  };
  dataSize: number;
  indexSize: number;
  compressionRatio: number;
  indexes: string[];
  createdAt: number;
  lastCompaction: number;
}

interface TimeSeriesCollection {
  name: string;
  options: TimeSeriesOptions;
  data: Map<number, TimeSeriesPoint[]>; // timestamp -> points
  metadata: {
    createdAt: number;
    totalPoints: number;
    timeRange: { start: number; end: number };
    compressionRatio: number;
    lastCompaction: number;
  };
  indexes: Map<string, TimeSeriesIndex>;
}

interface TimeSeriesIndex {
  name: string;
  spec: TimeSeriesIndexSpec;
  data: Map<string, TimeSeriesPoint[]>;
  createdAt: number;
}
