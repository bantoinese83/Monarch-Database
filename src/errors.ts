/**
 * Centralized Error Handling System
 *
 * Provides consistent error types, logging, and handling strategies
 * across the entire Monarch database system.
 */

/**
 * Error severity levels
 */
export enum ErrorSeverity {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
  CRITICAL = 'critical'
}

/**
 * Error categories for better classification
 */
export enum ErrorCategory {
  VALIDATION = 'validation',
  SECURITY = 'security',
  PERFORMANCE = 'performance',
  CONNECTIVITY = 'connectivity',
  DATA_INTEGRITY = 'data_integrity',
  RESOURCE_LIMIT = 'resource_limit',
  CONFIGURATION = 'configuration',
  INTERNAL = 'internal'
}

/**
 * Base Monarch error class
 */
export class MonarchError extends Error {
  public readonly category: ErrorCategory;
  public readonly severity: ErrorSeverity;
  public readonly code: string;
  public readonly timestamp: number;
  public readonly context?: Record<string, any>;

  constructor(
    message: string,
    category: ErrorCategory = ErrorCategory.INTERNAL,
    severity: ErrorSeverity = ErrorSeverity.MEDIUM,
    code: string = 'MONARCH_ERROR',
    context?: Record<string, any>
  ) {
    super(message);
    this.name = 'MonarchError';
    this.category = category;
    this.severity = severity;
    this.code = code;
    this.timestamp = Date.now();
    this.context = context;
  }
}

/**
 * Specific error types for different scenarios
 */
export class ValidationError extends MonarchError {
  constructor(message: string, field?: string, value?: any) {
    super(
      message,
      ErrorCategory.VALIDATION,
      ErrorSeverity.LOW,
      'VALIDATION_ERROR',
      { field, value }
    );
    this.name = 'ValidationError';
  }
}

export class SecurityError extends MonarchError {
  constructor(message: string, user?: string, permission?: string) {
    super(
      message,
      ErrorCategory.SECURITY,
      ErrorSeverity.HIGH,
      'SECURITY_ERROR',
      { user, permission }
    );
    this.name = 'SecurityError';
  }
}

export class PerformanceError extends MonarchError {
  constructor(message: string, operation?: string, duration?: number) {
    super(
      message,
      ErrorCategory.PERFORMANCE,
      ErrorSeverity.MEDIUM,
      'PERFORMANCE_ERROR',
      { operation, duration }
    );
    this.name = 'PerformanceError';
  }
}

export class ConnectivityError extends MonarchError {
  constructor(message: string, host?: string, port?: number) {
    super(
      message,
      ErrorCategory.CONNECTIVITY,
      ErrorSeverity.HIGH,
      'CONNECTIVITY_ERROR',
      { host, port }
    );
    this.name = 'ConnectivityError';
  }
}

export class DataIntegrityError extends MonarchError {
  constructor(message: string, collection?: string, documentId?: string) {
    super(
      message,
      ErrorCategory.DATA_INTEGRITY,
      ErrorSeverity.CRITICAL,
      'DATA_INTEGRITY_ERROR',
      { collection, documentId }
    );
    this.name = 'DataIntegrityError';
  }
}

export class ResourceLimitError extends MonarchError {
  constructor(message: string, resource?: string, limit?: number, current?: number) {
    super(
      message,
      ErrorCategory.RESOURCE_LIMIT,
      ErrorSeverity.MEDIUM,
      'RESOURCE_LIMIT_ERROR',
      { resource, limit, current }
    );
    this.name = 'ResourceLimitError';
  }
}

export class ConfigurationError extends MonarchError {
  constructor(message: string, configKey?: string, invalidValue?: any) {
    super(
      message,
      ErrorCategory.CONFIGURATION,
      ErrorSeverity.HIGH,
      'CONFIGURATION_ERROR',
      { configKey, invalidValue }
    );
    this.name = 'ConfigurationError';
  }
}

/**
 * Error logger with structured logging
 */
export class ErrorLogger {
  private static instance: ErrorLogger;
  private logs: MonarchError[] = [];
  private maxLogs = 1000;

  private constructor() {}

  static getInstance(): ErrorLogger {
    if (!ErrorLogger.instance) {
      ErrorLogger.instance = new ErrorLogger();
    }
    return ErrorLogger.instance;
  }

  /**
   * Log an error with structured information
   */
  log(error: MonarchError): void {
    // Add to in-memory log
    this.logs.push(error);

    // Trim old logs if necessary
    if (this.logs.length > this.maxLogs) {
      this.logs = this.logs.slice(-this.maxLogs);
    }

    // Console logging based on severity
    const logMessage = this.formatLogMessage(error);

    switch (error.severity) {
      case ErrorSeverity.CRITICAL:
        console.error(`🚨 ${logMessage}`);
        break;
      case ErrorSeverity.HIGH:
        console.error(`❌ ${logMessage}`);
        break;
      case ErrorSeverity.MEDIUM:
        console.warn(`⚠️ ${logMessage}`);
        break;
      case ErrorSeverity.LOW:
        console.info(`ℹ️ ${logMessage}`);
        break;
    }
  }

  /**
   * Get recent errors by category
   */
  getErrorsByCategory(category: ErrorCategory, limit = 10): MonarchError[] {
    return this.logs
      .filter(error => error.category === category)
      .slice(-limit);
  }

  /**
   * Get recent errors by severity
   */
  getErrorsBySeverity(severity: ErrorSeverity, limit = 10): MonarchError[] {
    return this.logs
      .filter(error => error.severity === severity)
      .slice(-limit);
  }

  /**
   * Get error statistics
   */
  getErrorStats(): Record<ErrorCategory, Record<ErrorSeverity, number>> {
    const stats: Record<ErrorCategory, Record<ErrorSeverity, number>> = {} as any;

    // Initialize all categories and severities
    Object.values(ErrorCategory).forEach(category => {
      stats[category] = {} as any;
      Object.values(ErrorSeverity).forEach(severity => {
        stats[category][severity] = 0;
      });
    });

    // Count errors
    this.logs.forEach(error => {
      stats[error.category][error.severity]++;
    });

    return stats;
  }

  /**
   * Clear old logs
   */
  clearOldLogs(olderThanMs: number): number {
    const cutoffTime = Date.now() - olderThanMs;
    const initialLength = this.logs.length;
    this.logs = this.logs.filter(error => error.timestamp > cutoffTime);
    return initialLength - this.logs.length;
  }

  private formatLogMessage(error: MonarchError): string {
    const timestamp = new Date(error.timestamp).toISOString();
    const contextStr = error.context ? ` | Context: ${JSON.stringify(error.context)}` : '';
    return `[${timestamp}] ${error.code}: ${error.message}${contextStr}`;
  }
}

/**
 * Error handler with recovery strategies
 */
export class ErrorHandler {
  private static logger = ErrorLogger.getInstance();

  /**
   * Handle an error with appropriate recovery strategy
   */
  static handle(error: Error | MonarchError, context?: Record<string, any>): Error | MonarchError {
    // Convert to MonarchError if needed
    const monarchError = error instanceof MonarchError ? error : new MonarchError(
      error.message,
      ErrorCategory.INTERNAL,
      ErrorSeverity.MEDIUM,
      'GENERIC_ERROR',
      { ...context, originalError: error.name }
    );

    // Log the error
    this.logger.log(monarchError);

    // Apply recovery strategies based on error type
    switch (monarchError.category) {
      case ErrorCategory.VALIDATION:
        return this.handleValidationError(monarchError);
      case ErrorCategory.SECURITY:
        return this.handleSecurityError(monarchError);
      case ErrorCategory.PERFORMANCE:
        return this.handlePerformanceError(monarchError);
      case ErrorCategory.CONNECTIVITY:
        return this.handleConnectivityError(monarchError);
      case ErrorCategory.DATA_INTEGRITY:
        return this.handleDataIntegrityError(monarchError);
      case ErrorCategory.RESOURCE_LIMIT:
        return this.handleResourceLimitError(monarchError);
      default:
        return monarchError;
    }
  }

  /**
   * Create a user-friendly error message
   */
  static createUserMessage(error: MonarchError): string {
    switch (error.category) {
      case ErrorCategory.VALIDATION:
        return `Invalid input: ${error.message}`;
      case ErrorCategory.SECURITY:
        return `Access denied: ${error.message}`;
      case ErrorCategory.PERFORMANCE:
        return `Operation timed out: ${error.message}`;
      case ErrorCategory.CONNECTIVITY:
        return `Connection error: ${error.message}`;
      case ErrorCategory.DATA_INTEGRITY:
        return `Data consistency error: ${error.message}`;
      case ErrorCategory.RESOURCE_LIMIT:
        return `Resource limit exceeded: ${error.message}`;
      case ErrorCategory.CONFIGURATION:
        return `Configuration error: ${error.message}`;
      default:
        return `An error occurred: ${error.message}`;
    }
  }

  private static handleValidationError(error: MonarchError): MonarchError {
    // Validation errors are usually user input issues - log but don't modify
    return error;
  }

  private static handleSecurityError(error: MonarchError): MonarchError {
    // Security errors should be logged with high priority
    // Could trigger additional security measures here
    return error;
  }

  private static handlePerformanceError(error: MonarchError): MonarchError {
    // Performance errors might indicate system issues
    // Could trigger performance monitoring alerts
    return error;
  }

  private static handleConnectivityError(error: MonarchError): MonarchError {
    // Connectivity errors might benefit from retry logic
    // Could implement exponential backoff here
    return error;
  }

  private static handleDataIntegrityError(error: MonarchError): MonarchError {
    // Data integrity errors are critical and should trigger alerts
    // Could initiate data repair procedures
    return error;
  }

  private static handleResourceLimitError(error: MonarchError): MonarchError {
    // Resource limit errors indicate system stress
    // Could trigger auto-scaling or resource cleanup
    return error;
  }
}

/**
 * Utility functions for error handling
 */
export const errorUtils = {
  /**
   * Safely execute a function with error handling
   */
  safeExecute: async <T>(
    fn: () => Promise<T> | T,
    context?: Record<string, any>
  ): Promise<T | null> => {
    try {
      return await fn();
    } catch (error) {
      ErrorHandler.handle(error as Error, context);
      return null;
    }
  },

  /**
   * Wrap a function to provide consistent error handling
   */
  withErrorHandling: <T extends any[], R>(
    fn: (...args: T) => Promise<R> | R,
    errorCategory: ErrorCategory = ErrorCategory.INTERNAL,
    errorSeverity: ErrorSeverity = ErrorSeverity.MEDIUM
  ) => {
    return async (...args: T): Promise<R> => {
      try {
        return await fn(...args);
      } catch (error) {
        if (error instanceof MonarchError) {
          throw error;
        }
        throw new MonarchError(
          (error as Error).message,
          errorCategory,
          errorSeverity,
          'WRAPPED_ERROR',
          { originalError: (error as Error).name }
        );
      }
    };
  },

  /**
   * Assert a condition and throw a validation error if false
   */
  assert: (condition: boolean, message: string, field?: string, value?: any): void => {
    if (!condition) {
      throw new ValidationError(message, field, value);
    }
  },

  /**
   * Assert resource limits
   */
  assertLimit: (current: number, limit: number, resource: string): void => {
    if (current > limit) {
      throw new ResourceLimitError(
        `${resource} limit exceeded`,
        resource,
        limit,
        current
      );
    }
  }
};
