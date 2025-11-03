#!/usr/bin/env node

/**
 * Monarch CLI Tool
 *
 * Command-line interface for database management, debugging, and operations.
 */

import { Monarch } from '../monarch';
import { FileSystemAdapter } from '../adapters/filesystem';
import { readFileSync, writeFileSync } from 'fs';
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

// Register commands
registry.register({
  name: 'init',
  description: 'Initialize a new Monarch database',
  usage: 'init [path]',
  examples: ['init', 'init ./my-database'],
  execute: async (args) => {
    const dbPath = args[0] || './monarch-data';
    try {
      const adapter = new FileSystemAdapter(dbPath);
      const db = new Monarch({ persistence: adapter });

      // Create metadata file to mark initialization
      const metaFile = join(dbPath, '.monarch-meta.json');
      const metadata = {
        initialized: true,
        createdAt: new Date().toISOString(),
        version: '1.0.0'
      };
      writeFileSync(metaFile, JSON.stringify(metadata, null, 2));

      // eslint-disable-next-line no-console
      console.log(`✓ Database initialized at ${dbPath}`);
      const stats = db.getStats();
      // eslint-disable-next-line no-console
      console.log('  Collections:', stats.collectionCount);
    } catch (error) {
      // eslint-disable-next-line no-console
      console.error('❌ Failed to initialize database:', error.message);
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
      const adapter = new FileSystemAdapter(dbPath);
      const db = new Monarch({ persistence: adapter });

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
      console.error('❌ Failed to create collection:', error.message);
      process.exit(1);
    }
  }
});

registry.register({
  name: 'insert',
  description: 'Insert documents into a collection',
  usage: 'insert <collection> <file> [--path <path>]',
  examples: ['insert users data.json', 'insert products batch.json --path ./my-db'],
  execute: async (args, options) => {
    const dbPath = (typeof options.path === 'string' ? options.path : undefined) || './monarch-data';

    try {
      const adapter = new FileSystemAdapter(dbPath);
      const db = new Monarch({ persistence: adapter });

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
      console.error('❌ Failed to insert documents:', error.message);
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

/**
 * Main CLI entry point
 */
async function main() {
  const args = process.argv.slice(2);
  
  if (args.length === 0 || args[0] === '--help' || args[0] === '-h') {
    const helpCmd = registry.get('help');
    if (helpCmd) {
      await helpCmd.execute([], {});
    }
    return;
  }

  const commandName = args[0];
  const command = registry.get(commandName);

  if (!command) {
    // eslint-disable-next-line no-console
    console.error(`Unknown command: ${commandName}`);
    // eslint-disable-next-line no-console
    console.error(`Run 'monarch help' for available commands`);
    process.exit(1);
  }

  // Parse options
  const options: Record<string, unknown> = {};
  const commandArgs: string[] = [];

  for (let i = 1; i < args.length; i++) {
    if (args[i].startsWith('--')) {
      const key = args[i].substring(2);
      const value = args[i + 1];
      if (value && !value.startsWith('--')) {
        options[key] = value;
        i++;
      } else {
        options[key] = true;
      }
    } else {
      commandArgs.push(args[i]);
    }
  }

  try {
    await command.execute(commandArgs, options);
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error(`Error: ${(error as Error).message}`);
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

