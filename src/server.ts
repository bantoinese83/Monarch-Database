/**
 * Monarch Database Server Entry Point
 * 
 * Optional HTTP server mode for Monarch Database
 * This enables health checks, metrics, and monitoring endpoints
 */

import { HTTPServer } from './http-server';
import { logger } from './logger';
import { envValidator } from './env-validator';
import { isMainModule } from './utils';

async function main() {
  // Validate environment
  const validation = envValidator.validate();
  if (!validation.valid && validation.errors.length > 0) {
    logger.warn('Environment validation issues', { errors: validation.errors });
  }

  const config = validation.config;
  
  logger.info('Starting Monarch Database server', {
    port: config.MONARCH_PORT,
    logLevel: config.MONARCH_LOG_LEVEL,
    logFormat: config.MONARCH_LOG_FORMAT
  });

  const server = new HTTPServer({
    port: config.MONARCH_PORT || 7331,
    enableHealth: true,
    enableMetrics: true,
    enableReadiness: true
  });

  // Handle graceful shutdown
  process.on('SIGTERM', async () => {
    logger.info('SIGTERM received, shutting down gracefully');
    await server.stop();
    process.exit(0);
  });

  process.on('SIGINT', async () => {
    logger.info('SIGINT received, shutting down gracefully');
    await server.stop();
    process.exit(0);
  });

  try {
    await server.start();
    logger.info('Monarch Database server started successfully', {
      port: server.getPort(),
      endpoints: {
        health: `http://localhost:${server.getPort()}/health`,
        readiness: `http://localhost:${server.getPort()}/ready`,
        liveness: `http://localhost:${server.getPort()}/live`,
        metrics: `http://localhost:${server.getPort()}/metrics`
      }
    });
  } catch (error) {
    logger.fatal('Failed to start server', {}, error as Error);
    process.exit(1);
  }
}

// Run if executed directly
if (isMainModule()) {
  main().catch((error) => {
    logger.fatal('Unhandled error in server', {}, error);
    process.exit(1);
  });
}

export default main;

