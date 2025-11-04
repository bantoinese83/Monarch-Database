import { LIMITS, ERROR_MESSAGES } from './constants';
import { logger } from './logger';

/**
 * Concurrency Manager for Monarch Database
 * Handles concurrent operations, rate limiting, and circuit breaker patterns
 */
export class ConcurrencyManager {
  private activeOperations = new Map<string, {
    promise: Promise<any>;
    startTime: number;
    timeout: number;
    resolve: (value: any) => void;
    reject: (error: any) => void;
  }>();
  private operationCounts = new Map<string, number>();
  private lastResetTime = Date.now();
  private circuitBreakerOpen = false;
  private circuitBreakerFailures = 0;
  private circuitBreakerLastFailure = 0;
  private operationQueue: Array<{
    id: string;
    operation: () => Promise<any>;
    resolve: (value: any) => void;
    reject: (error: any) => void;
    priority: number;
    queuedTime: number;
  }> = [];
  private cleanupInterval: NodeJS.Timeout | null = null;

  constructor() {
    // Start periodic cleanup to prevent memory leaks
    this.cleanupInterval = setInterval(() => {
      this.cleanupCompletedOperations();
      this.cleanupExpiredQueuedOperations();
    }, 1000); // Clean up every second

    // Ensure cleanup on process exit
    if (typeof process !== 'undefined' && process.on) {
      process.on('exit', () => this.cleanup());
      process.on('SIGINT', () => this.cleanup());
      process.on('SIGTERM', () => this.cleanup());
    }
  }

  /**
   * Execute operation with concurrency control
   */
  async execute<T>(
    operationId: string,
    operation: () => Promise<T>,
    options: {
      priority?: number;
      timeout?: number;
      bypassLimits?: boolean;
    } = {}
  ): Promise<T> {
    const { priority = 0, timeout = 30000, bypassLimits = false } = options;

    // Check circuit breaker
    if (this.circuitBreakerOpen && !bypassLimits) {
      const timeSinceFailure = Date.now() - this.circuitBreakerLastFailure;
      if (timeSinceFailure < 60000) { // 1 minute cooldown
        throw new Error(ERROR_MESSAGES.CIRCUIT_BREAKER_OPEN);
      }
      this.circuitBreakerOpen = false;
      this.circuitBreakerFailures = 0;
      logger.info('Circuit breaker automatically reset');
    }

    // Check rate limits
    this.checkRateLimits(operationId);

    // Check concurrent operation limits
    if (!bypassLimits && this.activeOperations.size >= LIMITS.MAX_CONCURRENT_OPERATIONS) {
      logger.warn('Concurrent operations limit reached', {
        current: this.activeOperations.size,
        max: LIMITS.MAX_CONCURRENT_OPERATIONS
      });
      return this.queueOperation(operationId, operation, priority, timeout);
    }

    return this.runOperation(operationId, operation, timeout, bypassLimits);
  }

  /**
   * Get current concurrency statistics
   */
  getStats(): {
    activeOperations: number;
    queuedOperations: number;
    operationsPerSecond: Record<string, number>;
    circuitBreakerOpen: boolean;
    circuitBreakerFailures: number;
    averageOperationTime: number;
    maxQueuedTime: number;
  } {
    const operationsPerSecond: Record<string, number> = {};
    const timeSinceReset = (Date.now() - this.lastResetTime) / 1000;

    for (const [operation, count] of this.operationCounts) {
      operationsPerSecond[operation] = timeSinceReset > 0 ? count / timeSinceReset : 0;
    }

    // Calculate average operation time for active operations
    let totalTime = 0;
    let operationCount = 0;
    const now = Date.now();

    for (const operation of this.activeOperations.values()) {
      totalTime += (now - operation.startTime);
      operationCount++;
    }

    const averageOperationTime = operationCount > 0 ? totalTime / operationCount : 0;

    // Calculate max queued time
    const maxQueuedTime = this.operationQueue.length > 0
      ? Math.max(...this.operationQueue.map(op => now - op.queuedTime))
      : 0;

    return {
      activeOperations: this.activeOperations.size,
      queuedOperations: this.operationQueue.length,
      operationsPerSecond,
      circuitBreakerOpen: this.circuitBreakerOpen,
      circuitBreakerFailures: this.circuitBreakerFailures,
      averageOperationTime,
      maxQueuedTime
    };
  }

  /**
   * Reset operation counters and circuit breaker
   */
  reset(): void {
    // Cancel all pending operations
    for (const [operationId, operation] of this.activeOperations) {
      try {
        operation.reject(new Error('Operation cancelled due to reset'));
      } catch (error) {
        // Ignore errors during cancellation
      }
    }

    // Clear all queues and maps
    this.activeOperations.clear();
    this.operationCounts.clear();
    this.operationQueue.length = 0;
    this.lastResetTime = Date.now();
    this.circuitBreakerOpen = false;
    this.circuitBreakerFailures = 0;
    this.circuitBreakerLastFailure = 0;

    logger.info('Concurrency manager reset - all operations cancelled');
  }

  /**
   * Clean up completed operations to prevent memory leaks
   */
  private cleanupCompletedOperations(): void {
    // This method is called periodically to ensure cleanup
    // The actual cleanup happens in the promise handlers
    const now = Date.now();
    let cleaned = 0;

    // Check for timed out operations
    for (const [operationId, operation] of this.activeOperations) {
      if (now - operation.startTime > operation.timeout) {
        try {
          operation.reject(new Error(`Operation timed out after ${operation.timeout}ms`));
          this.activeOperations.delete(operationId);
          cleaned++;
        } catch (error) {
          // Ignore errors during cleanup
        }
      }
    }

    if (cleaned > 0) {
      logger.debug(`Cleaned up ${cleaned} timed out operations`);
    }
  }

  /**
   * Clean up expired queued operations
   */
  private cleanupExpiredQueuedOperations(): void {
    const now = Date.now();
    const maxQueueTime = 300000; // 5 minutes max queue time
    const initialLength = this.operationQueue.length;

    this.operationQueue = this.operationQueue.filter(queuedOp => {
      if (now - queuedOp.queuedTime > maxQueueTime) {
        try {
          queuedOp.reject(new Error('Operation expired in queue'));
          return false;
        } catch (error) {
          return false;
        }
      }
      return true;
    });

    const cleaned = initialLength - this.operationQueue.length;
    if (cleaned > 0) {
      logger.warn(`Cleaned up ${cleaned} expired queued operations`);
    }
  }

  /**
   * Cleanup method for graceful shutdown
   */
  private cleanup(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }

    // Cancel all pending operations
    this.reset();
  }

  /**
   * Manually trigger circuit breaker
   */
  openCircuitBreaker(): void {
    this.circuitBreakerOpen = true;
    this.circuitBreakerLastFailure = Date.now();
    logger.warn('Circuit breaker manually opened');
  }

  /**
   * Close circuit breaker
   */
  closeCircuitBreaker(): void {
    this.circuitBreakerOpen = false;
    this.circuitBreakerFailures = 0;
    logger.info('Circuit breaker manually closed');
  }

  private async runOperation<T>(
    operationId: string,
    operation: () => Promise<T>,
    timeout: number,
    bypassLimits: boolean
  ): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      const startTime = Date.now();
      const operationPromise = this.wrapWithTimeout(operation, timeout);

      // Store operation with metadata
      this.activeOperations.set(operationId, {
        promise: operationPromise,
        startTime,
        timeout,
        resolve,
        reject
      });

      this.recordOperation(operationId);

      // Handle promise completion
      operationPromise
        .then((result) => {
          // Remove from active operations
          this.activeOperations.delete(operationId);

          // Success - reset circuit breaker failures
          if (this.circuitBreakerFailures > 0) {
            this.circuitBreakerFailures = Math.max(0, this.circuitBreakerFailures - 1);
          }

          resolve(result);
          this.processQueuedOperations();
        })
        .catch((error) => {
          // Remove from active operations
          this.activeOperations.delete(operationId);

          this.handleOperationFailure(operationId, error as Error, bypassLimits);
          reject(error);
          this.processQueuedOperations();
        });
    });
  }

  private queueOperation<T>(
    operationId: string,
    operation: () => Promise<T>,
    priority: number,
    timeout: number
  ): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      this.operationQueue.push({
        id: operationId,
        operation: operation as () => Promise<any>,
        resolve,
        reject,
        priority,
        queuedTime: Date.now()
      });

      // Sort by priority (higher priority first)
      this.operationQueue.sort((a, b) => b.priority - a.priority);

      logger.debug('Operation queued', { operationId, queueLength: this.operationQueue.length });
    });
  }

  private async processQueuedOperations(): Promise<void> {
    while (
      this.operationQueue.length > 0 &&
      this.activeOperations.size < LIMITS.MAX_CONCURRENT_OPERATIONS
    ) {
      const queuedOp = this.operationQueue.shift()!;
      this.runOperation(queuedOp.id, queuedOp.operation, 30000, false)
        .then(queuedOp.resolve)
        .catch(queuedOp.reject);
    }
  }

  private wrapWithTimeout<T>(operation: () => Promise<T>, timeout: number): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      const timeoutId = setTimeout(() => {
        reject(new Error(ERROR_MESSAGES.OPERATION_TIMEOUT('operation', timeout)));
      }, timeout);

      operation()
        .then((result) => {
          clearTimeout(timeoutId);
          resolve(result);
        })
        .catch((error) => {
          clearTimeout(timeoutId);
          reject(error);
        });
    });
  }

  private recordOperation(operationId: string): void {
    // Extract operation type from ID
    const operationType = operationId.split('_')[0] || 'unknown';
    const count = this.operationCounts.get(operationType) || 0;
    this.operationCounts.set(operationType, count + 1);

    // Reset counters every minute
    if (Date.now() - this.lastResetTime > 60000) {
      this.operationCounts.clear();
      this.lastResetTime = Date.now();
    }
  }

  private checkRateLimits(operationId: string): void {
    const totalOps = Array.from(this.operationCounts.values()).reduce((a, b) => a + b, 0);
    const timeSinceReset = (Date.now() - this.lastResetTime) / 1000;
    const opsPerSecond = timeSinceReset > 0 ? totalOps / timeSinceReset : 0;

    if (opsPerSecond > LIMITS.MAX_OPERATIONS_PER_SECOND) {
      logger.warn('Rate limit exceeded', {
        current: opsPerSecond.toFixed(1),
        max: LIMITS.MAX_OPERATIONS_PER_SECOND,
        operationId
      });
      throw new Error(ERROR_MESSAGES.RATE_LIMIT_EXCEEDED(opsPerSecond, LIMITS.MAX_OPERATIONS_PER_SECOND));
    }
  }

  private handleOperationFailure(operationId: string, error: Error, bypassLimits: boolean): void {
    if (bypassLimits) return;

    this.circuitBreakerFailures++;
    this.circuitBreakerLastFailure = Date.now();

    // Open circuit breaker if failure rate is too high
    const failureRate = this.circuitBreakerFailures / Math.max(1, this.activeOperations.size + this.operationQueue.length);
    if (failureRate > LIMITS.CIRCUIT_BREAKER_THRESHOLD) {
      this.circuitBreakerOpen = true;
      logger.warn(ERROR_MESSAGES.CIRCUIT_BREAKER_ACTIVATED(this.circuitBreakerFailures, LIMITS.CIRCUIT_BREAKER_THRESHOLD), {
        failureRate: failureRate.toFixed(2),
        failures: this.circuitBreakerFailures,
        operationId
      });
    }

    logger.warn('Operation failed - circuit breaker monitoring active', {
      operationId,
      error: error.message,
      circuitBreakerFailures: this.circuitBreakerFailures,
      circuitBreakerOpen: this.circuitBreakerOpen,
      failureRate: failureRate.toFixed(3)
    });
  }
}

// Global concurrency manager instance
export const globalConcurrencyManager = new ConcurrencyManager();
