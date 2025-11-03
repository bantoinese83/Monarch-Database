/**
 * Structured Logging System
 * 
 * Enterprise-grade logging with JSON output, log levels, and structured data
 */

export enum LogLevel {
  DEBUG = 'debug',
  INFO = 'info',
  WARN = 'warn',
  ERROR = 'error',
  FATAL = 'fatal'
}

export interface LogEntry {
  timestamp: string;
  level: LogLevel;
  message: string;
  context?: Record<string, any>;
  error?: {
    name: string;
    message: string;
    stack?: string;
  };
  traceId?: string;
  spanId?: string;
}

export interface LoggerConfig {
  level: LogLevel;
  format: 'json' | 'text';
  timestamp: boolean;
  includeStack: boolean;
  destination?: 'console' | 'file' | 'both';
  filePath?: string;
}

const DEFAULT_CONFIG: LoggerConfig = {
  level: LogLevel.INFO,
  format: process.env.MONARCH_LOG_FORMAT === 'json' ? 'json' : 'text',
  timestamp: true,
  includeStack: false,
  destination: 'console'
};

class Logger {
  private config: LoggerConfig;
  private logLevels: Record<LogLevel, number> = {
    debug: 0,
    info: 1,
    warn: 2,
    error: 3,
    fatal: 4
  };

  constructor(config?: Partial<LoggerConfig>) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    
    // Override with environment variables
    if (process.env.MONARCH_LOG_LEVEL) {
      this.config.level = process.env.MONARCH_LOG_LEVEL as LogLevel || LogLevel.INFO;
    }
  }

  private shouldLog(level: LogLevel): boolean {
    return this.logLevels[level] >= this.logLevels[this.config.level];
  }

  private formatLog(level: LogLevel, message: string, context?: Record<string, any>, error?: Error): string {
    const entry: LogEntry = {
      timestamp: new Date().toISOString(),
      level,
      message,
      ...(context && { context }),
      ...(error && {
        error: {
          name: error.name,
          message: error.message,
          ...(this.config.includeStack && error.stack && { stack: error.stack })
        }
      })
    };

    if (this.config.format === 'json') {
      return JSON.stringify(entry);
    }

    // Text format
    const timestamp = this.config.timestamp ? `[${entry.timestamp}]` : '';
    const levelStr = level.toUpperCase().padEnd(5);
    const contextStr = context ? ` ${JSON.stringify(context)}` : '';
    const errorStr = error ? ` Error: ${error.message}` : '';
    
    return `${timestamp} [${levelStr}] ${message}${contextStr}${errorStr}`;
  }

  private writeLog(level: LogLevel, message: string, context?: Record<string, any>, error?: Error): void {
    if (!this.shouldLog(level)) return;

    const formatted = this.formatLog(level, message, context, error);

    switch (level) {
      case LogLevel.DEBUG:
      case LogLevel.INFO:
        console.log(formatted);
        break;
      case LogLevel.WARN:
        console.warn(formatted);
        break;
      case LogLevel.ERROR:
      case LogLevel.FATAL:
        console.error(formatted);
        break;
    }
  }

  debug(message: string, context?: Record<string, any>): void {
    this.writeLog(LogLevel.DEBUG, message, context);
  }

  info(message: string, context?: Record<string, any>): void {
    this.writeLog(LogLevel.INFO, message, context);
  }

  warn(message: string, context?: Record<string, any>, error?: Error): void {
    this.writeLog(LogLevel.WARN, message, context, error);
  }

  error(message: string, context?: Record<string, any>, error?: Error): void {
    this.writeLog(LogLevel.ERROR, message, context, error);
  }

  fatal(message: string, context?: Record<string, any>, error?: Error): void {
    this.writeLog(LogLevel.FATAL, message, context, error);
  }

  setLevel(level: LogLevel): void {
    this.config.level = level;
  }

  getConfig(): LoggerConfig {
    return { ...this.config };
  }
}

// Global logger instance
export const logger = new Logger();

// Export singleton

