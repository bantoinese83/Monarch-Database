#!/usr/bin/env tsx

/**
 * MongoDB Migration Tool for Monarch Database
 *
 * This tool migrates MongoDB collections to Monarch Database collections.
 * Supports selective collection migration with batch processing and progress tracking.
 *
 * Usage:
 *   tsx mongodb-migration.ts [options]
 *
 * Options:
 *   --mongo-uri <uri>           MongoDB connection URI (default: mongodb://localhost:27017)
 *   --mongo-database <db>       MongoDB database name
 *   --collections <list>        Comma-separated list of collections to migrate (default: all)
 *   --monarch-path <path>       Monarch database path (default: ./migrated-data)
 *   --batch-size <size>         Migration batch size (default: 1000)
 *   --skip-validation           Skip document validation during migration
 *   --preserve-ids              Preserve original MongoDB _id values
 *   --transform-funcs <file>    Path to transformation functions file
 *   --dry-run                   Show what would be migrated without actually doing it
 *   --verbose                   Enable verbose logging
 *   --help                      Show this help message
 */

import { MongoClient, Db, Collection, Document } from 'mongodb';
import { Monarch } from '../src/monarch';
import { logger } from '../src/logger';
import * as fs from 'fs';
import * as path from 'path';

interface MigrationConfig {
  mongoUri: string;
  mongoDatabase: string;
  collections: string[];
  monarchPath: string;
  batchSize: number;
  skipValidation: boolean;
  preserveIds: boolean;
  transformFuncs?: string;
  dryRun: boolean;
  verbose: boolean;
}

interface CollectionStats {
  name: string;
  documentCount: number;
  size: number;
  indexes: any[];
}

interface MigrationStats {
  collections: CollectionStats[];
  totalDocuments: number;
  processedDocuments: number;
  migratedDocuments: number;
  errorDocuments: number;
  startTime: number;
  endTime?: number;
  collectionsCreated: string[];
}

class MongoDBMigrationTool {
  private config: MigrationConfig;
  private monarch: Monarch;
  private mongoClient: MongoClient;
  private mongoDb: Db;
  private stats: MigrationStats;
  private progressInterval: NodeJS.Timeout | null = null;
  private transformFunctions: { [key: string]: (doc: any) => any } = {};

  constructor(config: MigrationConfig) {
    this.config = config;
    this.stats = {
      collections: [],
      totalDocuments: 0,
      processedDocuments: 0,
      migratedDocuments: 0,
      errorDocuments: 0,
      startTime: Date.now(),
      collectionsCreated: []
    };
  }

  async migrate(): Promise<void> {
    try {
      logger.info('Starting MongoDB migration to Monarch Database', {
        mongoUri: this.config.mongoUri,
        mongoDatabase: this.config.mongoDatabase,
        collections: this.config.collections,
        monarchPath: this.config.monarchPath,
        dryRun: this.config.dryRun
      });

      // Load transformation functions if specified
      if (this.config.transformFuncs) {
        await this.loadTransformFunctions();
      }

      // Initialize Monarch Database
      await this.initializeMonarch();

      // Connect to MongoDB
      await this.connectToMongoDB();

      // Get collections to migrate
      const collectionsToMigrate = await this.getCollectionsToMigrate();

      if (this.config.dryRun) {
        logger.info('DRY RUN: Would migrate the following collections:');
        collectionsToMigrate.forEach(col => {
          logger.info(`  - ${col.name}: ${col.documentCount} documents`);
        });
        return;
      }

      // Start progress monitoring
      this.startProgressMonitor();

      // Migrate each collection
      for (const collectionInfo of collectionsToMigrate) {
        await this.migrateCollection(collectionInfo);
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

  private async loadTransformFunctions(): Promise<void> {
    try {
      const transformFile = path.resolve(this.config.transformFuncs!);
      const transformModule = await import(transformFile);

      if (transformModule.default && typeof transformModule.default === 'object') {
        this.transformFunctions = transformModule.default;
      } else if (typeof transformModule === 'object') {
        this.transformFunctions = transformModule;
      }

      logger.info('Loaded transformation functions', { count: Object.keys(this.transformFunctions).length });
    } catch (error) {
      logger.warn('Failed to load transformation functions:', error);
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
      },
      validation: !this.config.skipValidation
    });

    logger.info('Initialized Monarch Database', { path: this.config.monarchPath });
  }

  private async connectToMongoDB(): Promise<void> {
    this.mongoClient = new MongoClient(this.config.mongoUri, {
      connectTimeoutMS: 10000, // 10 second connection timeout
      serverSelectionTimeoutMS: 10000, // 10 second server selection timeout
      socketTimeoutMS: 30000, // 30 second socket timeout
      maxPoolSize: 10, // Connection pool size
      retryWrites: true,
      retryReads: true
    });

    try {
      await this.mongoClient.connect();
      this.mongoDb = this.mongoClient.db(this.config.mongoDatabase);

      // Test the connection
      await this.mongoDb.admin().ping();

      logger.info('Connected to MongoDB', {
        uri: this.config.mongoUri.replace(/:\/\/.*@/, '://***:***@'), // Hide credentials in logs
        database: this.config.mongoDatabase
      });
    } catch (error) {
      logger.error('Failed to connect to MongoDB:', error);
      throw new Error(`MongoDB connection failed: ${error.message}`);
    }
  }

  private async getCollectionsToMigrate(): Promise<CollectionStats[]> {
    const collections = await this.mongoDb.collections();

    let collectionsToMigrate: CollectionStats[] = [];

    if (this.config.collections.length === 0 || this.config.collections.includes('all')) {
      // Migrate all collections
      for (const collection of collections) {
        const stats = await this.getCollectionStats(collection);
        collectionsToMigrate.push(stats);
      }
    } else {
      // Migrate specific collections
      for (const collectionName of this.config.collections) {
        const collection = collections.find(c => c.collectionName === collectionName);
        if (collection) {
          const stats = await this.getCollectionStats(collection);
          collectionsToMigrate.push(stats);
        } else {
          logger.warn(`Collection "${collectionName}" not found in database`);
        }
      }
    }

    // Sort by document count (largest first)
    collectionsToMigrate.sort((a, b) => b.documentCount - a.documentCount);

    this.stats.collections = collectionsToMigrate;
    this.stats.totalDocuments = collectionsToMigrate.reduce((sum, col) => sum + col.documentCount, 0);

    logger.info(`Found ${collectionsToMigrate.length} collections to migrate (${this.stats.totalDocuments} total documents)`);
    return collectionsToMigrate;
  }

  private async getCollectionStats(collection: Collection): Promise<CollectionStats> {
    const stats = await this.mongoDb.command({ collStats: collection.collectionName });
    const indexes = await collection.indexes();

    return {
      name: collection.collectionName,
      documentCount: stats.count || 0,
      size: stats.size || 0,
      indexes: indexes
    };
  }

  private async migrateCollection(collectionInfo: CollectionStats): Promise<void> {
    logger.info(`Starting migration of collection "${collectionInfo.name}" (${collectionInfo.documentCount} documents)`);

    const mongoCollection = this.mongoDb.collection(collectionInfo.name);
    const monarchCollection = collectionInfo.name;

    // Create collection in Monarch
    await this.ensureCollection(monarchCollection);

    // Migrate indexes (simplified - just log for now)
    if (collectionInfo.indexes.length > 1) { // First index is usually _id
      logger.info(`Collection "${collectionInfo.name}" has ${collectionInfo.indexes.length - 1} custom indexes`);
      // Note: Monarch doesn't have explicit index creation yet, this would be a future enhancement
    }

    // Migrate documents in batches
    let cursor = mongoCollection.find({});
    let batch: Document[] = [];
    let processedInCollection = 0;

    while (await cursor.hasNext()) {
      const document = await cursor.next();
      if (!document) continue;

      batch.push(document);
      processedInCollection++;
      this.stats.processedDocuments++;

      if (batch.length >= this.config.batchSize) {
        await this.migrateBatch(monarchCollection, batch);
        batch = [];
      }

      // Update progress for current collection
      if (processedInCollection % 1000 === 0 || processedInCollection === collectionInfo.documentCount) {
        const progress = (processedInCollection / collectionInfo.documentCount) * 100;
        logger.debug(`Collection "${collectionInfo.name}": ${progress.toFixed(1)}% (${processedInCollection}/${collectionInfo.documentCount})`);
      }
    }

    // Migrate remaining documents
    if (batch.length > 0) {
      await this.migrateBatch(monarchCollection, batch);
    }

    logger.info(`Completed migration of collection "${collectionInfo.name}"`);
  }

  private async migrateBatch(collectionName: string, documents: Document[]): Promise<void> {
    try {
      // Transform documents if needed
      const transformedDocuments = documents.map(doc => this.transformDocument(collectionName, doc));

      // Add migration metadata
      const documentsWithMetadata = transformedDocuments.map(doc => ({
        ...doc,
        _migration: {
          source: 'mongodb',
          database: this.config.mongoDatabase,
          collection: collectionName,
          migratedAt: new Date().toISOString(),
          originalId: doc._id
        }
      }));

      // Handle _id preservation
      const documentsForMonarch = this.config.preserveIds
        ? documentsWithMetadata
        : documentsWithMetadata.map(({ _id, ...doc }) => doc);

      // Insert batch into Monarch
      for (const document of documentsForMonarch) {
        try {
          await this.monarch.addDocument(collectionName, document);
          this.stats.migratedDocuments++;
        } catch (error) {
          this.stats.errorDocuments++;
          logger.error(`Failed to migrate document:`, error);
          if (this.config.verbose) {
            logger.error('Document data:', document);
          }
        }
      }

    } catch (error) {
      logger.error('Failed to migrate batch:', error);
      this.stats.errorDocuments += documents.length;
    }
  }

  private transformDocument(collectionName: string, document: Document): Document {
    let transformed = { ...document };

    // Apply collection-specific transformation if available
    if (this.transformFunctions[collectionName]) {
      try {
        transformed = this.transformFunctions[collectionName](transformed);
        if (this.config.verbose) {
          logger.debug(`Applied transformation to document in collection "${collectionName}"`);
        }
      } catch (error) {
        logger.warn(`Transformation failed for document in collection "${collectionName}":`, error);
      }
    }

    // Apply global transformation if available
    if (this.transformFunctions['*']) {
      try {
        transformed = this.transformFunctions['*'](transformed);
        if (this.config.verbose) {
          logger.debug('Applied global transformation to document');
        }
      } catch (error) {
        logger.warn('Global transformation failed:', error);
      }
    }

    return transformed;
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
      const progress = (this.stats.processedDocuments / this.stats.totalDocuments) * 100;
      const elapsed = Date.now() - this.stats.startTime;
      const rate = this.stats.processedDocuments / (elapsed / 1000);
      const eta = this.stats.totalDocuments > this.stats.processedDocuments
        ? ((this.stats.totalDocuments - this.stats.processedDocuments) / rate)
        : 0;

      logger.info(`Migration Progress: ${progress.toFixed(1)}% (${this.stats.processedDocuments}/${this.stats.totalDocuments}) - ${rate.toFixed(0)} docs/sec - ETA: ${eta.toFixed(0)}s`);
    }, 10000);
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
    const rate = this.stats.processedDocuments / duration;

    logger.info('Migration completed successfully!');
    logger.info('Summary:', {
      collectionsMigrated: this.stats.collections.length,
      totalDocuments: this.stats.totalDocuments,
      processedDocuments: this.stats.processedDocuments,
      migratedDocuments: this.stats.migratedDocuments,
      errorDocuments: this.stats.errorDocuments,
      duration: `${duration.toFixed(1)} seconds`,
      rate: `${rate.toFixed(1)} documents/second`,
      collectionsCreated: this.stats.collectionsCreated
    });

    // Detailed collection breakdown
    logger.info('Collection breakdown:');
    this.stats.collections.forEach(col => {
      logger.info(`  ${col.name}: ${col.documentCount} documents`);
    });
  }

  private async cleanup(): Promise<void> {
    this.stopProgressMonitor();

    if (this.mongoClient) {
      try {
        await this.mongoClient.close();
        logger.info('Disconnected from MongoDB');
      } catch (error) {
        logger.warn('Error disconnecting from MongoDB:', error);
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
    mongoUri: 'mongodb://localhost:27017',
    mongoDatabase: '',
    collections: [],
    monarchPath: './migrated-data',
    batchSize: 1000,
    skipValidation: false,
    preserveIds: false,
    dryRun: false,
    verbose: false
  };

  for (let i = 0; i < args.length; i++) {
    switch (args[i]) {
      case '--mongo-uri':
        config.mongoUri = args[++i];
        break;
      case '--mongo-database':
        config.mongoDatabase = args[++i];
        break;
      case '--collections':
        config.collections = args[++i].split(',').map(c => c.trim());
        break;
      case '--monarch-path':
        config.monarchPath = args[++i];
        break;
      case '--batch-size':
        config.batchSize = parseInt(args[++i]);
        break;
      case '--skip-validation':
        config.skipValidation = true;
        break;
      case '--preserve-ids':
        config.preserveIds = true;
        break;
      case '--transform-funcs':
        config.transformFuncs = args[++i];
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

  if (!config.mongoDatabase) {
    console.error('MongoDB database name is required (--mongo-database)');
    process.exit(1);
  }

  return config as MigrationConfig;
}

function printHelp(): void {
  console.log(`
MongoDB Migration Tool for Monarch Database

Usage:
  tsx mongodb-migration.ts [options]

Options:
  --mongo-uri <uri>            MongoDB connection URI (default: mongodb://localhost:27017)
  --mongo-database <db>        MongoDB database name (required)
  --collections <list>         Comma-separated list of collections to migrate (default: all)
  --monarch-path <path>        Monarch database path (default: ./migrated-data)
  --batch-size <size>          Migration batch size (default: 1000)
  --skip-validation            Skip document validation during migration
  --preserve-ids               Preserve original MongoDB _id values
  --transform-funcs <file>     Path to transformation functions file
  --dry-run                    Show what would be migrated without actually doing it
  --verbose                    Enable verbose logging
  --help                       Show this help message

Examples:
  # Migrate all collections from local MongoDB
  tsx mongodb-migration.ts --mongo-database myapp

  # Migrate specific collections from remote MongoDB
  tsx mongodb-migration.ts --mongo-uri mongodb+srv://user:pass@cluster.mongodb.net --mongo-database myapp --collections users,products,orders

  # Dry run to see what would be migrated
  tsx mongodb-migration.ts --mongo-database myapp --dry-run --verbose

  # Migrate with custom transformations
  tsx mongodb-migration.ts --mongo-database myapp --transform-funcs ./transforms.js

Transform Functions File Example (transforms.js):
  export default {
    // Transform all collections
    '*': (doc) => {
      // Add migration timestamp to all documents
      doc.migratedAt = new Date();
      return doc;
    },

    // Transform specific collection
    users: (doc) => {
      // Rename field
      if (doc.email) doc.emailAddress = doc.email;
      delete doc.email;
      return doc;
    }
  };
`);
}

// Main execution
async function main() {
  try {
    const config = parseArgs();
    const migrator = new MongoDBMigrationTool(config);
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
if (require.main === module) {
  main();
}

export { MongoDBMigrationTool, MigrationConfig, MigrationStats, CollectionStats };
