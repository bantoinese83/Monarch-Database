/**
 * Memory Optimizer
 * 
 * Advanced memory optimization strategies including:
 * - Weak references for cached data
 * - Memory pressure detection
 * - Automatic garbage collection hints
 * - Memory-efficient data structures
 */

/**
 * Weak reference cache for large objects
 */
export class WeakCache<K extends object, V> {
  private cache: WeakMap<K, V> = new WeakMap();
  private strongRefs: Map<K, V> = new Map(); // Keep strong refs until cleared
  private maxStrongRefs: number;

  constructor(maxStrongRefs: number = 100) {
    this.maxStrongRefs = maxStrongRefs;
  }

  set(key: K, value: V, strong: boolean = false): void {
    this.cache.set(key, value);
    
    if (strong) {
      // Evict oldest if at capacity
      if (this.strongRefs.size >= this.maxStrongRefs) {
        const firstKey = this.strongRefs.keys().next().value;
        if (firstKey) {
          this.strongRefs.delete(firstKey);
        }
      }
      this.strongRefs.set(key, value);
    }
  }

  get(key: K): V | undefined {
    return this.cache.get(key);
  }

  has(key: K): boolean {
    return this.cache.has(key);
  }

  clear(): void {
    this.strongRefs.clear();
    // WeakMap doesn't need clearing, GC will handle it
  }
}

/**
 * Memory pressure monitor
 */
export class MemoryPressureMonitor {
  private thresholds: {
    warning: number; // bytes
    critical: number; // bytes
  };
  private listeners: Array<(level: 'normal' | 'warning' | 'critical') => void> = [];

  constructor(warningThreshold: number = 100 * 1024 * 1024, criticalThreshold: number = 500 * 1024 * 1024) {
    this.thresholds = {
      warning: warningThreshold,
      critical: criticalThreshold
    };
  }

  /**
   * Estimate current memory usage (heuristic)
   */
  estimateMemoryUsage(): number {
    if (typeof process !== 'undefined' && process.memoryUsage) {
      return process.memoryUsage().heapUsed;
    }
    // Browser: rough estimate based on performance.memory (if available)
    if (typeof performance !== 'undefined' && (performance as any).memory) {
      return (performance as any).memory.usedJSHeapSize;
    }
    return 0;
  }

  /**
   * Check memory pressure level
   */
  checkPressure(): 'normal' | 'warning' | 'critical' {
    const usage = this.estimateMemoryUsage();
    
    if (usage >= this.thresholds.critical) {
      this.notifyListeners('critical');
      return 'critical';
    } else if (usage >= this.thresholds.warning) {
      this.notifyListeners('warning');
      return 'warning';
    }
    
    return 'normal';
  }

  /**
   * Add pressure listener
   */
  onPressureChange(listener: (level: 'normal' | 'warning' | 'critical') => void): void {
    this.listeners.push(listener);
  }

  /**
   * Remove pressure listener
   */
  offPressureChange(listener: (level: 'normal' | 'warning' | 'critical') => void): void {
    const index = this.listeners.indexOf(listener);
    if (index > -1) {
      this.listeners.splice(index, 1);
    }
  }

  private notifyListeners(level: 'normal' | 'warning' | 'critical'): void {
    for (const listener of this.listeners) {
      try {
        listener(level);
      } catch (error) {
        // Ignore listener errors
      }
    }
  }
}

/**
 * Compact array representation (for numeric arrays)
 */
export class CompactArray {
  /**
   * Convert number array to TypedArray if possible (saves memory)
   */
  static compact(numbers: number[]): Int32Array | Float64Array | number[] {
    // Check if all integers
    const allIntegers = numbers.every(n => Number.isInteger(n) && n >= -2147483648 && n <= 2147483647);
    if (allIntegers) {
      return Int32Array.from(numbers);
    }
    
    // Use Float64 for all floats (not Float32 to avoid precision issues)
    return Float64Array.from(numbers);
  }
}

/**
 * Memory-efficient set using bitmaps (for small integer sets)
 */
export class BitmapSet {
  private bits: Uint32Array;
  private maxValue: number;

  constructor(maxValue: number = 1000) {
    this.maxValue = maxValue;
    const arraySize = Math.ceil((maxValue + 1) / 32);
    this.bits = new Uint32Array(arraySize);
  }

  add(value: number): void {
    if (value < 0 || value > this.maxValue) {
      throw new Error(`Value ${value} out of range [0, ${this.maxValue}]`);
    }
    const index = Math.floor(value / 32);
    const bit = value % 32;
    this.bits[index] |= (1 << bit);
  }

  has(value: number): boolean {
    if (value < 0 || value > this.maxValue) return false;
    const index = Math.floor(value / 32);
    const bit = value % 32;
    return (this.bits[index] & (1 << bit)) !== 0;
  }

  delete(value: number): boolean {
    if (!this.has(value)) return false;
    const index = Math.floor(value / 32);
    const bit = value % 32;
    this.bits[index] &= ~(1 << bit);
    return true;
  }

  size(): number {
    let count = 0;
    for (let i = 0; i < this.bits.length; i++) {
      const word = this.bits[i];
      // Count bits using Brian Kernighan's algorithm
      let n = word;
      while (n) {
        n &= (n - 1);
        count++;
      }
    }
    return count;
  }

  clear(): void {
    this.bits.fill(0);
  }
}

export const globalMemoryMonitor = new MemoryPressureMonitor();

