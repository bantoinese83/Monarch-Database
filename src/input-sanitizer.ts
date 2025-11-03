/**
 * Input Sanitization System
 * 
 * Provides protection against injection attacks, XSS, and malicious input
 */

import { logger } from './logger';

export interface SanitizationOptions {
  maxDepth?: number;
  maxLength?: number;
  allowedPatterns?: RegExp[];
  blockPatterns?: RegExp[];
}

export class InputSanitizer {
  private options: Required<SanitizationOptions>;

  constructor(options: SanitizationOptions = {}) {
    this.options = {
      maxDepth: options.maxDepth || 10,
      maxLength: options.maxLength || 1000000, // 1MB
      allowedPatterns: options.allowedPatterns || [],
      blockPatterns: options.blockPatterns || this.getDefaultBlockPatterns()
    };
  }

  /**
   * Sanitize a query object
   */
  sanitizeQuery(query: any, depth: number = 0): any {
    if (depth > this.options.maxDepth) {
      logger.warn('Query depth exceeded maximum', { depth, maxDepth: this.options.maxDepth });
      throw new Error('Query depth exceeds maximum allowed');
    }

    if (query === null || query === undefined) {
      return query;
    }

    // Check for dangerous patterns in string values
    if (typeof query === 'string') {
      return this.sanitizeString(query);
    }

    if (Array.isArray(query)) {
      return query.map(item => this.sanitizeQuery(item, depth + 1));
    }

    if (typeof query === 'object') {
      const sanitized: Record<string, any> = {};
      for (const [key, value] of Object.entries(query)) {
        // Sanitize key
        const sanitizedKey = this.sanitizeString(key);
        
        // Check key length
        if (sanitizedKey.length > 255) {
          logger.warn('Query key exceeds maximum length', { key: sanitizedKey.substring(0, 50) });
          continue;
        }

        // Sanitize value
        sanitized[sanitizedKey] = this.sanitizeQuery(value, depth + 1);
      }
      return sanitized;
    }

    return query;
  }

  /**
   * Sanitize a string value
   */
  sanitizeString(value: string): string {
    if (typeof value !== 'string') {
      return value;
    }

    // Check length
    if (value.length > this.options.maxLength) {
      logger.warn('String exceeds maximum length', { length: value.length, maxLength: this.options.maxLength });
      throw new Error('Input string exceeds maximum length');
    }

    // Check for blocked patterns
    for (const pattern of this.options.blockPatterns) {
      if (pattern.test(value)) {
        logger.warn('Blocked pattern detected in input', { pattern: pattern.toString() });
        throw new Error('Input contains blocked pattern');
      }
    }

    // Remove null bytes
    let sanitized = value.replace(/\0/g, '');

    // Remove potentially dangerous characters
    // eslint-disable-next-line no-control-regex
    sanitized = sanitized.replace(/[\x00-\x1F\x7F]/g, '');

    return sanitized;
  }

  /**
   * Validate and sanitize a field name
   */
  validateFieldName(fieldName: string): string {
    if (typeof fieldName !== 'string') {
      throw new Error('Field name must be a string');
    }

    // Check length
    if (fieldName.length > 255) {
      throw new Error('Field name exceeds maximum length (255 characters)');
    }

    // Check for invalid characters
    if (!/^[a-zA-Z_][a-zA-Z0-9_.]*$/.test(fieldName)) {
      throw new Error('Field name contains invalid characters');
    }

    return this.sanitizeString(fieldName);
  }

  /**
   * Get default block patterns for common attacks
   */
  private getDefaultBlockPatterns(): RegExp[] {
    return [
      // SQL injection patterns
      /(\b(SELECT|INSERT|UPDATE|DELETE|DROP|CREATE|ALTER|EXEC|EXECUTE)\b)/i,
      /(--|;|\/\*|\*\/|xp_|sp_)/i,
      
      // XSS patterns
      /<script[^>]*>.*?<\/script>/gi,
      /javascript:/i,
      /on\w+\s*=/i,
      
      // Command injection patterns
      /[;&|`$(){}[\]]/,
      /\$\{/,
      /\$\(/,
      
      // Path traversal
      /\.\.\//,
      /\.\.\\/,
      
      // Null bytes
      /\0/
    ];
  }

  /**
   * Check if a value contains malicious patterns
   */
  isSuspicious(value: any): boolean {
    if (typeof value === 'string') {
      for (const pattern of this.options.blockPatterns) {
        if (pattern.test(value)) {
          return true;
        }
      }
    } else if (typeof value === 'object' && value !== null) {
      try {
        const jsonString = JSON.stringify(value);
        for (const pattern of this.options.blockPatterns) {
          if (pattern.test(jsonString)) {
            return true;
          }
        }
      } catch {
        // If we can't stringify, consider it suspicious
        return true;
      }
    }
    return false;
  }
}

// Default sanitizer instance
export const defaultSanitizer = new InputSanitizer();

