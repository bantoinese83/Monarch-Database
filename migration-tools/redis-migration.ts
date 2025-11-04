#!/usr/bin/env tsx

/**
 * Redis Migration Tool for Monarch Database
 *
 * This tool migrates Redis data structures to Monarch Database collections.
 * Supports migration of Strings, Hashes, Lists, Sets, and Sorted Sets.
 *
 * Usage:
 *   tsx redis-migration.ts [options]
 *
 * Options:
 *   --redis-host <host>          Redis host (default: localhost)
 *   --redis-port <port>          Redis port (default: 6379)
 *   --redis-password <password>  Redis password (optional)
 *   --redis-db <db>              Redis database number (default: 0)
 *   --monarch-path <path>        Monarch database path (default: ./migrated-data)
 *   --batch-size <size>          Migration batch size (default: 1000)
 *   --types <types>              Comma-separated types to migrate (default: strings,hashes,lists,sets,zsets)
 *   --key-pattern <pattern>      Key pattern to migrate (default: *)
 *   --dry-run                    Show what would be migrated without actually doing it
 *   --verbose                    Enable verbose logging
 *   --help                       Show this help message
 */

import { createClient } from 'redis';
import { Monarch } from '../src/monarch';
import { isMainModule } from '../src/utils';
import { logger } from '../src/logger';
import * as fs from 'fs';
import * as path from 'path';

interface MigrationConfig {
  redisHost: string;
  redisPort: number;
  redisPassword?: string;
  redisDb: number;
  monarchPath: string;
  batchSize: number;
  types: string[];
  keyPattern: string;
  dryRun: boolean;
  verbose: boolean;
}

interface MigrationStats {
  totalKeys: number;
  processedKeys: number;
  migratedKeys: number;
  skippedKeys: number;
  errorKeys: number;
  startTime: number;
  endTime?: number;
  collectionsCreated: string[];
}

class RedisMigrationTool {
  private config: MigrationConfig;
  private monarch: Monarch;
  private redisClient: any;
  private stats: MigrationStats;
  private progressInterval: NodeJS.Timeout | null = null;

  constructor(config: MigrationConfig) {
    this.config = config;
    this.stats = {
      totalKeys: 0,
      processedKeys: 0,
      migratedKeys: 0,
      skippedKeys: 0,
      errorKeys: 0,
      startTime: Date.now(),
      collectionsCreated: []
    };
  }

  async migrate(): Promise<void> {
    try {
      logger.info('Starting Redis migration to Monarch Database', {
        redisHost: this.config.redisHost,
        redisPort: this.config.redisPort,
        monarchPath: this.config.monarchPath,
        types: this.config.types,
        dryRun: this.config.dryRun
      });

      // Initialize Monarch Database
      await this.initializeMonarch();

      // Connect to Redis
      await this.connectToRedis();

      // Get all keys matching pattern
      const keys = await this.getKeysToMigrate();
      this.stats.totalKeys = keys.length;

      if (this.config.dryRun) {
        logger.info('DRY RUN: Would migrate the following keys:', keys.slice(0, 10));
        if (keys.length > 10) logger.info(`... and ${keys.length - 10} more keys`);
        return;
      }

      // Start progress monitoring
      this.startProgressMonitor();

      // Process keys in batches
      for (let i = 0; i < keys.length; i += this.config.batchSize) {
        const batch = keys.slice(i, i + this.config.batchSize);
        await this.processBatch(batch);
      }

      this.stopProgressMonitor();
      this.printSummary();

    } catch (error) {
      logger.error('Migration failed:', error);
      throw error;
    } finally {
      await this.cleanup();
    }
  }

  private async initializeMonarch(): Promise<void> {
    // Ensure directory exists
    const dbDir = path.dirname(this.config.monarchPath);
    if (!fs.existsSync(dbDir)) {
      fs.mkdirSync(dbDir, { recursive: true });
    }

    this.monarch = new Monarch({
      persistence: {
        adapter: 'filesystem',
        path: this.config.monarchPath
      }
    });

    logger.info('Initialized Monarch Database', { path: this.config.monarchPath });
  }

  private async connectToRedis(): Promise<void> {
    this.redisClient = createClient({
      host: this.config.redisHost,
      port: this.config.redisPort,
      password: this.config.redisPassword,
      database: this.config.redisDb,
      connect_timeout: 10000, // 10 second connection timeout
      command_timeout: 30000, // 30 second command timeout
      retry_strategy: (options) => {
        if (options.error && options.error.code === 'ECONNREFUSED') {
          logger.error('Redis connection refused, aborting migration');
          return new Error('Redis connection failed');
        }
        if (options.total_retry_time > 1000 * 60 * 60) {
          logger.error('Redis retry timeout exceeded, aborting migration');
          return new Error('Redis connection timeout');
        }
        if (options.attempt > 10) {
          return undefined; // Stop retrying
        }
        return Math.min(options.attempt * 100, 3000); // Exponential backoff
      }
    });

    try {
      await this.redisClient.connect();
      logger.info('Connected to Redis', {
        host: this.config.redisHost,
        port: this.config.redisPort,
        db: this.config.redisDb
      });
    } catch (error) {
      logger.error('Failed to connect to Redis:', error);
      throw new Error(`Redis connection failed: ${error.message}`);
    }
  }

  private async getKeysToMigrate(): Promise<string[]> {
    try {
      const pattern = this.config.keyPattern;
      const keys = [];

      // Use SCAN to get all keys matching pattern
      let cursor = 0;
      do {
        const result = await this.redisClient.scan(cursor, {
          MATCH: pattern,
          COUNT: 1000
        });
        cursor = result.cursor;
        keys.push(...result.keys);
      } while (cursor !== 0);

      logger.info(`Found ${keys.length} keys matching pattern "${pattern}"`);
      return keys;
    } catch (error) {
      logger.error('Failed to scan Redis keys:', error);
      throw error;
    }
  }

  private async processBatch(keys: string[]): Promise<void> {
    const operations = keys.map(key => this.processKey(key));
    await Promise.allSettled(operations);
  }

  private async processKey(key: string): Promise<void> {
    try {
      this.stats.processedKeys++;

      // Get key type
      const type = await this.redisClient.type(key);

      if (!this.config.types.includes(type)) {
        this.stats.skippedKeys++;
        if (this.config.verbose) {
          logger.debug(`Skipping key "${key}" of type "${type}" (not in migration types)`);
        }
        return;
      }

      // Process based on type
      switch (type) {
        case 'string':
          await this.migrateString(key);
          break;
        case 'hash':
          await this.migrateHash(key);
          break;
        case 'list':
          await this.migrateList(key);
          break;
        case 'set':
          await this.migrateSet(key);
          break;
        case 'zset':
          await this.migrateZset(key);
          break;
        default:
          logger.warn(`Unsupported Redis type "${type}" for key "${key}"`);
          this.stats.skippedKeys++;
          return;
      }

      this.stats.migratedKeys++;
      if (this.config.verbose) {
        logger.debug(`Migrated key "${key}" of type "${type}"`);
      }

    } catch (error) {
      this.stats.errorKeys++;
      logger.error(`Failed to migrate key "${key}":`, error);
    }
  }

  private async migrateString(key: string): Promise<void> {
    const value = await this.redisClient.get(key);
    const ttl = await this.redisClient.ttl(key);

    const collectionName = 'redis_strings';
    await this.ensureCollection(collectionName);

    const document = {
      redisKey: key,
      value: value,
      ttl: ttl > 0 ? ttl : null,
      migratedAt: new Date().toISOString()
    };

    await this.monarch.addDocument(collectionName, document);
  }

  private async migrateHash(key: string): Promise<void> {
    const hashData = await this.redisClient.hGetAll(key);
    const ttl = await this.redisClient.ttl(key);

    const collectionName = 'redis_hashes';
    await this.ensureCollection(collectionName);

    const document = {
      redisKey: key,
      fields: hashData,
      ttl: ttl > 0 ? ttl : null,
      migratedAt: new Date().toISOString()
    };

    await this.monarch.addDocument(collectionName, document);
  }

  private async migrateList(key: string): Promise<void> {
    const listData = await this.redisClient.lRange(key, 0, -1);
    const ttl = await this.redisClient.ttl(key);

    const collectionName = 'redis_lists';
    await this.ensureCollection(collectionName);

    const document = {
      redisKey: key,
      items: listData,
      ttl: ttl > 0 ? ttl : null,
      migratedAt: new Date().toISOString()
    };

    await this.monarch.addDocument(collectionName, document);
  }

  private async migrateSet(key: string): Promise<void> {
    const setData = await this.redisClient.sMembers(key);
    const ttl = await this.redisClient.ttl(key);

    const collectionName = 'redis_sets';
    await this.ensureCollection(collectionName);

    const document = {
      redisKey: key,
      members: setData,
      ttl: ttl > 0 ? ttl : null,
      migratedAt: new Date().toISOString()
    };

    await this.monarch.addDocument(collectionName, document);
  }

  private async migrateZset(key: string): Promise<void> {
    const zsetData = await this.redisClient.zRangeWithScores(key, 0, -1);
    const ttl = await this.redisClient.ttl(key);

    const collectionName = 'redis_zsets';
    await this.ensureCollection(collectionName);

    const document = {
      redisKey: key,
      members: zsetData.map(item => ({
        value: item.value,
        score: item.score
      })),
      ttl: ttl > 0 ? ttl : null,
      migratedAt: new Date().toISOString()
    };

    await this.monarch.addDocument(collectionName, document);
  }

  private async ensureCollection(name: string): Promise<void> {
    if (!this.stats.collectionsCreated.includes(name)) {
      try {
        await this.monarch.addCollection(name);
        this.stats.collectionsCreated.push(name);
        logger.info(`Created collection "${name}"`);
      } catch (error) {
        // Collection might already exist, ignore error
        if (!error.message.includes('already exists')) {
          throw error;
        }
      }
    }
  }

  private startProgressMonitor(): void {
    this.progressInterval = setInterval(() => {
      const progress = (this.stats.processedKeys / this.stats.totalKeys) * 100;
      const elapsed = Date.now() - this.stats.startTime;
      const rate = this.stats.processedKeys / (elapsed / 1000);

      logger.info(`Migration Progress: ${progress.toFixed(1)}% (${this.stats.processedKeys}/${this.stats.totalKeys}) - ${rate.toFixed(0)} keys/sec`);
    }, 5000);
  }

  private stopProgressMonitor(): void {
    if (this.progressInterval) {
      clearInterval(this.progressInterval);
      this.progressInterval = null;
    }
  }

  private printSummary(): void {
    this.stats.endTime = Date.now();
    const duration = (this.stats.endTime - this.stats.startTime) / 1000;
    const rate = this.stats.processedKeys / duration;

    logger.info('Migration completed successfully!');
    logger.info('Summary:', {
      totalKeys: this.stats.totalKeys,
      processedKeys: this.stats.processedKeys,
      migratedKeys: this.stats.migratedKeys,
      skippedKeys: this.stats.skippedKeys,
      errorKeys: this.stats.errorKeys,
      duration: `${duration.toFixed(1)} seconds`,
      rate: `${rate.toFixed(1)} keys/second`,
      collectionsCreated: this.stats.collectionsCreated
    });
  }

  private async cleanup(): Promise<void> {
    this.stopProgressMonitor();

    if (this.redisClient) {
      try {
        await this.redisClient.quit();
        logger.info('Disconnected from Redis');
      } catch (error) {
        logger.warn('Error disconnecting from Redis:', error);
      }
    }

    if (this.monarch) {
      try {
        await this.monarch.save();
        logger.info('Monarch Database saved');
      } catch (error) {
        logger.warn('Error saving Monarch Database:', error);
      }
    }
  }
}

// CLI argument parsing
function parseArgs(): MigrationConfig {
  const args = process.argv.slice(2);
  const config: Partial<MigrationConfig> = {
    redisHost: 'localhost',
    redisPort: 6379,
    redisDb: 0,
    monarchPath: './migrated-data',
    batchSize: 1000,
    types: ['string', 'hash', 'list', 'set', 'zset'],
    keyPattern: '*',
    dryRun: false,
    verbose: false
  };

  for (let i = 0; i < args.length; i++) {
    switch (args[i]) {
      case '--redis-host':
        config.redisHost = args[++i];
        break;
      case '--redis-port':
        config.redisPort = parseInt(args[++i]);
        break;
      case '--redis-password':
        config.redisPassword = args[++i];
        break;
      case '--redis-db':
        config.redisDb = parseInt(args[++i]);
        break;
      case '--monarch-path':
        config.monarchPath = args[++i];
        break;
      case '--batch-size':
        config.batchSize = parseInt(args[++i]);
        break;
      case '--types':
        config.types = args[++i].split(',');
        break;
      case '--key-pattern':
        config.keyPattern = args[++i];
        break;
      case '--dry-run':
        config.dryRun = true;
        break;
      case '--verbose':
        config.verbose = true;
        break;
      case '--help':
        printHelp();
        process.exit(0);
      default:
        console.error(`Unknown option: ${args[i]}`);
        printHelp();
        process.exit(1);
    }
  }

  return config as MigrationConfig;
}

function printHelp(): void {
  console.log(`
Redis Migration Tool for Monarch Database

Usage:
  tsx redis-migration.ts [options]

Options:
  --redis-host <host>          Redis host (default: localhost)
  --redis-port <port>          Redis port (default: 6379)
  --redis-password <password>  Redis password (optional)
  --redis-db <db>              Redis database number (default: 0)
  --monarch-path <path>        Monarch database path (default: ./migrated-data)
  --batch-size <size>          Migration batch size (default: 1000)
  --types <types>              Comma-separated types to migrate (default: string,hash,list,set,zset)
  --key-pattern <pattern>      Key pattern to migrate (default: *)
  --dry-run                    Show what would be migrated without actually doing it
  --verbose                    Enable verbose logging
  --help                       Show this help message

Examples:
  # Migrate all data types from local Redis
  tsx redis-migration.ts

  # Dry run to see what would be migrated
  tsx redis-migration.ts --dry-run --verbose

  # Migrate only strings and hashes from remote Redis
  tsx redis-migration.ts --redis-host redis.example.com --redis-port 6380 --types string,hash

  # Migrate keys matching a pattern
  tsx redis-migration.ts --key-pattern "user:*"
`);
}

// Main execution
async function main() {
  try {
    const config = parseArgs();
    const migrator = new RedisMigrationTool(config);
    await migrator.migrate();
    process.exit(0);
  } catch (error) {
    logger.error('Migration failed:', error);
    process.exit(1);
  }
}

// Handle graceful shutdown
process.on('SIGINT', () => {
  logger.info('Migration interrupted by user');
  process.exit(1);
});

process.on('SIGTERM', () => {
  logger.info('Migration terminated');
  process.exit(1);
});

// Run the migration
if (isMainModule()) {
  main();
}

export { RedisMigrationTool, MigrationConfig, MigrationStats };
