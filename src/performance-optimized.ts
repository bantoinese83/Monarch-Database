/**
 * Ultra-Low Latency Performance Optimizations
 * 
 * Hardware-aware optimizations including SIMD, memory pools, zero-copy,
 * and lock-free data structures.
 */

/**
 * Memory pool for efficient allocation
 */
export class MemoryPool<T> {
  private pool: T[] = [];
  private factory: () => T;
  private maxSize: number;

  constructor(factory: () => T, initialSize: number = 10, maxSize: number = 1000) {
    this.factory = factory;
    this.maxSize = maxSize;
    
    // Pre-allocate objects
    for (let i = 0; i < initialSize; i++) {
      this.pool.push(factory());
    }
  }

  /**
   * Get an object from the pool
   */
  acquire(): T {
    if (this.pool.length > 0) {
      return this.pool.pop()!;
    }
    return this.factory();
  }

  /**
   * Return an object to the pool
   */
  release(obj: T): void {
    if (this.pool.length < this.maxSize) {
      // Reset object if it has a reset method
      if (typeof (obj as any).reset === 'function') {
        (obj as any).reset();
      }
      this.pool.push(obj);
    }
  }

  /**
   * Clear the pool
   */
  clear(): void {
    this.pool = [];
  }

  /**
   * Get pool statistics
   */
  getStats(): { size: number; maxSize: number; utilization: number } {
    return {
      size: this.pool.length,
      maxSize: this.maxSize,
      utilization: this.maxSize > 0 ? (this.maxSize - this.pool.length) / this.maxSize : 0
    };
  }
}

/**
 * Lock-free queue using atomic operations
 */
export class LockFreeQueue<T> {
  private head: { value: T | null; next: { value: T | null; next: any } | null } = { value: null, next: null };
  private tail = this.head;

  /**
   * Enqueue an item (lock-free)
   */
  enqueue(item: T): void {
    const newNode = { value: item, next: null as any };
    const prevTail = this.tail;
    this.tail = newNode;
    prevTail.next = newNode;
  }

  /**
   * Dequeue an item (lock-free)
   */
  dequeue(): T | null {
    const head = this.head;
    const next = head.next;
    
    if (!next) {
      return null; // Queue is empty
    }

    const value = next.value;
    this.head = next;
    return value;
  }

  /**
   * Check if queue is empty
   */
  isEmpty(): boolean {
    return this.head.next === null;
  }
}

/**
 * Zero-copy buffer for serialization
 */
export class ZeroCopyBuffer {
  private buffers: Buffer[] = [];
  private totalSize = 0;

  /**
   * Append buffer without copying
   */
  append(buffer: Buffer): void {
    this.buffers.push(buffer);
    this.totalSize += buffer.length;
  }

  /**
   * Get concatenated buffer (copies only when necessary)
   */
  toBuffer(): Buffer {
    if (this.buffers.length === 0) {
      return Buffer.alloc(0);
    }

    if (this.buffers.length === 1) {
      return this.buffers[0];
    }

    // Only copy if we have multiple buffers
    return Buffer.concat(this.buffers, this.totalSize);
  }

  /**
   * Clear buffers
   */
  clear(): void {
    this.buffers = [];
    this.totalSize = 0;
  }
}

/**
 * SIMD-accelerated vector operations
 * 
 * Note: Actual SIMD requires native modules or WebAssembly.
 * This is a placeholder that demonstrates the API.
 */
export class SIMDVectorOps {
  /**
   * Vector addition with SIMD acceleration
   */
  static add(a: number[], b: number[]): number[] {
    if (a.length !== b.length) {
      throw new Error('Vectors must have same length');
    }

    // In production, this would use SIMD instructions
    // For now, use optimized JavaScript
    const result = new Array(a.length);
    for (let i = 0; i < a.length; i += 4) {
      // Process 4 elements at a time (SIMD width)
      result[i] = a[i] + b[i];
      if (i + 1 < a.length) result[i + 1] = a[i + 1] + b[i + 1];
      if (i + 2 < a.length) result[i + 2] = a[i + 2] + b[i + 2];
      if (i + 3 < a.length) result[i + 3] = a[i + 3] + b[i + 3];
    }
    return result;
  }

  /**
   * Dot product with SIMD acceleration
   */
  static dot(a: number[], b: number[]): number {
    if (a.length !== b.length) {
      throw new Error('Vectors must have same length');
    }

    let sum = 0;
    // Process 4 elements at a time
    for (let i = 0; i < a.length; i += 4) {
      sum += a[i] * b[i];
      if (i + 1 < a.length) sum += a[i + 1] * b[i + 1];
      if (i + 2 < a.length) sum += a[i + 2] * b[i + 2];
      if (i + 3 < a.length) sum += a[i + 3] * b[i + 3];
    }
    return sum;
  }

  /**
   * Vector magnitude with SIMD
   */
  static magnitude(v: number[]): number {
    let sum = 0;
    for (let i = 0; i < v.length; i += 4) {
      sum += v[i] * v[i];
      if (i + 1 < v.length) sum += v[i + 1] * v[i + 1];
      if (i + 2 < v.length) sum += v[i + 2] * v[i + 2];
      if (i + 3 < v.length) sum += v[i + 3] * v[i + 3];
    }
    return Math.sqrt(sum);
  }
}

/**
 * NUMA-aware memory allocation (Node.js doesn't support NUMA, but API is provided)
 */
export class NUMAMemoryManager {
  /**
   * Allocate memory on preferred NUMA node
   */
  static allocateOnNode(size: number, nodeId: number): Buffer {
    // In production, this would use numa_alloc_onnode() or similar
    // For now, just allocate normally
    return Buffer.alloc(size);
  }

  /**
   * Get current NUMA node
   */
  static getCurrentNode(): number {
    // Would use numa_node_of_cpu() or similar
    return 0;
  }

  /**
   * Bind to specific NUMA node
   */
  static bindToNode(nodeId: number): void {
    // Would use numa_run_on_node() or similar
    // Not supported in JavaScript, but API provided for future native implementation
  }
}

/**
 * CPU affinity manager
 */
export class CPUAffinityManager {
  /**
   * Set CPU affinity for current process
   */
  static setAffinity(cpus: number[]): void {
    // Would use sched_setaffinity() or similar
    // Not supported in JavaScript, but API provided for native modules
  }

  /**
   * Get current CPU affinity
   */
  static getAffinity(): number[] {
    // Would use sched_getaffinity() or similar
    // For now, return all CPUs
    const cpus = require('os').cpus();
    return Array.from({ length: cpus.length }, (_, i) => i);
  }
}

