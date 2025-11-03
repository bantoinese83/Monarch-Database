/**
 * Environment Variable Validation
 * 
 * Validates and provides type-safe access to environment variables
 */

import { logger } from './logger';

export interface EnvConfig {
  NODE_ENV: 'development' | 'production' | 'test';
  MONARCH_PORT: number;
  MONARCH_LOG_LEVEL: 'debug' | 'info' | 'warn' | 'error' | 'fatal';
  MONARCH_LOG_FORMAT: 'json' | 'text';
  MONARCH_DATA_DIR: string;
  MONARCH_MAX_CONCURRENT_OPERATIONS: number;
  MONARCH_OPERATION_TIMEOUT: number;
}

const requiredEnvVars: string[] = [];

const optionalEnvVars: Record<string, any> = {
  NODE_ENV: 'development',
  MONARCH_PORT: 7331,
  MONARCH_LOG_LEVEL: 'info',
  MONARCH_LOG_FORMAT: 'text',
  MONARCH_DATA_DIR: './data',
  MONARCH_MAX_CONCURRENT_OPERATIONS: 50,
  MONARCH_OPERATION_TIMEOUT: 30000
};

export class EnvValidator {
  private validated: Map<string, any> = new Map();
  private errors: string[] = [];

  /**
   * Validate all environment variables
   */
  validate(): { valid: boolean; errors: string[]; config: Partial<EnvConfig> } {
    this.errors = [];
    this.validated.clear();

    // Check required variables
    for (const envVar of requiredEnvVars) {
      if (!process.env[envVar]) {
        this.errors.push(`Required environment variable ${envVar} is not set`);
      }
    }

    // Validate and parse optional variables
    const config: Partial<EnvConfig> = {};

    // NODE_ENV
    const nodeEnv = process.env.NODE_ENV || optionalEnvVars.NODE_ENV;
    if (!['development', 'production', 'test'].includes(nodeEnv)) {
      this.errors.push(`NODE_ENV must be one of: development, production, test`);
    } else {
      config.NODE_ENV = nodeEnv as EnvConfig['NODE_ENV'];
    }

    // MONARCH_PORT
    const port = this.parseNumber('MONARCH_PORT', optionalEnvVars.MONARCH_PORT);
    if (port !== null) {
      if (port < 1 || port > 65535) {
        this.errors.push('MONARCH_PORT must be between 1 and 65535');
      } else {
        config.MONARCH_PORT = port;
      }
    }

    // MONARCH_LOG_LEVEL
    const logLevel = process.env.MONARCH_LOG_LEVEL || optionalEnvVars.MONARCH_LOG_LEVEL;
    if (!['debug', 'info', 'warn', 'error', 'fatal'].includes(logLevel)) {
      this.errors.push('MONARCH_LOG_LEVEL must be one of: debug, info, warn, error, fatal');
    } else {
      config.MONARCH_LOG_LEVEL = logLevel as EnvConfig['MONARCH_LOG_LEVEL'];
    }

    // MONARCH_LOG_FORMAT
    const logFormat = process.env.MONARCH_LOG_FORMAT || optionalEnvVars.MONARCH_LOG_FORMAT;
    if (!['json', 'text'].includes(logFormat)) {
      this.errors.push('MONARCH_LOG_FORMAT must be one of: json, text');
    } else {
      config.MONARCH_LOG_FORMAT = logFormat as EnvConfig['MONARCH_LOG_FORMAT'];
    }

    // MONARCH_DATA_DIR
    config.MONARCH_DATA_DIR = process.env.MONARCH_DATA_DIR || optionalEnvVars.MONARCH_DATA_DIR;

    // MONARCH_MAX_CONCURRENT_OPERATIONS
    const maxOps = this.parseNumber('MONARCH_MAX_CONCURRENT_OPERATIONS', optionalEnvVars.MONARCH_MAX_CONCURRENT_OPERATIONS);
    if (maxOps !== null && maxOps > 0) {
      config.MONARCH_MAX_CONCURRENT_OPERATIONS = maxOps;
    }

    // MONARCH_OPERATION_TIMEOUT
    const timeout = this.parseNumber('MONARCH_OPERATION_TIMEOUT', optionalEnvVars.MONARCH_OPERATION_TIMEOUT);
    if (timeout !== null && timeout > 0) {
      config.MONARCH_OPERATION_TIMEOUT = timeout;
    }

    if (this.errors.length > 0) {
      logger.warn('Environment validation failed', { errors: this.errors });
    } else {
      logger.info('Environment validation passed', { config });
    }

    return {
      valid: this.errors.length === 0,
      errors: [...this.errors],
      config
    };
  }

  /**
   * Get a validated environment variable
   */
  get(key: string): any {
    return this.validated.get(key) || process.env[key];
  }

  /**
   * Get all validated config
   */
  getConfig(): Partial<EnvConfig> {
    const result = this.validate();
    return result.config;
  }

  private parseNumber(key: string, defaultValue: number): number | null {
    const value = process.env[key];
    if (!value) return defaultValue;
    
    const parsed = parseInt(value, 10);
    if (isNaN(parsed)) {
      this.errors.push(`${key} must be a valid number`);
      return null;
    }
    return parsed;
  }
}

// Global validator instance
export const envValidator = new EnvValidator();

// Validate on import (can be disabled if needed)
if (typeof process !== 'undefined' && process.env.NODE_ENV !== 'test') {
  const validation = envValidator.validate();
  if (!validation.valid && validation.errors.length > 0) {
    logger.warn('Environment validation issues found', { errors: validation.errors });
  }
}

