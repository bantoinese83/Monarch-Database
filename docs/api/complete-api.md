# Complete API Documentation

Full API reference for Monarch Database.

## Health & Monitoring

### GET /health
Returns overall health status.

**Response:**
```json
{
  "status": "healthy",
  "timestamp": "2024-01-15T10:30:00.000Z",
  "uptime": 3600000,
  "version": "1.0.0"
}
```

### GET /ready
Returns readiness status (for Kubernetes).

**Response:**
```json
{
  "ready": true,
  "checks": {
    "database": true,
    "memory": true,
    "disk": true
  },
  "timestamp": "2024-01-15T10:30:00.000Z"
}
```

### GET /live
Returns liveness status.

**Response:**
```json
{
  "alive": true,
  "timestamp": "2024-01-15T10:30:00.000Z"
}
```

### GET /metrics
Returns Prometheus metrics.

**Response:** Text format (Prometheus)

## Collections

### createCollection(name: string)
Create a new collection.

**Parameters:**
- `name` (string): Collection name

**Returns:** `Collection`

**Example:**
```typescript
const users = db.addCollection('users');
```

### insert(document: Document)
Insert documents.

**Parameters:**
- `document` (Document): Document(s) to insert

**Returns:** `Promise<Document[]>`

**Example:**
```typescript
await users.insert({ name: 'Alice', age: 30 });
```

### find(query?: Query, options?: FindOptions)
Find documents.

**Parameters:**
- `query` (Query, optional): MongoDB-style query
- `options` (FindOptions, optional): Limit, skip, etc.

**Returns:** `Promise<Document[]>`

**Example:**
```typescript
const adults = await users.find({ age: { $gte: 18 } }, { limit: 10 });
```

### update(query: Query, changes: UpdateOperation)
Update documents.

**Parameters:**
- `query` (Query): Query to match documents
- `changes` (UpdateOperation): Update operations

**Returns:** `Promise<number>` (count of updated documents)

**Example:**
```typescript
await users.update(
  { name: 'Alice' },
  { $set: { department: 'Engineering' } }
);
```

### remove(query: Query)
Remove documents.

**Parameters:**
- `query` (Query): Query to match documents

**Returns:** `Promise<number>` (count of removed documents)

## Data Structures

### Lists

```typescript
// Push to left
await db.lpush('queue', 'item1', 'item2');

// Pop from left
const item = await db.lpop('queue');

// Get range
const items = await db.lrange('queue', 0, 10);
```

### Sets

```typescript
// Add members
await db.sadd('tags', 'javascript', 'typescript');

// Check membership
const hasTag = await db.sismember('tags', 'javascript');

// Get all members
const allTags = await db.smembers('tags');
```

### Hashes

```typescript
// Set field
await db.hset('user:123', 'name', 'Alice');

// Get field
const name = await db.hget('user:123', 'name');

// Get all
const user = await db.hgetall('user:123');
```

### Sorted Sets

```typescript
// Add with scores
await db.zadd('leaderboard', { 'Alice': 1500, 'Bob': 1200 });

// Get range
const topPlayers = await db.zrange('leaderboard', 0, 9);

// Get score
const score = await db.zscore('leaderboard', 'Alice');
```

## Vector Search

```typescript
// Add vector
await db.vadd('embeddings', 'doc1', [0.1, 0.2, 0.3]);

// Search
const results = await db.vsearch('embeddings', [0.15, 0.25, 0.35], 10);

// Results include similarity scores
results.forEach(result => {
  console.log(result.id, result.score);
});
```

## Transactions

```typescript
const transaction = await db.beginTransaction({
  isolation: 'read-committed'
});

try {
  await transaction.insert('users', { name: 'Alice' });
  await transaction.update('users', { name: 'Alice' }, { $set: { verified: true } });
  await transaction.commit();
} catch (error) {
  await transaction.rollback();
}
```

## Change Streams

```typescript
const listenerId = db.watch('users', (change) => {
  console.log('Change:', change.type, change.document);
});
```

## Error Handling

All operations throw `MonarchError` or specific error types:

- `ValidationError`: Invalid input
- `ResourceLimitError`: Resource limits exceeded
- `SecurityError`: Security violations
- `PerformanceError`: Performance issues

```typescript
try {
  await users.insert(invalidDoc);
} catch (error) {
  if (error instanceof ValidationError) {
    console.error('Validation failed:', error.message);
  }
}
```

