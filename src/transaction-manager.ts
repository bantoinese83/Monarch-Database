import {
  Transaction,
  TransactionOptions,
  TransactionOperation,
  ChangeEvent
} from './types';
import { generateId } from './utils';
import { ValidationError, ResourceLimitError } from './errors';
import { ERROR_MESSAGES } from './constants';
import { LIMITS } from './constants';

/**
 * Transaction Manager Factory Interface
 * Allows dependency injection of transaction managers
 */
export interface TransactionManagerFactory {
  create(): TransactionManager;
}

export class TransactionManager {
  private activeTransactions = new Map<string, Transaction>();
  private transactionTimeout: number;
  private maxConcurrentTransactions: number;
  private cleanupInterval?: NodeJS.Timeout;

  constructor(
    timeout: number = 30000, // 30 seconds default
    maxConcurrent: number = 10,
    private scheduler: { setInterval: typeof setInterval; clearInterval: typeof clearInterval } = {
      setInterval: globalThis.setInterval.bind(globalThis),
      clearInterval: globalThis.clearInterval.bind(globalThis)
    }
  ) {
    this.transactionTimeout = timeout;
    this.maxConcurrentTransactions = maxConcurrent;
    
    // Clean up timed-out transactions periodically
    // Made explicit and injectable to minimize side effects
    this.startCleanupScheduler();
  }

  /**
   * Start the cleanup scheduler
   * Separated to make side effects explicit
   */
  private startCleanupScheduler(): void {
    this.cleanupInterval = this.scheduler.setInterval(
      () => this.cleanupTimedOutTransactions(),
      5000
    );
  }

  /**
   * Stop the cleanup scheduler
   * Allows cleanup when manager is destroyed
   */
  stopCleanupScheduler(): void {
    if (this.cleanupInterval) {
      this.scheduler.clearInterval(this.cleanupInterval);
      this.cleanupInterval = undefined;
    }
  }

  /**
   * Begin a new transaction
   */
  begin(options: TransactionOptions = {}): string {
    if (this.activeTransactions.size >= this.maxConcurrentTransactions) {
      throw new ResourceLimitError(
        ERROR_MESSAGES.TRANSACTION_MAX_EXCEEDED,
        'transactions',
        this.maxConcurrentTransactions,
        this.activeTransactions.size + 1
      );
    }

    const transactionId = generateId();
    const transaction: Transaction = {
      id: transactionId,
      operations: [],
      status: 'active',
      startTime: Date.now(),
      options: {
        isolation: 'read-committed',
        timeout: this.transactionTimeout,
        ...options
      }
    };

    this.activeTransactions.set(transactionId, transaction);
    return transactionId;
  }

  /**
   * Add an operation to a transaction
   */
  addOperation(
    transactionId: string,
    type: 'insert' | 'update' | 'remove',
    collection: string,
    data: any
  ): void {
    const transaction = this.activeTransactions.get(transactionId);
    if (!transaction) {
      throw new ValidationError(
        ERROR_MESSAGES.TRANSACTION_NOT_FOUND(transactionId),
        'transactionId',
        transactionId
      );
    }

    if (transaction.status !== 'active') {
      throw new ValidationError(
        ERROR_MESSAGES.TRANSACTION_NOT_ACTIVE(transactionId),
        'transactionStatus',
        transaction.status
      );
    }

    // Check timeout
    if (Date.now() - transaction.startTime > (transaction.options.timeout || this.transactionTimeout)) {
      transaction.status = 'failed';
      throw new ValidationError(
        ERROR_MESSAGES.TRANSACTION_TIMEOUT(transactionId),
        'transactionTimeout',
        transaction.options.timeout || this.transactionTimeout
      );
    }

    const operation: TransactionOperation = {
      type,
      collection,
      data,
      timestamp: Date.now()
    };

    transaction.operations.push(operation);
  }

  /**
   * Commit a transaction
   */
  commit(transactionId: string): TransactionOperation[] {
    const transaction = this.activeTransactions.get(transactionId);
    if (!transaction) {
      throw new ValidationError(
        ERROR_MESSAGES.TRANSACTION_NOT_FOUND(transactionId),
        'transactionId',
        transactionId
      );
    }

    if (transaction.status !== 'active') {
      throw new ValidationError(
        ERROR_MESSAGES.TRANSACTION_NOT_ACTIVE(transactionId),
        'transactionStatus',
        transaction.status
      );
    }

    transaction.status = 'committed';
    this.activeTransactions.delete(transactionId);

    return transaction.operations;
  }

  /**
   * Rollback a transaction
   */
  rollback(transactionId: string): void {
    const transaction = this.activeTransactions.get(transactionId);
    if (!transaction) {
      throw new ValidationError(
        ERROR_MESSAGES.TRANSACTION_NOT_FOUND(transactionId),
        'transactionId',
        transactionId
      );
    }

    transaction.status = 'rolled-back';
    this.activeTransactions.delete(transactionId);
  }

  /**
   * Get transaction status
   */
  getTransaction(transactionId: string): Transaction | undefined {
    return this.activeTransactions.get(transactionId);
  }

  /**
   * Get all active transactions
   */
  getActiveTransactions(): Transaction[] {
    return Array.from(this.activeTransactions.values());
  }

  /**
   * Force cleanup of timed-out transactions
   */
  private cleanupTimedOutTransactions(): void {
    const now = Date.now();
    const timedOutIds: string[] = [];

    for (const [id, transaction] of this.activeTransactions) {
      const timeout = transaction.options.timeout || this.transactionTimeout;
      if (now - transaction.startTime > timeout && transaction.status === 'active') {
        timedOutIds.push(id);
      }
    }

    for (const id of timedOutIds) {
      const transaction = this.activeTransactions.get(id);
      if (transaction) {
        transaction.status = 'failed';
        this.activeTransactions.delete(id);
      }
    }
  }

  /**
   * Get statistics about transactions
   * 
   * Note: Historical stats (totalProcessed, averageDuration) are not yet implemented.
   * This method returns only current active transaction count.
   * 
   * @returns Transaction statistics
   */
  getStats(): {
    active: number;
    totalProcessed: number;
    averageDuration: number;
  } {
    const active = this.activeTransactions.size;
    // Historical tracking would require additional infrastructure (metrics storage)
    // Following YAGNI: only implement if actually needed
    return {
      active,
      totalProcessed: 0, // Not tracked - add metrics storage if needed
      averageDuration: 0 // Not tracked - add metrics storage if needed
    };
  }
}
