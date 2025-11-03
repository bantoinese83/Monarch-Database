# Getting Started with Monarch Database

Welcome to Monarch! This guide will help you get up and running with the fastest in-memory database for JavaScript.

## Prerequisites

- Node.js 16+ or modern browser
- npm, yarn, or pnpm

## Installation

### NPM
```bash
npm install monarch-database
```

### Yarn
```bash
yarn add monarch-database
```

### PNPM
```bash
pnpm add monarch-database
```

### CDN (Browser)
```html
<script src="https://cdn.jsdelivr.net/npm/monarch-database@latest/dist/monarch.min.js"></script>
```

## Your First Database

### Basic Setup

```javascript
import { Monarch } from 'monarch-database';

// Create a database instance
const db = new Monarch();

// Optional: Configure persistence
const db = new Monarch({
  adapter: new FileSystemAdapter('./data')
});
```

### Creating Collections

```javascript
// Create a users collection
const users = db.addCollection('users');

// Collections are automatically created when you first access them
// No need for explicit schema definitions (but you can add them!)
```

### Basic CRUD Operations

#### Create (Insert)

```javascript
// Insert a single document
const userId = await users.insert({
  name: 'Alice Johnson',
  email: 'alice@example.com',
  age: 28,
  department: 'Engineering',
  skills: ['JavaScript', 'TypeScript', 'React']
});

console.log('Inserted user with ID:', userId);
```

#### Read (Find)

```javascript
// Find all users
const allUsers = await users.find({});
console.log('All users:', allUsers);

// Find users by criteria
const engineers = await users.find({ department: 'Engineering' });
console.log('Engineers:', engineers);

// Find one user
const alice = await users.findOne({ name: 'Alice Johnson' });
console.log('Alice:', alice);

// Advanced queries
const youngEngineers = await users.find({
  department: 'Engineering',
  age: { $lt: 30 }
});
console.log('Young engineers:', youngEngineers);
```

#### Update

```javascript
// Update a single user
const updatedCount = await users.update(
  { name: 'Alice Johnson' },
  {
    $set: { title: 'Senior Engineer' },
    $push: { skills: 'Node.js' }
  }
);

console.log('Updated', updatedCount, 'user(s)');
```

#### Delete (Remove)

```javascript
// Remove users
const removedCount = await users.remove({ department: 'HR' });
console.log('Removed', removedCount, 'user(s)');
```

## Working with Data Structures

Monarch supports rich data structures like Redis, but with advanced querying.

### Lists (Like Redis Lists)

```javascript
// Push items to a list
await db.lpush('notifications', 'Welcome to Monarch!');
await db.lpush('notifications', 'Check out our docs');

// Pop items from a list
const latest = await db.lpop('notifications'); // 'Check out our docs'
const oldest = await db.rpop('notifications'); // 'Welcome to Monarch!'

// Get range of items
const all = await db.lrange('notifications', 0, -1);

// Get list length
const length = await db.llen('notifications');
```

### Sets (Like Redis Sets)

```javascript
// Add items to a set
await db.sadd('user-tags', 'javascript', 'typescript', 'react');

// Check membership
const hasJS = await db.sismember('user-tags', 'javascript'); // true
const hasPython = await db.sismember('user-tags', 'python'); // false

// Get all members
const tags = await db.smembers('user-tags');

// Set operations
await db.sadd('frontend-tags', 'react', 'vue', 'angular');
await db.sadd('backend-tags', 'nodejs', 'python', 'java');

// Union of sets
const allTags = await db.sunion('user-tags', 'frontend-tags', 'backend-tags');

// Intersection
const commonTags = await db.sinter('user-tags', 'frontend-tags');
```

### Hashes (Like Redis Hashes)

```javascript
// Set hash fields
await db.hset('user:123', 'name', 'Alice');
await db.hset('user:123', 'email', 'alice@example.com');

// Get hash fields
const name = await db.hget('user:123', 'name');
const email = await db.hget('user:123', 'email');

// Get all fields
const user = await db.hgetall('user:123');

// Get specific fields
const keys = await db.hkeys('user:123');
const values = await db.hvals('user:123');
```

### Sorted Sets (Like Redis Sorted Sets)

```javascript
// Add scored members
await db.zadd('leaderboard', {
  'alice': 1500,
  'bob': 1200,
  'charlie': 1800,
  'diana': 1350
});

// Get ranking
const topPlayers = await db.zrange('leaderboard', 0, 2); // ['charlie', 'alice', 'diana']
const scores = await db.zrevrange('leaderboard', 0, 2, true); // With scores

// Get score for specific member
const aliceScore = await db.zscore('leaderboard', 'alice'); // 1500
```

## Vector Search for AI Workloads

Monarch has built-in vector search for AI and machine learning applications.

```javascript
// Add vectors (embeddings)
await db.vadd('documents', 'doc1', [0.1, 0.2, 0.3, 0.4, 0.5], {
  title: 'Introduction to Monarch',
  category: 'documentation'
});

await db.vadd('documents', 'doc2', [0.2, 0.3, 0.4, 0.5, 0.6], {
  title: 'Advanced Queries',
  category: 'tutorial'
});

// Search for similar vectors
const queryVector = [0.15, 0.25, 0.35, 0.45, 0.55];
const similar = await db.vsearch('documents', queryVector, 5);

console.log('Similar documents:');
similar.forEach(result => {
  console.log(`- ${result.id}: similarity ${result.score.toFixed(3)}`);
  console.log(`  Metadata: ${JSON.stringify(result.metadata)}`);
});
```

## Indexing for Performance

Create indexes to speed up queries.

```javascript
// Create a single-field index
await users.createIndex('email');
await users.createIndex('department');

// Create a compound index (for complex queries)
await users.createIndex(['department', 'age']);

// Now queries on these fields will be much faster!
const engineers = await users.find({ department: 'Engineering' }); // Uses index
```

## Real-Time Features

### Change Streams

Listen for changes to your data in real-time.

```javascript
// Watch a collection for changes
db.watch('users', (change) => {
  console.log('Change detected:', change.type);
  console.log('Document:', change.document);
  console.log('Timestamp:', new Date(change.timestamp));
});

// Watch specific operations
db.watch('products', (change) => {
  if (change.type === 'insert') {
    console.log('New product added:', change.document.name);
  }
});
```

### Transactions

Execute multiple operations atomically.

```javascript
// Start a transaction
const transactionId = db.beginTransaction();

// Add operations to the transaction
db.addToTransaction(transactionId, 'users', 'update',
  { name: 'Alice' }, { $set: { status: 'active' } }
);

db.addToTransaction(transactionId, 'orders', 'insert', {
  userId: 'alice-id',
  amount: 99.99,
  status: 'pending'
});

// Commit the transaction (all operations succeed or all fail)
try {
  db.commitTransaction(transactionId);
  console.log('Transaction committed successfully');
} catch (error) {
  console.log('Transaction failed:', error.message);
  // All operations were rolled back
}
```

## Schema Validation

Add optional JSON Schema validation to your collections.

```javascript
// Define a schema
const userSchema = {
  type: 'object',
  properties: {
    name: { type: 'string', minLength: 2 },
    email: { type: 'string', format: 'email' },
    age: { type: 'number', minimum: 0, maximum: 150 }
  },
  required: ['name', 'email']
};

// Set schema for collection
db.setSchema('users', userSchema);

// Now all inserts/updates will be validated
try {
  await users.insert({
    name: 'A', // Too short!
    email: 'invalid-email', // Invalid format!
    age: -5 // Negative age!
  });
} catch (error) {
  console.log('Validation error:', error.message);
  // Document was not inserted
}
```

## Persistence

By default, Monarch runs in-memory only. Add persistence for durability.

```javascript
import { FileSystemAdapter } from 'monarch-database';

// Node.js: File system persistence
const db = new Monarch({
  adapter: new FileSystemAdapter('./data')
});

// Browser: IndexedDB persistence
import { IndexedDBAdapter } from 'monarch-database';
const db = new Monarch({
  adapter: new IndexedDBAdapter('myapp-db')
});

// Load existing data
await db.load();

// Save current state
await db.save();
```

## Configuration

Customize Monarch for your needs.

```javascript
const db = new Monarch({
  config: {
    limits: {
      maxDocumentSize: 10 * 1024 * 1024, // 10MB per document
      maxDocumentsPerCollection: 100000,
      maxQueryDepth: 5
    },
    performance: {
      maxConcurrentOperations: 100,
      queryCacheSize: 1000,
      queryCacheTTL: 300000 // 5 minutes
    },
    security: {
      sessionTimeout: 24 * 60 * 60 * 1000, // 24 hours
      maxLoginAttempts: 5
    }
  }
});
```

## Error Handling

Monarch provides structured error handling.

```javascript
try {
  await users.insert({ invalid: 'data' });
} catch (error) {
  if (error instanceof ValidationError) {
    console.log('Validation failed:', error.message);
  } else if (error instanceof ResourceLimitError) {
    console.log('Resource limit exceeded:', error.message);
  } else {
    console.log('Unexpected error:', error.message);
  }
}
```

## Next Steps

Now that you have the basics, explore:

- **[API Reference](api-reference.md)** - Complete API documentation
- **[Data Structures Guide](data-structures.md)** - Advanced Redis-style operations
- **[Query Guide](queries.md)** - Complex querying and aggregation
- **[Vector Search](vector-search.md)** - AI and semantic search capabilities
- **[Performance Tuning](performance.md)** - Optimization and benchmarking
- **[Examples](../examples/)** - Real-world usage examples

Happy coding with Monarch! 🚀
