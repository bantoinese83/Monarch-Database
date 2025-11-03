/**
 * Rate Limiting System
 * 
 * Provides request rate limiting, IP-based throttling, and quota management
 */

import { logger } from './logger';

export interface RateLimitConfig {
  windowMs: number; // Time window in milliseconds
  maxRequests: number; // Maximum requests per window
  blockDuration?: number; // Duration to block after limit exceeded (ms)
}

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetTime: number;
  retryAfter?: number;
}

class RateLimitEntry {
  count: number = 0;
  windowStart: number = Date.now();
  blockedUntil?: number;
}

export class RateLimiter {
  private entries = new Map<string, RateLimitEntry>();
  private config: RateLimitConfig;
  private cleanupInterval: NodeJS.Timeout;

  constructor(config: RateLimitConfig) {
    this.config = config;
    
    // Cleanup old entries every 5 minutes
    this.cleanupInterval = setInterval(() => {
      this.cleanup();
    }, 5 * 60 * 1000);
  }

  /**
   * Check if a request should be allowed
   */
  check(identifier: string): RateLimitResult {
    const now = Date.now();
    let entry = this.entries.get(identifier);

    if (!entry) {
      entry = new RateLimitEntry();
      this.entries.set(identifier, entry);
    }

    // Check if blocked
    if (entry.blockedUntil && now < entry.blockedUntil) {
      const retryAfter = Math.ceil((entry.blockedUntil - now) / 1000);
      logger.warn('Rate limit exceeded, request blocked', { identifier, retryAfter });
      return {
        allowed: false,
        remaining: 0,
        resetTime: entry.blockedUntil,
        retryAfter
      };
    }

    // Reset window if expired
    if (now - entry.windowStart >= this.config.windowMs) {
      entry.count = 0;
      entry.windowStart = now;
      entry.blockedUntil = undefined;
    }

    // Check limit
    if (entry.count >= this.config.maxRequests) {
      // Block if configured
      if (this.config.blockDuration) {
        entry.blockedUntil = now + this.config.blockDuration;
      }

      const resetTime = entry.windowStart + this.config.windowMs;
      logger.warn('Rate limit exceeded', { identifier, count: entry.count, limit: this.config.maxRequests });
      
      return {
        allowed: false,
        remaining: 0,
        resetTime,
        retryAfter: this.config.blockDuration ? Math.ceil(this.config.blockDuration / 1000) : undefined
      };
    }

    // Allow request
    entry.count++;
    const remaining = this.config.maxRequests - entry.count;
    const resetTime = entry.windowStart + this.config.windowMs;

    return {
      allowed: true,
      remaining,
      resetTime
    };
  }

  /**
   * Reset rate limit for an identifier
   */
  reset(identifier: string): void {
    this.entries.delete(identifier);
    logger.debug('Rate limit reset', { identifier });
  }

  /**
   * Get current rate limit status
   */
  getStatus(identifier: string): RateLimitResult | null {
    const entry = this.entries.get(identifier);
    if (!entry) {
      return null;
    }

    const now = Date.now();
    if (entry.windowStart + this.config.windowMs < now) {
      return null; // Window expired
    }

    const remaining = Math.max(0, this.config.maxRequests - entry.count);
    const resetTime = entry.windowStart + this.config.windowMs;

    return {
      allowed: remaining > 0,
      remaining,
      resetTime,
      retryAfter: entry.blockedUntil && entry.blockedUntil > now 
        ? Math.ceil((entry.blockedUntil - now) / 1000) 
        : undefined
    };
  }

  /**
   * Clean up old entries
   */
  private cleanup(): void {
    const now = Date.now();
    const expired: string[] = [];

    for (const [identifier, entry] of this.entries) {
      const windowExpired = now - entry.windowStart >= this.config.windowMs;
      const blockExpired = !entry.blockedUntil || now >= entry.blockedUntil;

      if (windowExpired && blockExpired) {
        expired.push(identifier);
      }
    }

    for (const identifier of expired) {
      this.entries.delete(identifier);
    }

    if (expired.length > 0) {
      logger.debug('Cleaned up rate limit entries', { count: expired.length });
    }
  }

  /**
   * Destroy the rate limiter (cleanup)
   */
  destroy(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
    }
    this.entries.clear();
  }
}

// Default rate limiter instance
export const defaultRateLimiter = new RateLimiter({
  windowMs: 60000, // 1 minute
  maxRequests: 100,
  blockDuration: 60000 // Block for 1 minute after limit exceeded
});

