/**
 * Performance Optimizer
 * 
 * Advanced performance optimizations including:
 * - Object pooling
 * - Query plan caching
 * - Hot path optimization
 * - Memory-efficient patterns
 */

import { Query, QueryPlan } from './types';

/**
 * Object pool for frequently allocated objects
 */
export class ObjectPool<T> {
  private pool: T[] = [];
  private factory: () => T;
  private reset: (obj: T) => void;
  private maxSize: number;

  constructor(
    factory: () => T,
    reset: (obj: T) => void,
    initialSize: number = 10,
    maxSize: number = 1000
  ) {
    this.factory = factory;
    this.reset = reset;
    this.maxSize = maxSize;

    // Pre-allocate pool
    for (let i = 0; i < initialSize; i++) {
      this.pool.push(factory());
    }
  }

  acquire(): T {
    return this.pool.pop() || this.factory();
  }

  release(obj: T): void {
    if (this.pool.length < this.maxSize) {
      this.reset(obj);
      this.pool.push(obj);
    }
  }

  getStats(): { size: number; maxSize: number; utilization: number } {
    return {
      size: this.pool.length,
      maxSize: this.maxSize,
      utilization: this.maxSize > 0 ? (this.maxSize - this.pool.length) / this.maxSize : 0
    };
  }
}

/**
 * Query plan cache for optimized query execution
 */
export class QueryPlanCache {
  private cache: Map<string, QueryPlan> = new Map();
  private accessOrder: string[] = [];
  private maxSize: number;

  constructor(maxSize: number = 1000) {
    this.maxSize = maxSize;
  }

  /**
   * Generate cache key from query
   */
  private getCacheKey(query: Query): string {
    return JSON.stringify(query);
  }

  /**
   * Get cached query plan
   */
  get(query: Query): QueryPlan | null {
    const key = this.getCacheKey(query);
    const plan = this.cache.get(key);
    
    if (plan) {
      // Move to end (LRU)
      const index = this.accessOrder.indexOf(key);
      if (index > -1) {
        this.accessOrder.splice(index, 1);
      }
      this.accessOrder.push(key);
      return plan;
    }

    return null;
  }

  /**
   * Store query plan
   */
  set(query: Query, plan: QueryPlan): void {
    const key = this.getCacheKey(query);

    // Evict if at capacity
    if (this.cache.size >= this.maxSize && !this.cache.has(key)) {
      const oldestKey = this.accessOrder.shift();
      if (oldestKey) {
        this.cache.delete(oldestKey);
      }
    }

    this.cache.set(key, plan);
    
    // Update access order
    const index = this.accessOrder.indexOf(key);
    if (index > -1) {
      this.accessOrder.splice(index, 1);
    }
    this.accessOrder.push(key);
  }

  /**
   * Invalidate cache entries matching pattern
   */
  invalidate(pattern?: (query: Query) => boolean): void {
    if (!pattern) {
      this.cache.clear();
      this.accessOrder = [];
      return;
    }

    for (const [key, plan] of this.cache.entries()) {
      try {
        const query = JSON.parse(key) as Query;
        if (pattern(query)) {
          this.cache.delete(key);
          const index = this.accessOrder.indexOf(key);
          if (index > -1) {
            this.accessOrder.splice(index, 1);
          }
        }
      } catch {
        // Invalid key, remove it
        this.cache.delete(key);
      }
    }
  }

  clear(): void {
    this.cache.clear();
    this.accessOrder = [];
  }

  getStats(): { size: number; maxSize: number; hitRate?: number } {
    return {
      size: this.cache.size,
      maxSize: this.maxSize
    };
  }
}

/**
 * Fast string hashing for cache keys (FNV-1a)
 */
export function fastHash(str: string): string {
  let hash = 2166136261;
  for (let i = 0; i < str.length; i++) {
    hash ^= str.charCodeAt(i);
    hash += (hash << 1) + (hash << 4) + (hash << 7) + (hash << 8) + (hash << 24);
  }
  return hash.toString(36);
}

/**
 * Pre-allocate arrays for batch operations
 */
export class ArrayPool {
  private pools: Map<number, number[][]> = new Map(); // size -> arrays

  acquire(size: number): any[] {
    const pool = this.pools.get(size);
    if (pool && pool.length > 0) {
      return pool.pop()!;
    }
    return new Array(size);
  }

  release(arr: any[]): void {
    arr.length = 0; // Clear array
    const size = arr.length;
    if (!this.pools.has(size)) {
      this.pools.set(size, []);
    }
    const pool = this.pools.get(size)!;
    if (pool.length < 100) { // Limit pool size
      pool.push(arr as number[]);
    }
  }
}

/**
 * Fast object shallow clone (faster than spread operator for small objects)
 */
export function fastClone<T extends Record<string, any>>(obj: T): T {
  const cloned = {} as T;
  for (const key in obj) {
    if (Object.prototype.hasOwnProperty.call(obj, key)) {
      cloned[key] = obj[key];
    }
  }
  return cloned;
}

/**
 * Fast object merge (optimized for small objects)
 */
export function fastMerge<T extends Record<string, any>>(target: T, source: Partial<T>): T {
  const merged = {} as T;

  // Copy target
  for (const key in target) {
    if (Object.prototype.hasOwnProperty.call(target, key)) {
      merged[key] = target[key];
    }
  }

  // Override with source
  for (const key in source) {
    if (Object.prototype.hasOwnProperty.call(source, key)) {
      merged[key] = source[key] as T[Extract<keyof T, string>];
    }
  }

  return merged;
}

/**
 * Deep merge function that can handle nested objects and arrays
 * Unlike fastMerge, this performs a deep merge of nested objects
 */
export function deepMerge<T extends Record<string, any>>(target: T, source: Partial<T>): T {
  const merged = {} as T;

  // Copy target properties
  for (const key in target) {
    if (Object.prototype.hasOwnProperty.call(target, key)) {
      const targetValue = target[key];
      if (isObject(targetValue) && !Array.isArray(targetValue) && targetValue !== null) {
        merged[key] = { ...targetValue }; // Shallow copy objects for deep merge
      } else {
        merged[key] = targetValue;
      }
    }
  }

  // Deep merge source properties
  for (const key in source) {
    if (Object.prototype.hasOwnProperty.call(source, key)) {
      const sourceValue = source[key];
      const targetValue = merged[key];

      // If both are objects (not arrays or null), deep merge them
      if (isObject(sourceValue) && isObject(targetValue) &&
          !Array.isArray(sourceValue) && !Array.isArray(targetValue) &&
          sourceValue !== null && targetValue !== null) {
        merged[key] = deepMerge(targetValue as T[Extract<keyof T, string>], sourceValue as Partial<T[Extract<keyof T, string>]>);
      } else {
        // For primitives, arrays, or when types don't match, replace entirely
        merged[key] = sourceValue as T[Extract<keyof T, string>];
      }
    }
  }

  return merged;
}

/**
 * Type guard for objects
 */
function isObject(value: any): value is Record<string, any> {
  return typeof value === 'object' && value !== null;
}

/**
 * Optimized Set operations
 */
export class FastSet<T> {
  private map: Map<T, boolean> = new Map();

  add(value: T): void {
    this.map.set(value, true);
  }

  has(value: T): boolean {
    return this.map.has(value);
  }

  delete(value: T): boolean {
    return this.map.delete(value);
  }

  clear(): void {
    this.map.clear();
  }

  size(): number {
    return this.map.size;
  }

  values(): T[] {
    return Array.from(this.map.keys());
  }

  forEach(callback: (value: T) => void): void {
    for (const key of this.map.keys()) {
      callback(key);
    }
  }
}

/**
 * Circular buffer for efficient queue operations
 */
export class CircularBuffer<T> {
  private buffer: (T | null)[];
  private head = 0;
  private tail = 0;
  private count = 0;

  constructor(capacity: number) {
    this.buffer = new Array(capacity).fill(null);
  }

  push(value: T): boolean {
    if (this.count === this.buffer.length) {
      return false; // Full
    }

    this.buffer[this.tail] = value;
    this.tail = (this.tail + 1) % this.buffer.length;
    this.count++;
    return true;
  }

  shift(): T | null {
    if (this.count === 0) {
      return null;
    }

    const value = this.buffer[this.head];
    this.buffer[this.head] = null;
    this.head = (this.head + 1) % this.buffer.length;
    this.count--;
    return value;
  }

  isEmpty(): boolean {
    return this.count === 0;
  }

  isFull(): boolean {
    return this.count === this.buffer.length;
  }

  size(): number {
    return this.count;
  }

  capacity(): number {
    return this.buffer.length;
  }

  clear(): void {
    this.buffer.fill(null);
    this.head = 0;
    this.tail = 0;
    this.count = 0;
  }
}

/**
 * Performance profiler for hot spot detection
 */
export class PerformanceProfiler {
  private measurements: Map<string, number[]> = new Map();
  private enabled: boolean = true;

  enable(): void {
    this.enabled = true;
  }

  disable(): void {
    this.enabled = false;
  }

  measure<T>(name: string, fn: () => T): T {
    if (!this.enabled) {
      return fn();
    }

    const start = performance.now();
    const result = fn();
    const duration = performance.now() - start;

    if (!this.measurements.has(name)) {
      this.measurements.set(name, []);
    }
    this.measurements.get(name)!.push(duration);

    return result;
  }

  async measureAsync<T>(name: string, fn: () => Promise<T>): Promise<T> {
    if (!this.enabled) {
      return fn();
    }

    const start = performance.now();
    const result = await fn();
    const duration = performance.now() - start;

    if (!this.measurements.has(name)) {
      this.measurements.set(name, []);
    }
    this.measurements.get(name)!.push(duration);

    return result;
  }

  getStats(name: string): {
    count: number;
    total: number;
    average: number;
    min: number;
    max: number;
    p50: number;
    p95: number;
    p99: number;
  } | null {
    const measurements = this.measurements.get(name);
    if (!measurements || measurements.length === 0) {
      return null;
    }

    const sorted = [...measurements].sort((a, b) => a - b);
    const count = sorted.length;
    const total = sorted.reduce((sum, val) => sum + val, 0);
    const average = total / count;

    return {
      count,
      total,
      average,
      min: sorted[0],
      max: sorted[count - 1],
      p50: sorted[Math.floor(count * 0.5)],
      p95: sorted[Math.floor(count * 0.95)],
      p99: sorted[Math.floor(count * 0.99)]
    };
  }

  getAllStats(): Map<string, ReturnType<typeof this.getStats>> {
    const stats = new Map();
    for (const name of this.measurements.keys()) {
      stats.set(name, this.getStats(name));
    }
    return stats;
  }

  reset(): void {
    this.measurements.clear();
  }
}

export const globalProfiler = new PerformanceProfiler();

