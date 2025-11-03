/**
 * HTTP Server Wrapper
 * 
 * Provides HTTP endpoints for health checks, metrics, and monitoring
 * This is optional - Monarch works as a library, but this enables server mode
 */

import http from 'http';
import { logger } from './logger';
import { healthChecker } from './health-check';
import { RateLimiter } from './rate-limiter';

export interface ServerConfig {
  port: number;
  host?: string;
  enableHealth?: boolean;
  enableMetrics?: boolean;
  enableReadiness?: boolean;
}

const DEFAULT_CONFIG: ServerConfig = {
  port: parseInt(process.env.MONARCH_PORT || '7331', 10),
  host: process.env.MONARCH_HOST || '0.0.0.0',
  enableHealth: true,
  enableMetrics: true,
  enableReadiness: true
};

export class HTTPServer {
  private server: http.Server | null = null;
  private config: ServerConfig;
  private rateLimiter?: RateLimiter;

  constructor(config?: Partial<ServerConfig>) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * Start the HTTP server
   */
  start(): Promise<void> {
    return new Promise((resolve, reject) => {
      if (this.server) {
        reject(new Error('Server is already running'));
        return;
      }

      this.server = http.createServer((req, res) => {
        this.handleRequest(req, res);
      });

      this.server.listen(this.config.port, this.config.host, () => {
        logger.info('HTTP server started', {
          port: this.config.port,
          host: this.config.host
        });
        resolve();
      });

      this.server.on('error', (error: Error) => {
        logger.error('HTTP server error', {}, error);
        reject(error);
      });
    });
  }

  /**
   * Stop the HTTP server
   */
  stop(): Promise<void> {
    return new Promise((resolve, reject) => {
      if (!this.server) {
        resolve();
        return;
      }

      this.server.close((error) => {
        if (error) {
          logger.error('Error stopping HTTP server', {}, error);
          reject(error);
        } else {
          logger.info('HTTP server stopped');
          this.server = null;
          resolve();
        }
      });
    });
  }

  private handleRequest(req: http.IncomingMessage, res: http.ServerResponse): void {
    const url = req.url || '/';
    const method = req.method || 'GET';

    // Get client IP for rate limiting
    const clientIP = this.getClientIP(req);

    // Apply rate limiting (except for health checks)
    if (this.rateLimiter && !url.startsWith('/health') && !url.startsWith('/live')) {
      const limitResult = this.rateLimiter.check(clientIP);
      if (!limitResult.allowed) {
        res.writeHead(429, {
          'Content-Type': 'application/json',
          'Retry-After': limitResult.retryAfter?.toString() || '60'
        });
        res.end(JSON.stringify({
          error: 'Rate limit exceeded',
          retryAfter: limitResult.retryAfter
        }));
        return;
      }
    }

    // CORS headers
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (method === 'OPTIONS') {
      res.writeHead(200);
      res.end();
      return;
    }

    try {
      // Health endpoint
      if (this.config.enableHealth && url === '/health') {
        const health = healthChecker.getHealth();
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(health, null, 2));
        return;
      }

      // Readiness endpoint
      if (this.config.enableReadiness && url === '/ready') {
        const readiness = healthChecker.getReadiness();
        const statusCode = readiness.ready ? 200 : 503;
        res.writeHead(statusCode, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(readiness, null, 2));
        return;
      }

      // Liveness endpoint
      if (url === '/live') {
        const liveness = healthChecker.getLiveness();
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(liveness, null, 2));
        return;
      }

      // Metrics endpoint (Prometheus format)
      if (this.config.enableMetrics && url === '/metrics') {
        const metrics = healthChecker.getMetrics();
        res.writeHead(200, { 'Content-Type': 'text/plain; version=0.0.4' });
        res.end(metrics);
        return;
      }

      // Root endpoint
      if (url === '/') {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
          service: 'Monarch Database',
          version: process.env.npm_package_version || '1.0.0',
          endpoints: {
            health: '/health',
            readiness: '/ready',
            liveness: '/live',
            metrics: '/metrics'
          }
        }, null, 2));
        return;
      }

      // 404
      res.writeHead(404, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Not Found' }));
    } catch (error) {
      logger.error('Error handling HTTP request', { url, method }, error as Error);
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Internal Server Error' }));
    }
  }

  getPort(): number {
    return this.config.port;
  }

  isRunning(): boolean {
    return this.server !== null;
  }

  /**
   * Enable rate limiting
   */
  enableRateLimiting(config?: { windowMs: number; maxRequests: number; blockDuration?: number }): void {
    this.rateLimiter = new RateLimiter(config || {
      windowMs: 60000,
      maxRequests: 100,
      blockDuration: 60000
    });
    logger.info('Rate limiting enabled', { config });
  }

  private getClientIP(req: http.IncomingMessage): string {
    const forwarded = req.headers['x-forwarded-for'];
    if (forwarded) {
      return Array.isArray(forwarded) ? forwarded[0] : forwarded.split(',')[0].trim();
    }
    return req.socket.remoteAddress || 'unknown';
  }
}


