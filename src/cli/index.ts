#!/usr/bin/env node

/**
 * Monarch CLI Tool
 *
 * Command-line interface for database management, debugging, and operations.
 */

import { Monarch } from '../monarch';
import { FileSystemAdapter } from '../adapters/filesystem';
import { readFileSync, writeFileSync, mkdirSync, existsSync, unlinkSync } from 'fs';
import { join } from 'path';
import { isMainModule } from '../utils';

/**
 * CLI command interface
 */
interface CLICommand {
  name: string;
  description: string;
  usage?: string;
  examples?: string[];
  execute: (args: string[], options: Record<string, unknown>) => Promise<void>;
}

/**
 * CLI commands registry
 */
class CLIRegistry {
  private commands: Map<string, CLICommand> = new Map();

  register(command: CLICommand): void {
    this.commands.set(command.name, command);
  }

  get(name: string): CLICommand | undefined {
    return this.commands.get(name);
  }

  list(): CLICommand[] {
    return Array.from(this.commands.values());
  }
}

const registry = new CLIRegistry();

// Parse command line arguments
function parseArgs(args: string[]) {
  const options: Record<string, unknown> = {};
  const positional: string[] = [];

  let i = 0;
  while (i < args.length) {
    const arg = args[i];
    if (arg.startsWith('--')) {
      const key = arg.slice(2);
      const nextArg = args[i + 1];

      // Check if next arg exists and is not another option
      if (nextArg && !nextArg.startsWith('--')) {
        options[key] = nextArg;
        i += 2; // Skip both option and value
      } else {
        options[key] = true;
        i += 1; // Skip just the option
      }
    } else {
      positional.push(arg);
      i += 1;
    }
  }

  return { positional, options };
}

// Register commands
registry.register({
  name: 'init',
  description: 'Initialize a new Monarch database',
  usage: 'init [path]',
  examples: ['init', 'init ./my-database'],
  execute: async args => {
    const dbPath = args[0] || './monarch-data';
    try {
      // Ensure directory exists
      if (!existsSync(dbPath)) {
        mkdirSync(dbPath, { recursive: true });
      }

      // Create metadata file to mark initialization BEFORE creating the adapter
      const metaFile = join(dbPath, '.monarch-meta.json');
      const metadata = {
        initialized: true,
        createdAt: new Date().toISOString(),
        version: '1.0.0',
        collections: [],
      };
      writeFileSync(metaFile, JSON.stringify(metadata, null, 2));

      const adapter = new FileSystemAdapter(join(dbPath, 'data.json'));
      const db = new Monarch(adapter);
      // eslint-disable-next-line no-console
      console.log(`✓ Database initialized at ${dbPath}`);
      const stats = db.getStats();
      // eslint-disable-next-line no-console
      console.log('  Collections:', stats.collectionCount);
    } catch (error) {
      // eslint-disable-next-line no-console
      console.error(
        '❌ Failed to initialize database:',
        error instanceof Error ? error.message : String(error)
      );
      process.exit(1);
    }
  },
});

registry.register({
  name: 'create',
  description: 'Create a new collection',
  usage: 'create <collection> [--path <path>]',
  examples: ['create users', 'create products --path ./my-db'],
  execute: async (args, options) => {
    const dbPath =
      (typeof options.path === 'string' ? options.path : undefined) || './monarch-data';
    try {
      // Ensure directory exists
      if (!existsSync(dbPath)) {
        mkdirSync(dbPath, { recursive: true });
      }

      const adapter = new FileSystemAdapter(join(dbPath, 'data.json'));
      const db = new Monarch(adapter);

      if (!args[0]) {
        throw new Error('Collection name required. Usage: create <collection>');
      }

      const collectionName = args[0];
      db.addCollection(collectionName);

      // Save collection metadata with file locking to prevent race conditions
      const metaFile = join(dbPath, '.monarch-meta.json');
      const lockFile = join(dbPath, '.monarch-meta.lock');

      // Implement simple file locking
      const maxRetries = 10;
      const retryDelay = 100; // ms

      for (let attempt = 0; attempt < maxRetries; attempt++) {
        try {
          // Try to acquire lock
          if (existsSync(lockFile)) {
            // Lock file exists, wait and retry
            await new Promise(resolve => setTimeout(resolve, retryDelay));
            continue;
          }

          // Create lock file
          writeFileSync(lockFile, process.pid.toString());

          try {
            // Read existing metadata
            let metadata: any = { collections: [] };
            try {
              const existingData = readFileSync(metaFile, 'utf-8');
              metadata = JSON.parse(existingData);
              metadata.collections = metadata.collections || [];
            } catch {
              // File doesn't exist or is corrupted, start fresh
              metadata = {
                initialized: true,
                createdAt: new Date().toISOString(),
                version: '1.0.0',
                collections: []
              };
            }

            // Add collection if not already present
            if (!metadata.collections.includes(collectionName)) {
              metadata.collections.push(collectionName);
            }

            // Write updated metadata
            writeFileSync(metaFile, JSON.stringify(metadata, null, 2));

            // Remove lock file
            if (existsSync(lockFile)) {
              unlinkSync(lockFile);
            }

            break; // Success, exit retry loop

          } finally {
            // Ensure lock file is removed even if an error occurs
            try {
              if (existsSync(lockFile)) {
                unlinkSync(lockFile);
              }
          } catch {
            // Ignore lock cleanup errors
          }
          }

        } catch (error) {
          if (attempt === maxRetries - 1) {
            // eslint-disable-next-line no-console
            console.error('❌ Failed to update metadata after maximum retries:', error);
            throw new Error('Failed to save collection metadata due to concurrent access');
          }
          // Wait before retrying
          await new Promise(resolve => setTimeout(resolve, retryDelay * (attempt + 1)));
        }
      }

      // eslint-disable-next-line no-console
      console.log(`✓ Collection '${collectionName}' created`);
    } catch (error) {
      // eslint-disable-next-line no-console
      console.error(
        '❌ Failed to create collection:',
        error instanceof Error ? error.message : String(error)
      );
      process.exit(1);
    }
  },
});

registry.register({
  name: 'insert',
  description: 'Insert documents into a collection',
  usage: 'insert <collection> <file> --path <path>',
  examples: ['insert users data.json --path ./my-db', 'insert products batch.json --path ./data'],
  execute: async (args, options) => {
    const dbPath =
      (typeof options.path === 'string' ? options.path : undefined) || './monarch-data';

    try {
      // Ensure directory exists
      if (!existsSync(dbPath)) {
        mkdirSync(dbPath, { recursive: true });
      }

      const adapter = new FileSystemAdapter(join(dbPath, 'data.json'));
      const db = new Monarch(adapter);

      const collectionName = args[0];
      const filePath = args[1];

      if (!collectionName) {
        throw new Error('Collection name required. Usage: insert <collection> <file>');
      }
      if (!filePath) {
        throw new Error('File path required. Usage: insert <collection> <file>');
      }

      const collection = db.getCollection(collectionName);
      if (!collection) {
        throw new Error(
          `Collection '${collectionName}' does not exist. Create it first with: create ${collectionName}`
        );
      }

      const data = JSON.parse(readFileSync(filePath, 'utf-8'));
      const docs = Array.isArray(data) ? data : [data];
      const inserted = collection.insert(docs);

      // eslint-disable-next-line no-console
      console.log(`✓ Inserted ${inserted?.length || 0} document(s) into '${collectionName}'`);
    } catch (error) {
      // eslint-disable-next-line no-console
      console.error(
        '❌ Failed to insert documents:',
        error instanceof Error ? error.message : String(error)
      );
      process.exit(1);
    }
  },
});

registry.register({
  name: 'query',
  description: 'Query a collection',
  execute: async (args, options) => {
    const dbPath =
      (typeof options.path === 'string' ? options.path : undefined) || './monarch-data';
    const adapter = new FileSystemAdapter(dbPath);
    const db = new Monarch(adapter);

    const collectionName = args[0];
    const queryStr = args[1] || '{}';

    if (!collectionName) {
      throw new Error('Collection name required');
    }

    const collection = db.getCollection(collectionName);
    if (!collection) {
      throw new Error(`Collection '${collectionName}' not found`);
    }

    const query = JSON.parse(queryStr);
    const results = collection.find(query);

    // eslint-disable-next-line no-console
    console.log(`Found ${results.length} document(s):`);
    // eslint-disable-next-line no-console
    console.log(JSON.stringify(results, null, 2));
  },
});

registry.register({
  name: 'stats',
  description: 'Show database statistics',
  execute: async (args, options) => {
    const dbPath =
      (typeof options.path === 'string' ? options.path : undefined) || './monarch-data';
    const adapter = new FileSystemAdapter(dbPath);
    const db = new Monarch(adapter);

    const stats = db.getStats();
    // eslint-disable-next-line no-console
    console.log('Database Statistics:');
    // eslint-disable-next-line no-console
    console.log(`  Collections: ${stats.collectionCount}`);
    // eslint-disable-next-line no-console
    console.log(`  Total Documents: ${stats.totalDocuments}`);
    // Note: totalSize not available in current API
  },
});

registry.register({
  name: 'help',
  description: 'Show help information',
  execute: async () => {
    // eslint-disable-next-line no-console
    console.log('🚀 Monarch Database CLI v1.0.0');
    // eslint-disable-next-line no-console
    console.log('High-performance, zero-dependency database for JavaScript/TypeScript\n');
    // eslint-disable-next-line no-console
    console.log('📋 Available commands:\n');

    for (const command of registry.list()) {
      // eslint-disable-next-line no-console
      console.log(`  ${command.name.padEnd(15)} ${command.description}`);
    }

    // eslint-disable-next-line no-console
    console.log('\n💡 Usage: monarch <command> [args] [options]');
    // eslint-disable-next-line no-console
    console.log('\n🔧 Global Options:');
    // eslint-disable-next-line no-console
    console.log('  --path <path>    Database path (default: ./monarch-data)');
    // eslint-disable-next-line no-console
    console.log('  --help           Show this help message');
    // eslint-disable-next-line no-console
    console.log('\n📖 Get help for a specific command: monarch help <command>');
    // eslint-disable-next-line no-console
    console.log('\n🌟 Examples:');
    // eslint-disable-next-line no-console
    console.log('  monarch init                    # Initialize database');
    // eslint-disable-next-line no-console
    console.log('  monarch create users            # Create users collection');
    // eslint-disable-next-line no-console
    console.log('  monarch insert users \'{"name": "John"}\'  # Insert document');
    // eslint-disable-next-line no-console
    console.log('  monarch query users             # Query all documents');
  },
});

// Register commands
registry.register({
  name: 'init',
  description: 'Initialize a new Monarch database',
  usage: 'init [path]',
  examples: ['init', 'init ./my-database'],
  execute: async args => {
    const dbPath = args[0] || './monarch-data';
    try {
      // Ensure directory exists
      if (!existsSync(dbPath)) {
        mkdirSync(dbPath, { recursive: true });
      }

      // Create metadata file to mark initialization BEFORE creating the adapter
      const metaFile = join(dbPath, '.monarch-meta.json');
      const metadata = {
        initialized: true,
        createdAt: new Date().toISOString(),
        version: '1.0.0',
        collections: [],
      };
      writeFileSync(metaFile, JSON.stringify(metadata, null, 2));

      const adapter = new FileSystemAdapter(join(dbPath, 'data.json'));
      const db = new Monarch(adapter);

      // eslint-disable-next-line no-console
      console.log(`✓ Database initialized at ${dbPath}`);
      const stats = db.getStats();
      // eslint-disable-next-line no-console
      console.log('  Collections:', stats.collectionCount);
    } catch (error) {
      // eslint-disable-next-line no-console
      console.error(
        '❌ Failed to initialize database:',
        error instanceof Error ? error.message : String(error)
      );
      process.exit(1);
    }
  },
});

registry.register({
  name: 'create',
  description: 'Create a new collection',
  usage: 'create <collection> [--path <path>]',
  examples: ['create users --path ./my-db', 'create products ./my-db'],
  execute: async (args, options) => {
    const dbPath =
      (typeof options.path === 'string' ? options.path : undefined) || args[1] || './monarch-data';
    try {
      // Ensure directory exists
      if (!existsSync(dbPath)) {
        mkdirSync(dbPath, { recursive: true });
      }

      const adapter = new FileSystemAdapter(join(dbPath, 'data.json'));
      const db = new Monarch(adapter);

      if (!args[0]) {
        throw new Error('Collection name required. Usage: create <collection>');
      }

      const collectionName = args[0];
      db.addCollection(collectionName);
      // Save the database to persist the collection structure
      await db.save();

      // Save collection metadata with file locking to prevent race conditions
      const metaFile = join(dbPath, '.monarch-meta.json');
      const lockFile = join(dbPath, '.monarch-meta.lock');

      // Implement simple file locking
      const maxRetries = 10;
      const retryDelay = 100; // ms

      for (let attempt = 0; attempt < maxRetries; attempt++) {
        try {
          // Try to acquire lock
          if (existsSync(lockFile)) {
            // Lock file exists, wait and retry
            await new Promise(resolve => setTimeout(resolve, retryDelay));
            continue;
          }

          // Create lock file
          writeFileSync(lockFile, process.pid.toString());

          try {
            // Read existing metadata
            let metadata: any = { collections: [] };
            try {
              const existingData = readFileSync(metaFile, 'utf-8');
              metadata = JSON.parse(existingData);
              metadata.collections = metadata.collections || [];
            } catch {
              // File doesn't exist or is corrupted, start fresh
              metadata = {
                initialized: true,
                createdAt: new Date().toISOString(),
                version: '1.0.0',
                collections: []
              };
            }

            // Add collection if not already present
            if (!metadata.collections.includes(collectionName)) {
              metadata.collections.push(collectionName);
            }

            // Write updated metadata
            writeFileSync(metaFile, JSON.stringify(metadata, null, 2));

            // Remove lock file
            if (existsSync(lockFile)) {
              unlinkSync(lockFile);
            }

            break; // Success, exit retry loop

          } finally {
            // Ensure lock file is removed even if an error occurs
            try {
              if (existsSync(lockFile)) {
                unlinkSync(lockFile);
              }
          } catch {
            // Ignore lock cleanup errors
          }
          }

        } catch (error) {
          if (attempt === maxRetries - 1) {
            // eslint-disable-next-line no-console
            console.error('❌ Failed to update metadata after maximum retries:', error);
            throw new Error('Failed to save collection metadata due to concurrent access');
          }
          // Wait before retrying
          await new Promise(resolve => setTimeout(resolve, retryDelay * (attempt + 1)));
        }
      }

      // eslint-disable-next-line no-console
      console.log(`✓ Collection '${collectionName}' created`);
    } catch (error) {
      // eslint-disable-next-line no-console
      console.error(
        '❌ Failed to create collection:',
        error instanceof Error ? error.message : String(error)
      );
      process.exit(1);
    }
  },
});

registry.register({
  name: 'insert',
  description: 'Insert documents into a collection',
  usage: 'insert <collection> <file> --path <path>',
  examples: ['insert users data.json --path ./my-db', 'insert products batch.json --path ./data'],
  execute: async (args, options) => {
    const dbPath =
      (typeof options.path === 'string' ? options.path : undefined) || args[2] || './monarch-data';

    try {
      // Ensure directory exists
      if (!existsSync(dbPath)) {
        mkdirSync(dbPath, { recursive: true });
      }

      const adapter = new FileSystemAdapter(join(dbPath, 'data.json'));
      const db = new Monarch(adapter);
      // Load existing collections from metadata
      try {
        const metaFile = join(dbPath, '.monarch-meta.json');
        if (existsSync(metaFile)) {
          const metadata = JSON.parse(readFileSync(metaFile, 'utf-8'));
          if (metadata.collections) {
            metadata.collections.forEach((name: string) => {
              if (!db.getCollection(name)) {
                db.addCollection(name);
              }
            });
          }
        }
      } catch {
        // Ignore metadata loading errors
      }

      // Load existing data from file
      await db.load();

      const collectionName = args[0];
      const filePath = args[1];

      if (!collectionName) {
        throw new Error('Collection name required. Usage: insert <collection> <file>');
      }
      if (!filePath) {
        throw new Error('File path required. Usage: insert <collection> <file>');
      }

      const collection = db.getCollection(collectionName);
      if (!collection) {
        throw new Error(
          `Collection '${collectionName}' does not exist. Create it first with: create ${collectionName}`
        );
      }

      const data = JSON.parse(readFileSync(filePath, 'utf-8'));
      const docs = Array.isArray(data) ? data : [data];
      const inserted = collection.insert(docs);
      // Save the database
      await db.save();
      // eslint-disable-next-line no-console
      console.log(`✓ Inserted ${inserted?.length || 0} document(s) into '${collectionName}'`);
    } catch (error) {
      // eslint-disable-next-line no-console
      console.error(
        '❌ Failed to insert documents:',
        error instanceof Error ? error.message : String(error)
      );
      process.exit(1);
    }
  },
});

registry.register({
  name: 'query',
  description: 'Query a collection with advanced filtering',
  usage:
    'query <collection> [--path <path>] [query] [--limit <n>] [--sort <field>] [--fields <fields>]',
  examples: [
    'query users --path ./my-db',
    'query users ./my-db \'{"age": {"$gte": 25}}\'',
    'query products ./my-db \'{"category": "electronics"}\' --sort price --limit 10',
  ],
  execute: async (args, options) => {
    const dbPath =
      (typeof options.path === 'string' ? options.path : undefined) ||
      (args[1] && (args[1].startsWith('./') || args[1].startsWith('/')) ? args[1] : undefined) ||
      './monarch-data';

    try {
      // Ensure directory exists
      if (!existsSync(dbPath)) {
        mkdirSync(dbPath, { recursive: true });
      }

      const adapter = new FileSystemAdapter(join(dbPath, 'data.json'));
      const db = new Monarch(adapter);

      // Load existing collections from metadata
      try {
        const metaFile = join(dbPath, '.monarch-meta.json');
        if (existsSync(metaFile)) {
          const metadata = JSON.parse(readFileSync(metaFile, 'utf-8'));
          if (metadata.collections) {
            metadata.collections.forEach((name: string) => {
              if (!db.getCollection(name)) {
                db.addCollection(name);
              }
            });
          }
        }
      } catch {
        // Ignore metadata loading errors
      }

      // Load data from file
      await db.load();

      const collectionName = args[0];

      // If path option is provided, query is args[1], otherwise check args[1] and args[2]
      let queryStr;
      if (typeof options.path === 'string') {
        queryStr = args[1];
      } else {
        // Check if args[1] looks like a query (not a path)
        if (args[1] && !args[1].startsWith('./') && !args[1].startsWith('/')) {
          queryStr = args[1];
        } else if (args[2]) {
          queryStr = args[2];
        }
      }

      if (!collectionName) {
        throw new Error(
          'Collection name required. Usage: query <collection> [--path <path>] [query]'
        );
      }

      const collection = db.getCollection(collectionName);
      if (!collection) {
        throw new Error(`Collection '${collectionName}' does not exist`);
      }

      // Parse query if provided
      let query = {};
      if (queryStr) {
        try {
          query = JSON.parse(queryStr);
        } catch {
          throw new Error(`Invalid query JSON: ${queryStr}`);
        }
      }

      let results = collection.find(query);

      // Apply sorting if specified
      if (typeof options.sort === 'string') {
        const sortField = options.sort;
        results.sort((a, b) => {
          const aVal = a[sortField];
          const bVal = b[sortField];
          if (aVal < bVal) return -1;
          if (aVal > bVal) return 1;
          return 0;
        });
      }

      // Apply limit if specified
      if (typeof options.limit === 'string') {
        const limit = parseInt(options.limit);
        if (!isNaN(limit)) {
          results = results.slice(0, limit);
        }
      }

      // Apply field selection if specified
      if (typeof options.fields === 'string') {
        const fields = options.fields.split(',').map(f => f.trim());
        results = results.map(doc => {
          const filtered: Record<string, unknown> = {};
          fields.forEach(field => {
            if (doc[field] !== undefined) {
              filtered[field] = doc[field];
            }
          });
          return filtered;
        });
      }

      // eslint-disable-next-line no-console
      console.log(`Found ${results.length} document(s):`);
      if (results.length > 0) {
        // eslint-disable-next-line no-console
        console.log(JSON.stringify(results, null, 2));
      }
    } catch (error) {
      // eslint-disable-next-line no-console
      console.error(
        '❌ Failed to query collection:',
        error instanceof Error ? error.message : String(error)
      );
      process.exit(1);
    }
  },
});

registry.register({
  name: 'stats',
  description: 'Show database statistics and collections',
  usage: 'stats [--path <path>] [--detailed]',
  examples: ['stats --path ./my-db', 'stats ./my-db --detailed'],
  execute: async (args, options) => {
    const dbPath =
      (typeof options.path === 'string' ? options.path : undefined) || args[0] || './monarch-data';

    try {
      // Ensure directory exists
      if (!existsSync(dbPath)) {
        mkdirSync(dbPath, { recursive: true });
      }

      const adapter = new FileSystemAdapter(join(dbPath, 'data.json'));
      const db = new Monarch(adapter);

      // Load existing collections from metadata
      try {
        const metaFile = join(dbPath, '.monarch-meta.json');
        if (existsSync(metaFile)) {
          const metadata = JSON.parse(readFileSync(metaFile, 'utf-8'));
          if (metadata.collections) {
            metadata.collections.forEach((name: string) => {
              if (!db.getCollection(name)) {
                db.addCollection(name);
              }
            });
          }
        }
      } catch {
        // Ignore metadata loading errors
      }

      // Load data from file
      await db.load();

      const stats = db.getStats();

      // eslint-disable-next-line no-console
      console.log('Database Statistics:');
      // eslint-disable-next-line no-console
      console.log('  Path:', dbPath);
      // eslint-disable-next-line no-console
      console.log('  Collections:', stats.collectionCount);
      // eslint-disable-next-line no-console
      console.log('  Total Documents:', stats.totalDocuments);

      if (options.detailed) {
        // eslint-disable-next-line no-console
        console.log('\nCollections:');
        // Try to read metadata for collection names
        try {
          const metaFile = join(dbPath, '.monarch-meta.json');
          const metadata = JSON.parse(readFileSync(metaFile, 'utf-8'));
          if (metadata.collections && metadata.collections.length > 0) {
            metadata.collections.forEach((name: string) => {
              const collection = db.getCollection(name);
              const count = collection ? collection.find().length : 0;
              // eslint-disable-next-line no-console
              console.log(`  ${name}: ${count} documents`);
            });
          } else {
            // eslint-disable-next-line no-console
            console.log('  (No collections found)');
          }
        } catch {
          // Metadata not available, show basic info
          // eslint-disable-next-line no-console
          console.log('  (Run detailed stats after creating collections)');
        }
      }
    } catch (error) {
      // eslint-disable-next-line no-console
      console.error(
        '❌ Failed to get database statistics:',
        error instanceof Error ? error.message : String(error)
      );
      process.exit(1);
    }
  },
});

registry.register({
  name: 'collections',
  description: 'List all collections in the database',
  usage: 'collections [--path <path>]',
  examples: ['collections --path ./my-db', 'collections ./my-db'],
  execute: async (args, options) => {
    const dbPath =
      (typeof options.path === 'string' ? options.path : undefined) || args[0] || './monarch-data';

    try {
      // Ensure directory exists
      if (!existsSync(dbPath)) {
        mkdirSync(dbPath, { recursive: true });
      }

      const adapter = new FileSystemAdapter(join(dbPath, 'data.json'));
      const db = new Monarch(adapter);

      // Load existing collections from metadata
      try {
        const metaFile = join(dbPath, '.monarch-meta.json');
        if (existsSync(metaFile)) {
          const metadata = JSON.parse(readFileSync(metaFile, 'utf-8'));
          if (metadata.collections) {
            metadata.collections.forEach((name: string) => {
              if (!db.getCollection(name)) {
                db.addCollection(name);
              }
            });
          }
        }
      } catch {
        // Ignore metadata loading errors
      }

      // eslint-disable-next-line no-console
      console.log('Collections:');

      // Try to read metadata for collection names
      try {
        const metaFile = join(dbPath, '.monarch-meta.json');
        const metadata = JSON.parse(readFileSync(metaFile, 'utf-8'));
        if (metadata.collections && metadata.collections.length > 0) {
          metadata.collections.forEach((name: string) => {
            const collection = db.getCollection(name);
            const count = collection ? collection.find().length : 0;
            // eslint-disable-next-line no-console
            console.log(`  ${name}: ${count} documents`);
          });
        } else {
          // eslint-disable-next-line no-console
          console.log('  (No collections found)');
        }
      } catch {
        // Metadata not available
        // eslint-disable-next-line no-console
        console.log('  (Database not initialized or no collections)');
      }
    } catch (error) {
      // eslint-disable-next-line no-console
      console.error(
        '❌ Failed to list collections:',
        error instanceof Error ? error.message : String(error)
      );
      process.exit(1);
    }
  },
});

registry.register({
  name: 'batch-insert',
  description: 'Insert multiple documents from multiple files',
  usage: 'batch-insert <collection> <file1> [file2...] [--path <path>]',
  examples: [
    'batch-insert users users1.json users2.json --path ./my-db',
    'batch-insert products users1.json users2.json ./my-db',
  ],
  execute: async (args, options) => {
    const collectionName = args[0];
    const dbPath =
      (typeof options.path === 'string' ? options.path : undefined) ||
      args[args.length - 1] ||
      './monarch-data';
    const files = (typeof options.path === 'string' ? options.path : undefined)
      ? args.slice(1)
      : args.slice(1, -1);

    try {
      // Ensure directory exists
      if (!existsSync(dbPath)) {
        mkdirSync(dbPath, { recursive: true });
      }

      const adapter = new FileSystemAdapter(join(dbPath, 'data.json'));
      const db = new Monarch(adapter);

      // Load existing collections from metadata
      try {
        const metaFile = join(dbPath, '.monarch-meta.json');
        if (existsSync(metaFile)) {
          const metadata = JSON.parse(readFileSync(metaFile, 'utf-8'));
          if (metadata.collections) {
            metadata.collections.forEach((name: string) => {
              if (!db.getCollection(name)) {
                db.addCollection(name);
              }
            });
          }
        }
      } catch {
        // Ignore metadata loading errors
      }

      // Load existing data from file
      await db.load();

      if (!collectionName) {
        throw new Error('Collection name required. Usage: batch-insert <collection> <files...>');
      }
      if (files.length === 0) {
        throw new Error('At least one file required. Usage: batch-insert <collection> <files...>');
      }

      const collection = db.getCollection(collectionName);
      if (!collection) {
        throw new Error(
          `Collection '${collectionName}' does not exist. Create it first with: create ${collectionName}`
        );
      }

      let totalInserted = 0;
      for (const filePath of files) {
        try {
          const data = JSON.parse(readFileSync(filePath, 'utf-8'));
          const docs = Array.isArray(data) ? data : [data];
          const inserted = collection.insert(docs);
          totalInserted += inserted?.length || 0;
          // eslint-disable-next-line no-console
          console.log(`✓ ${filePath}: ${inserted?.length || 0} documents`);
        } catch (error) {
          // eslint-disable-next-line no-console
          console.error(
            `❌ ${filePath}: Failed to process - ${error instanceof Error ? error.message : String(error)}`
          );
        }
      }

      // Save the database
      await db.save();

      // eslint-disable-next-line no-console
      console.log(
        `\n✅ Batch insert complete: ${totalInserted} total documents inserted into '${collectionName}'`
      );
    } catch (error) {
      // eslint-disable-next-line no-console
      console.error(
        '❌ Failed to perform batch insert:',
        error instanceof Error ? error.message : String(error)
      );
      process.exit(1);
    }
  },
});

registry.register({
  name: 'help',
  description: 'Show help information',
  usage: 'help [command]',
  examples: ['help', 'help query'],
  // eslint-disable-next-line no-unused-vars
  execute: async (args, _options) => {
    const command = args[0];
    if (command) {
      const cmd = registry.get(command);
      if (cmd) {
        // eslint-disable-next-line no-console
        console.log(`${cmd.name}: ${cmd.description}`);
        if (cmd.usage) {
          // eslint-disable-next-line no-console
          console.log(`Usage: monarch ${cmd.usage}`);
        }
        if (cmd.examples && cmd.examples.length > 0) {
          // eslint-disable-next-line no-console
          console.log('\nExamples:');
          cmd.examples.forEach(example => {
            // eslint-disable-next-line no-console
            console.log(`  monarch ${example}`);
          });
        }
      } else {
        // eslint-disable-next-line no-console
        console.log(`Command '${command}' not found. Available commands:`);
        registry.list().forEach(cmd => {
          // eslint-disable-next-line no-console
          console.log(`  ${cmd.name}`);
        });
      }
    } else {
      // eslint-disable-next-line no-console
      console.log('Monarch Database CLI v1.0.0');
      // eslint-disable-next-line no-console
      console.log('');
      // eslint-disable-next-line no-console
      console.log('Available commands:');
      registry.list().forEach(cmd => {
        // eslint-disable-next-line no-console
        console.log(`  ${cmd.name.padEnd(14)} ${cmd.description}`);
      });
      // eslint-disable-next-line no-console
      console.log('');
      // eslint-disable-next-line no-console
      console.log('Usage: monarch <command> [args] [options]');
      // eslint-disable-next-line no-console
      console.log('Options:');
      // eslint-disable-next-line no-console
      console.log('  --path <path>     Database path (default: ./monarch-data)');
      // eslint-disable-next-line no-console
      console.log('  --help            Show help');
      // eslint-disable-next-line no-console
      console.log('  --limit <n>       Limit query results');
      // eslint-disable-next-line no-console
      console.log('  --sort <field>    Sort results by field');
      // eslint-disable-next-line no-console
      console.log('  --fields <list>   Select specific fields (comma-separated)');
      // eslint-disable-next-line no-console
      console.log('  --detailed        Show detailed statistics');
      // eslint-disable-next-line no-console
      console.log('');
      // eslint-disable-next-line no-console
      console.log('For help on a specific command: monarch help <command>');
    }
  },
});

/**
 * Main CLI entry point
 */
async function main() {
  const args = process.argv.slice(2);

  // Input validation to prevent buffer overflow and malicious input
  if (args.length > 100) {
    // eslint-disable-next-line no-console
    console.error('❌ Too many arguments provided. Maximum allowed: 100');
    process.exit(1);
  }

  // Validate argument lengths (prevent DoS through large arguments)
  const MAX_ARG_LENGTH = 10000; // 10KB per argument
  for (const arg of args) {
    if (typeof arg === 'string' && arg.length > MAX_ARG_LENGTH) {
      // eslint-disable-next-line no-console
      console.error(`❌ Argument too long. Maximum length: ${MAX_ARG_LENGTH} characters`);
      process.exit(1);
    }
  }

  const { positional, options } = parseArgs(args);

  if (positional.length === 0 || options.help) {
    const helpCmd = registry.get('help');
    if (helpCmd) {
      await helpCmd.execute([], options);
    }
    return;
  }

  const commandName = positional[0];
  const command = registry.get(commandName);

  if (!command) {
    // eslint-disable-next-line no-console
    console.error(`❌ Unknown command: "${commandName}"`);
    // eslint-disable-next-line no-console
    console.error('\n💡 Did you mean one of these commands?');
    const availableCommands = registry.list().map(cmd => cmd.name);
    const suggestions = availableCommands.filter(cmd =>
      cmd.includes(commandName) || commandName.includes(cmd)
    ).slice(0, 3); // Limit to top 3 suggestions
    if (suggestions.length > 0) {
      suggestions.forEach(suggestion => {
        // eslint-disable-next-line no-console
        console.error(`   • monarch ${suggestion}`);
      });
    } else {
      // Fallback to showing first few commands
      const firstCommands = availableCommands.slice(0, 3);
      // eslint-disable-next-line no-console
      console.error('   Try one of these popular commands:');
      firstCommands.forEach(cmd => {
        // eslint-disable-next-line no-console
        console.error(`   • monarch ${cmd}`);
      });
    }
    // eslint-disable-next-line no-console
    console.error('\n📖 Run "monarch help" to see all available commands');
    process.exit(1);
  }

  try {
    await command.execute(positional.slice(1), options);
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    // eslint-disable-next-line no-console
    console.error('❌ Error:', errorMessage);

    // Provide helpful suggestions based on error type
    if (errorMessage.includes('Collection') && errorMessage.includes('does not exist')) {
      // eslint-disable-next-line no-console
      console.error('\n💡 Try creating the collection first: monarch create <collection-name>');
    } else if (errorMessage.includes('JSON')) {
      // eslint-disable-next-line no-console
      console.error('\n💡 Check your JSON syntax - use single quotes around the JSON string');
    } else if (errorMessage.includes('not found')) {
      // eslint-disable-next-line no-console
      console.error('\n💡 Make sure the database is initialized: monarch init');
    }

    // eslint-disable-next-line no-console
    console.error('\n📖 For help, run: monarch help');
    process.exit(1);
  }
}

// Run CLI if this is the main module
if (isMainModule()) {
  main().catch(error => {
    // eslint-disable-next-line no-console
    console.error('Fatal error:', error);
    process.exit(1);
  });
}

export { CLIRegistry, registry };
