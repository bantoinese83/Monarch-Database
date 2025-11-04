import { logger } from './logger';

export interface PerformanceMetrics {
  operationCount: number;
  totalTime: number;
  averageTime: number;
  minTime: number;
  maxTime: number;
  lastOperationTime: number;
}

export interface PerformanceMonitorOptions {
  maxMetrics?: number;
  maxOperations?: number;
  defaultTimeout?: number;
}

export class PerformanceMonitor {
  private metrics = new Map<string, PerformanceMetrics>();
  private operations = new Map<string, { startTime: number; timeout: number }>(); // operation -> { startTime, timeout }
  private readonly maxMetrics: number;
  private readonly maxOperations: number;
  private readonly defaultTimeout: number;

  constructor(options: PerformanceMonitorOptions = {}) {
    this.maxMetrics = options.maxMetrics ?? 100;
    this.maxOperations = options.maxOperations ?? 50;
    this.defaultTimeout = options.defaultTimeout ?? 30000; // 30 seconds default
  }

  /**
   * Start timing an operation with default timeout
   */
  start(operation: string): void {
    this.startWithTimeout(operation, this.defaultTimeout);
  }

  /**
   * Start timing an operation with custom timeout
   */
  startWithTimeout(operation: string, timeoutMs: number = this.defaultTimeout): void {
    if (!operation || typeof operation !== 'string') {
      logger.warn('Performance monitor: invalid operation name');
      return;
    }

    // Prevent unbounded growth
    if (this.operations.size >= this.maxOperations) {
      logger.warn('Performance monitor: too many concurrent operations, skipping');
      return;
    }

    // Clean up timed out operations
    this.cleanupTimedOutOperations();

    this.operations.set(operation, {
      startTime: performance.now(),
      timeout: timeoutMs
    });
  }

  /**
   * End timing an operation and record metrics
   */
  end(operation: string): void {
    if (!operation || typeof operation !== 'string') {
      logger.warn('Performance monitor: invalid operation name');
      return;
    }

    const operationData = this.operations.get(operation);
    if (operationData === undefined) {
      logger.warn('Performance monitor: operation was not started', { operation });
      return;
    }

    const { startTime } = operationData;
    const duration = performance.now() - startTime;
    this.operations.delete(operation);

    // Validate duration (prevent negative or unreasonably large values)
    if (duration < 0 || duration > 3600000) { // 1 hour max
      logger.warn('Performance monitor: invalid duration', { operation, duration });
      return;
    }

    // Ensure metrics map doesn't grow unbounded
    if (this.metrics.size >= this.maxMetrics && !this.metrics.has(operation)) {
      // Remove oldest metric if we're at the limit and this is a new operation
      const firstKey = this.metrics.keys().next().value;
      if (firstKey) {
        this.metrics.delete(firstKey);
      }
    }

    let metrics = this.metrics.get(operation);
    if (!metrics) {
      metrics = {
        operationCount: 0,
        totalTime: 0,
        averageTime: 0,
        minTime: Infinity,
        maxTime: 0,
        lastOperationTime: duration
      };
      this.metrics.set(operation, metrics);
    }

    metrics.operationCount++;
    metrics.totalTime += duration;
    metrics.averageTime = metrics.totalTime / metrics.operationCount;
    metrics.minTime = Math.min(metrics.minTime, duration);
    metrics.maxTime = Math.max(metrics.maxTime, duration);
    metrics.lastOperationTime = duration;
  }

  /**
   * Get performance metrics for an operation
   */
  getMetrics(operation: string): PerformanceMetrics | undefined {
    if (!operation || typeof operation !== 'string') {
      return undefined;
    }

    this.cleanupTimedOutOperations();
    return this.metrics.get(operation);
  }

  /**
   * Get all performance metrics
   */
  getAllMetrics(): Map<string, PerformanceMetrics> {
    this.cleanupTimedOutOperations();
    return new Map(this.metrics);
  }

  /**
   * Clean up operations that have timed out
   */
  private cleanupTimedOutOperations(): void {
    const now = performance.now();
    const timedOutOperations: string[] = [];

    for (const [operation, operationData] of this.operations) {
      const { startTime, timeout } = operationData;
      if (now - startTime > timeout) {
        timedOutOperations.push(operation);
      }
    }

    for (const operation of timedOutOperations) {
      this.operations.delete(operation);
      logger.warn('Performance monitor: operation timed out and was removed', { operation });
    }
  }

  /**
   * Reset all metrics
   */
  reset(): void {
    this.metrics.clear();
    this.operations.clear();
  }

  /**
   * Get the current number of active operations
   */
  getActiveOperationCount(): number {
    this.cleanupTimedOutOperations();
    return this.operations.size;
  }

  /**
   * Check if an operation is currently active
   */
  isOperationActive(operation: string): boolean {
    if (!operation || typeof operation !== 'string') {
      return false;
    }

    this.cleanupTimedOutOperations();
    return this.operations.has(operation);
  }

  /**
   * Get a summary report
   */
  getReport(): string {
    const reportData = this.generateReportData();
    return this.formatReport(reportData);
  }

  private generateReportData(): Array<{ operation: string; metrics: PerformanceMetrics }> {
    return Array.from(this.metrics.entries()).map(([operation, metrics]) => ({
      operation,
      metrics
    }));
  }

  private formatReport(reportData: Array<{ operation: string; metrics: PerformanceMetrics }>): string {
    const lines: string[] = ['Performance Report:', '=================='];

    for (const { operation, metrics } of reportData) {
      lines.push(
        `${operation}:`,
        `  Count: ${metrics.operationCount}`,
        `  Total: ${metrics.totalTime.toFixed(2)}ms`,
        `  Average: ${metrics.averageTime.toFixed(2)}ms`,
        `  Min: ${metrics.minTime.toFixed(2)}ms`,
        `  Max: ${metrics.maxTime.toFixed(2)}ms`,
        `  Last: ${metrics.lastOperationTime.toFixed(2)}ms`,
        ''
      );
    }

    return lines.join('\n');
  }
}

// Global performance monitor instance
export const globalMonitor = new PerformanceMonitor();
