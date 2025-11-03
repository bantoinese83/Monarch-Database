#!/usr/bin/env node

/**
 * Monarch CLI Tool
 *
 * Command-line interface for database management, debugging, and operations.
 */

import { Monarch } from '../monarch';
import { FileSystemAdapter } from '../adapters/filesystem';
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'fs';
import { join } from 'path';

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
  execute: async (args) => {
    const dbPath = args[0] || './monarch-data';
    try {
      // Ensure directory exists
      if (!existsSync(dbPath)) {
        mkdirSync(dbPath, { recursive: true });
      }

      const adapter = new FileSystemAdapter(dbPath);
      const db = new Monarch(adapter);

      // Create metadata file to mark initialization
      const metaFile = join(dbPath, '.monarch-meta.json');
      const metadata = {
        initialized: true,
        createdAt: new Date().toISOString(),
        version: '1.0.0',
        collections: []
      };
      writeFileSync(metaFile, JSON.stringify(metadata, null, 2));

      // eslint-disable-next-line no-console
      console.log(`✓ Database initialized at ${dbPath}`);
      const stats = db.getStats();
      // eslint-disable-next-line no-console
      console.log('  Collections:', stats.collectionCount);
    } catch (error) {
      // eslint-disable-next-line no-console
      console.error('❌ Failed to initialize database:', error instanceof Error ? error.message : String(error));
      process.exit(1);
    }
  }
});

registry.register({
  name: 'create',
  description: 'Create a new collection',
  usage: 'create <collection> [--path <path>]',
  examples: ['create users', 'create products --path ./my-db'],
  execute: async (args, options) => {
    const dbPath = (typeof options.path === 'string' ? options.path : undefined) || './monarch-data';
    try {
      // Ensure directory exists
      if (!existsSync(dbPath)) {
        mkdirSync(dbPath, { recursive: true });
      }

      const adapter = new FileSystemAdapter(dbPath);
      const db = new Monarch(adapter);

      if (!args[0]) {
        throw new Error('Collection name required. Usage: create <collection>');
      }

      const collectionName = args[0];
      db.addCollection(collectionName);

      // Save collection metadata
      const metaFile = join(dbPath, '.monarch-meta.json');
      try {
        const metadata = JSON.parse(readFileSync(metaFile, 'utf-8'));
        metadata.collections = metadata.collections || [];
        if (!metadata.collections.includes(collectionName)) {
          metadata.collections.push(collectionName);
        }
        writeFileSync(metaFile, JSON.stringify(metadata, null, 2));
      } catch (e) {
        // Metadata file doesn't exist or is corrupted, recreate
        const metadata = {
          initialized: true,
          createdAt: new Date().toISOString(),
          version: '1.0.0',
          collections: [collectionName]
        };
        writeFileSync(metaFile, JSON.stringify(metadata, null, 2));
      }

      // eslint-disable-next-line no-console
      console.log(`✓ Collection '${collectionName}' created`);
    } catch (error) {
      // eslint-disable-next-line no-console
      console.error('❌ Failed to create collection:', error instanceof Error ? error.message : String(error));
      process.exit(1);
    }
  }
});

registry.register({
  name: 'insert',
  description: 'Insert documents into a collection',
  usage: 'insert <collection> <file> --path <path>',
  examples: ['insert users data.json --path ./my-db', 'insert products batch.json --path ./data'],
  execute: async (args, options) => {
    const dbPath = (typeof options.path === 'string' ? options.path : undefined) || './monarch-data';

    try {
      // Ensure directory exists
      if (!existsSync(dbPath)) {
        mkdirSync(dbPath, { recursive: true });
      }

      const adapter = new FileSystemAdapter(dbPath);
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
        throw new Error(`Collection '${collectionName}' does not exist. Create it first with: create ${collectionName}`);
      }

      const data = JSON.parse(readFileSync(filePath, 'utf-8'));
      const docs = Array.isArray(data) ? data : [data];
      const inserted = collection.insert(docs);

      // eslint-disable-next-line no-console
      console.log(`✓ Inserted ${inserted?.length || 0} document(s) into '${collectionName}'`);
    } catch (error) {
      // eslint-disable-next-line no-console
      console.error('❌ Failed to insert documents:', error instanceof Error ? error.message : String(error));
      process.exit(1);
    }
  }
});

registry.register({
  name: 'query',
  description: 'Query a collection',
  execute: async (args, options) => {
    const dbPath = (typeof options.path === 'string' ? options.path : undefined) || './monarch-data';
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
  }
});

registry.register({
  name: 'stats',
  description: 'Show database statistics',
  execute: async (args, options) => {
    const dbPath = (typeof options.path === 'string' ? options.path : undefined) || './monarch-data';
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
  }
});

registry.register({
  name: 'help',
  description: 'Show help information',
  execute: async () => {
    // eslint-disable-next-line no-console
    console.log('Monarch Database CLI\n');
    // eslint-disable-next-line no-console
    console.log('Available commands:\n');
    
    for (const command of registry.list()) {
      // eslint-disable-next-line no-console
      console.log(`  ${command.name.padEnd(15)} ${command.description}`);
    }
    
    // eslint-disable-next-line no-console
    console.log('\nUsage: monarch <command> [args] [options]');
    // eslint-disable-next-line no-console
    console.log('Options:');
    // eslint-disable-next-line no-console
    console.log('  --path <path>    Database path (default: ./monarch-data)');
    // eslint-disable-next-line no-console
    console.log('  --help           Show help');
  }
});

// Register commands
registry.register({
  name: 'init',
  description: 'Initialize a new Monarch database',
  usage: 'init [path]',
  examples: ['init', 'init ./my-database'],
  execute: async (args) => {
    const dbPath = args[0] || './monarch-data';
    try {
      // Ensure directory exists
      if (!existsSync(dbPath)) {
        mkdirSync(dbPath, { recursive: true });
      }

      const adapter = new FileSystemAdapter(dbPath);
      const db = new Monarch(adapter);

      // Create metadata file to mark initialization
      const metaFile = join(dbPath, '.monarch-meta.json');
      const metadata = {
        initialized: true,
        createdAt: new Date().toISOString(),
        version: '1.0.0',
        collections: []
      };
      writeFileSync(metaFile, JSON.stringify(metadata, null, 2));

      // eslint-disable-next-line no-console
      console.log(`✓ Database initialized at ${dbPath}`);
      const stats = db.getStats();
      // eslint-disable-next-line no-console
      console.log('  Collections:', stats.collectionCount);
    } catch (error) {
      // eslint-disable-next-line no-console
      console.error('❌ Failed to initialize database:', error instanceof Error ? error.message : String(error));
      process.exit(1);
    }
  }
});

registry.register({
  name: 'create',
  description: 'Create a new collection',
  usage: 'create <collection> [--path <path>]',
  examples: ['create users --path ./my-db', 'create products ./my-db'],
  execute: async (args, options) => {
    const dbPath = (typeof options.path === 'string' ? options.path : undefined) || args[1] || './monarch-data';
    try {
      // Ensure directory exists
      if (!existsSync(dbPath)) {
        mkdirSync(dbPath, { recursive: true });
      }

      const adapter = new FileSystemAdapter(dbPath);
      const db = new Monarch(adapter);

      if (!args[0]) {
        throw new Error('Collection name required. Usage: create <collection>');
      }

      const collectionName = args[0];
      db.addCollection(collectionName);

      // Save collection metadata
      const metaFile = join(dbPath, '.monarch-meta.json');
      try {
        const metadata = JSON.parse(readFileSync(metaFile, 'utf-8'));
        metadata.collections = metadata.collections || [];
        if (!metadata.collections.includes(collectionName)) {
          metadata.collections.push(collectionName);
        }
        writeFileSync(metaFile, JSON.stringify(metadata, null, 2));
      } catch (e) {
        // Metadata file doesn't exist or is corrupted, recreate
        const metadata = {
          initialized: true,
          createdAt: new Date().toISOString(),
          version: '1.0.0',
          collections: [collectionName]
        };
        writeFileSync(metaFile, JSON.stringify(metadata, null, 2));
      }

      // eslint-disable-next-line no-console
      console.log(`✓ Collection '${collectionName}' created`);
    } catch (error) {
      // eslint-disable-next-line no-console
      console.error('❌ Failed to create collection:', error instanceof Error ? error.message : String(error));
      process.exit(1);
    }
  }
});

registry.register({
  name: 'insert',
  description: 'Insert documents into a collection',
  usage: 'insert <collection> <file> --path <path>',
  examples: ['insert users data.json --path ./my-db', 'insert products batch.json --path ./data'],
  execute: async (args, options) => {
    const dbPath = (typeof options.path === 'string' ? options.path : undefined) || './monarch-data';

    try {
      // Ensure directory exists
      if (!existsSync(dbPath)) {
        mkdirSync(dbPath, { recursive: true });
      }

      const adapter = new FileSystemAdapter(dbPath);
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
        throw new Error(`Collection '${collectionName}' does not exist. Create it first with: create ${collectionName}`);
      }

      const data = JSON.parse(readFileSync(filePath, 'utf-8'));
      const docs = Array.isArray(data) ? data : [data];
      const inserted = collection.insert(docs);

      // eslint-disable-next-line no-console
      console.log(`✓ Inserted ${inserted?.length || 0} document(s) into '${collectionName}'`);
    } catch (error) {
      // eslint-disable-next-line no-console
      console.error('❌ Failed to insert documents:', error instanceof Error ? error.message : String(error));
      process.exit(1);
    }
  }
});

registry.register({
  name: 'query',
  description: 'Query a collection with advanced filtering',
  usage: 'query <collection> [--path <path>] [query] [--limit <n>] [--sort <field>] [--fields <fields>]',
  examples: [
    'query users --path ./my-db',
    'query users ./my-db \'{"age": {"$gte": 25}}\'',
    'query products ./my-db \'{"category": "electronics"}\' --sort price --limit 10'
  ],
  execute: async (args, options) => {
    const dbPath = (typeof options.path === 'string' ? options.path : undefined) || args[1] || './monarch-data';

    try {
      // Ensure directory exists
      if (!existsSync(dbPath)) {
        mkdirSync(dbPath, { recursive: true });
      }

      const adapter = new FileSystemAdapter(dbPath);
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
      } catch (e) {
        // Ignore metadata loading errors
      }

      const collectionName = args[0];
      const dbPath = (typeof options.path === 'string' ? options.path : undefined) || args[2] || './monarch-data';
      const queryStr = (typeof options.path === 'string' ? options.path : undefined) ? args[1] : (args[1] && !args[1].startsWith('./') ? args[1] : undefined);

      if (!collectionName) {
        throw new Error('Collection name required. Usage: query <collection> [--path <path>] [query]');
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
        } catch (e) {
          throw new Error(`Invalid query JSON: ${queryStr}`);
        }
      }

      let results = collection.find(query);

      // Apply sorting if specified
      if (typeof options.sort === 'string') {
        results.sort((a, b) => {
          const aVal = a[options.sort];
          const bVal = b[options.sort];
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
          const filtered: any = {};
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
      console.error('❌ Failed to query collection:', error instanceof Error ? error.message : String(error));
      process.exit(1);
    }
  }
});

registry.register({
  name: 'stats',
  description: 'Show database statistics and collections',
  usage: 'stats [--path <path>] [--detailed]',
  examples: ['stats --path ./my-db', 'stats ./my-db --detailed'],
  execute: async (args, options) => {
    const dbPath = (typeof options.path === 'string' ? options.path : undefined) || args[0] || './monarch-data';

    try {
      // Ensure directory exists
      if (!existsSync(dbPath)) {
        mkdirSync(dbPath, { recursive: true });
      }

      const adapter = new FileSystemAdapter(dbPath);
      const db = new Monarch(adapter);

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
        } catch (e) {
          // Metadata not available, show basic info
          // eslint-disable-next-line no-console
          console.log('  (Run detailed stats after creating collections)');
        }
      }
    } catch (error) {
      // eslint-disable-next-line no-console
      console.error('❌ Failed to get database statistics:', error instanceof Error ? error.message : String(error));
      process.exit(1);
    }
  }
});

registry.register({
  name: 'collections',
  description: 'List all collections in the database',
  usage: 'collections [--path <path>]',
  examples: ['collections --path ./my-db', 'collections ./my-db'],
  execute: async (args, options) => {
    const dbPath = (typeof options.path === 'string' ? options.path : undefined) || args[0] || './monarch-data';

    try {
      // Ensure directory exists
      if (!existsSync(dbPath)) {
        mkdirSync(dbPath, { recursive: true });
      }

      const adapter = new FileSystemAdapter(dbPath);
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
      } catch (e) {
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
      } catch (e) {
        // Metadata not available
        // eslint-disable-next-line no-console
        console.log('  (Database not initialized or no collections)');
      }
    } catch (error) {
      // eslint-disable-next-line no-console
      console.error('❌ Failed to list collections:', error instanceof Error ? error.message : String(error));
      process.exit(1);
    }
  }
});

registry.register({
  name: 'batch-insert',
  description: 'Insert multiple documents from multiple files',
  usage: 'batch-insert <collection> <file1> [file2...] [--path <path>]',
  examples: ['batch-insert users users1.json users2.json --path ./my-db', 'batch-insert products users1.json users2.json ./my-db'],
  execute: async (args, options) => {
    const dbPath = (typeof options.path === 'string' ? options.path : undefined) || args[args.length - 1] || './monarch-data';

    try {
      // Ensure directory exists
      if (!existsSync(dbPath)) {
        mkdirSync(dbPath, { recursive: true });
      }

      const adapter = new FileSystemAdapter(dbPath);
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
      } catch (e) {
        // Ignore metadata loading errors
      }

      const collectionName = args[0];
      const dbPath = (typeof options.path === 'string' ? options.path : undefined) || args[args.length - 1] || './monarch-data';
      const files = (typeof options.path === 'string' ? options.path : undefined) ?
        args.slice(1, -1) : args.slice(1, -1);

      if (!collectionName) {
        throw new Error('Collection name required. Usage: batch-insert <collection> <files...>');
      }
      if (files.length === 0) {
        throw new Error('At least one file required. Usage: batch-insert <collection> <files...>');
      }

      const collection = db.getCollection(collectionName);
      if (!collection) {
        throw new Error(`Collection '${collectionName}' does not exist. Create it first with: create ${collectionName}`);
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
          console.error(`❌ ${filePath}: Failed to process - ${error instanceof Error ? error.message : String(error)}`);
        }
      }

      // eslint-disable-next-line no-console
      console.log(`\n✅ Batch insert complete: ${totalInserted} total documents inserted into '${collectionName}'`);
    } catch (error) {
      // eslint-disable-next-line no-console
      console.error('❌ Failed to perform batch insert:', error instanceof Error ? error.message : String(error));
      process.exit(1);
    }
  }
});

registry.register({
  name: 'help',
  description: 'Show help information',
  usage: 'help [command]',
  examples: ['help', 'help query'],
  execute: async (args, options) => {
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
  }
});

/**
 * Main CLI entry point
 */
async function main() {
  const { positional, options } = parseArgs(process.argv.slice(2));

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
    console.error(`❌ Unknown command: ${commandName}`);
    // eslint-disable-next-line no-console
    console.error('Run "monarch help" to see available commands');
    process.exit(1);
  }

  try {
    await command.execute(positional.slice(1), options);
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error('❌ Error:', error instanceof Error ? error.message : String(error));
    // eslint-disable-next-line no-console
    console.error('Run "monarch help" for usage information');
    process.exit(1);
  }
}

// Run CLI if this is the main module
if (require.main === module) {
  main().catch(error => {
    // eslint-disable-next-line no-console
    console.error('Fatal error:', error);
    process.exit(1);
  });
}

export { CLIRegistry, registry };

