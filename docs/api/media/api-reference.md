# Monarch Database API Reference

This document provides comprehensive API documentation for the Monarch database.

## Table of Contents

- [Monarch Class](#monarch-class)
- [Collection Class](#collection-class)
- [Data Structures](#data-structures)
- [Query Operators](#query-operators)
- [Error Types](#error-types)
- [Configuration](#configuration)
- [Types](#types)

## Monarch Class

The main database class that coordinates all operations.

### Constructor

```typescript
new Monarch(adapter?: PersistenceAdapter, config?: DatabaseConfig)
```

**Parameters:**
- `adapter` (optional): Persistence adapter for data storage
- `config` (optional): Database configuration

**Example:**
```javascript
const db = new Monarch();
const db = new Monarch(new FileSystemAdapter('./data'));
```

### Collection Management

#### `addCollection(name: string): Collection`

Creates and returns a new collection.

**Parameters:**
- `name`: Collection name (must be valid identifier)

**Returns:** Collection instance

**Example:**
```javascript
const users = db.addCollection('users');
```

#### `getCollection(name: string): Collection | null`

Retrieves an existing collection.

**Parameters:**
- `name`: Collection name

**Returns:** Collection instance or null

#### `dropCollection(name: string): boolean`

Deletes a collection and all its data.

**Parameters:**
- `name`: Collection name

**Returns:** true if collection was deleted

#### `listCollections(): string[]`

Returns list of all collection names.

**Returns:** Array of collection names

### Data Operations

#### `insert(collectionName: string, document: any): Promise<string>`

Inserts a document into a collection.

**Parameters:**
- `collectionName`: Target collection name
- `document`: Document to insert

**Returns:** Generated document ID

#### `find(collectionName: string, query?: Query, options?: FindOptions): Promise<any[]>`

Finds documents matching a query.

**Parameters:**
- `collectionName`: Collection to search
- `query`: Query object (optional)
- `options`: Query options (limit, skip, sort)

**Returns:** Array of matching documents

#### `findOne(collectionName: string, query: Query): Promise<any | null>`

Finds the first document matching a query.

**Parameters:**
- `collectionName`: Collection to search
- `query`: Query object

**Returns:** First matching document or null

#### `update(collectionName: string, query: Query, changes: UpdateOperation): Promise<number>`

Updates documents matching a query.

**Parameters:**
- `collectionName`: Collection to update
- `query`: Query to match documents
- `changes`: Update operations

**Returns:** Number of documents updated

#### `remove(collectionName: string, query: Query): Promise<number>`

Removes documents matching a query.

**Parameters:**
- `collectionName`: Collection to modify
- `query`: Query to match documents

**Returns:** Number of documents removed

#### `count(collectionName: string, query?: Query): Promise<number>`

Counts documents matching a query.

**Parameters:**
- `collectionName`: Collection to count
- `query`: Query object (optional)

**Returns:** Number of matching documents

#### `distinct(collectionName: string, field: string, query?: Query): Promise<any[]>`

Returns distinct values for a field.

**Parameters:**
- `collectionName`: Collection to query
- `field`: Field name
- `query`: Optional filter query

**Returns:** Array of distinct values

### Data Structures (Redis-compatible)

#### List Operations

##### `lpush(key: string, values: any[]): Promise<number>`

Prepends values to a list.

**Parameters:**
- `key`: List key
- `values`: Values to prepend

**Returns:** New list length

##### `rpush(key: string, values: any[]): Promise<number>`

Appends values to a list.

**Parameters:**
- `key`: List key
- `values`: Values to append

**Returns:** New list length

##### `lpop(key: string): Promise<any>`

Removes and returns the first element of a list.

**Parameters:**
- `key`: List key

**Returns:** Removed element or null

##### `rpop(key: string): Promise<any>`

Removes and returns the last element of a list.

**Parameters:**
- `key`: List key

**Returns:** Removed element or null

##### `lrange(key: string, start: number, end: number): Promise<any[]>`

Returns a range of elements from a list.

**Parameters:**
- `key`: List key
- `start`: Start index (0-based)
- `end`: End index (-1 for last element)

**Returns:** Array of elements

##### `llen(key: string): Promise<number>`

Returns the length of a list.

**Parameters:**
- `key`: List key

**Returns:** List length

#### Set Operations

##### `sadd(key: string, members: any[]): Promise<number>`

Adds members to a set.

**Parameters:**
- `key`: Set key
- `members`: Members to add

**Returns:** Number of members added

##### `srem(key: string, members: any[]): Promise<number>`

Removes members from a set.

**Parameters:**
- `key`: Set key
- `members`: Members to remove

**Returns:** Number of members removed

##### `smembers(key: string): Promise<any[]>`

Returns all members of a set.

**Parameters:**
- `key`: Set key

**Returns:** Array of set members

##### `sismember(key: string, member: any): Promise<boolean>`

Checks if a member exists in a set.

**Parameters:**
- `key`: Set key
- `member`: Member to check

**Returns:** true if member exists

##### `scard(key: string): Promise<number>`

Returns the size of a set.

**Parameters:**
- `key`: Set key

**Returns:** Set size

##### `sdiff(keys: string[]): Promise<any[]>`

Returns the difference of multiple sets.

**Parameters:**
- `keys`: Array of set keys

**Returns:** Array of elements in first set but not others

##### `sinter(keys: string[]): Promise<any[]>`

Returns the intersection of multiple sets.

**Parameters:**
- `keys`: Array of set keys

**Returns:** Array of elements common to all sets

##### `sunion(keys: string[]): Promise<any[]>`

Returns the union of multiple sets.

**Parameters:**
- `keys`: Array of set keys

**Returns:** Array of elements in any set

#### Hash Operations

##### `hset(key: string, field: string, value: any): Promise<number>`

Sets a field in a hash.

**Parameters:**
- `key`: Hash key
- `field`: Field name
- `value`: Field value

**Returns:** 1 if field is new, 0 if updated

##### `hget(key: string, field: string): Promise<any>`

Gets a field from a hash.

**Parameters:**
- `key`: Hash key
- `field`: Field name

**Returns:** Field value or null

##### `hgetall(key: string): Promise<Record<string, any>>`

Gets all fields from a hash.

**Parameters:**
- `key`: Hash key

**Returns:** Object with all field-value pairs

##### `hdel(key: string, fields: string[]): Promise<number>`

Deletes fields from a hash.

**Parameters:**
- `key`: Hash key
- `fields`: Array of field names

**Returns:** Number of fields deleted

##### `hexists(key: string, field: string): Promise<boolean>`

Checks if a field exists in a hash.

**Parameters:**
- `key`: Hash key
- `field`: Field name

**Returns:** true if field exists

##### `hlen(key: string): Promise<number>`

Returns the number of fields in a hash.

**Parameters:**
- `key`: Hash key

**Returns:** Number of fields

#### Sorted Set Operations

##### `zadd(key: string, members: Record<string, number>): Promise<number>`

Adds members with scores to a sorted set.

**Parameters:**
- `key`: Sorted set key
- `members`: Object mapping members to scores

**Returns:** Number of members added

##### `zrem(key: string, members: string[]): Promise<number>`

Removes members from a sorted set.

**Parameters:**
- `key`: Sorted set key
- `members`: Array of members to remove

**Returns:** Number of members removed

##### `zscore(key: string, member: string): Promise<number | null>`

Gets the score of a member in a sorted set.

**Parameters:**
- `key`: Sorted set key
- `member`: Member name

**Returns:** Member score or null

##### `zrange(key: string, start: number, end: number, withScores?: boolean): Promise<any[]>`

Returns a range of members from a sorted set.

**Parameters:**
- `key`: Sorted set key
- `start`: Start index
- `end`: End index
- `withScores`: Include scores in result

**Returns:** Array of members (with scores if requested)

##### `zcard(key: string): Promise<number>`

Returns the number of members in a sorted set.

**Parameters:**
- `key`: Sorted set key

**Returns:** Number of members

#### Stream Operations

##### `xadd(key: string, id: string, fields: Record<string, any>): Promise<string>`

Adds an entry to a stream.

**Parameters:**
- `key`: Stream key
- `id`: Entry ID
- `fields`: Field-value pairs

**Returns:** Entry ID

##### `xrange(key: string, start: string, end: string): Promise<any[]>`

Returns a range of entries from a stream.

**Parameters:**
- `key`: Stream key
- `start`: Start ID
- `end`: End ID

**Returns:** Array of stream entries

##### `xlen(key: string): Promise<number>`

Returns the length of a stream.

**Parameters:**
- `key`: Stream key

**Returns:** Stream length

#### Geospatial Operations

##### `geoadd(key: string, longitude: number, latitude: number, member: string): Promise<number>`

Adds a geospatial member.

**Parameters:**
- `key`: Geospatial key
- `longitude`: Longitude coordinate
- `latitude`: Latitude coordinate
- `member`: Member identifier

**Returns:** Number of members added

##### `geopos(key: string, members: string[]): Promise<Array<[number, number] | null>>`

Gets coordinates of geospatial members.

**Parameters:**
- `key`: Geospatial key
- `members`: Array of member identifiers

**Returns:** Array of coordinate pairs or null

##### `geodist(key: string, member1: string, member2: string): Promise<number | null>`

Calculates distance between two geospatial members.

**Parameters:**
- `key`: Geospatial key
- `member1`: First member
- `member2`: Second member

**Returns:** Distance in meters or null

#### Time Series Operations

##### `tsadd(key: string, timestamp: number, value: number, labels?: Record<string, string>): Promise<number>`

Adds a time series data point.

**Parameters:**
- `key`: Time series key
- `timestamp`: Unix timestamp
- `value`: Numeric value
- `labels`: Optional metadata labels

**Returns:** Number of data points added

##### `tsget(key: string, timestamp: number): Promise<any>`

Gets a time series data point.

**Parameters:**
- `key`: Time series key
- `timestamp`: Unix timestamp

**Returns:** Data point or null

##### `tsrange(key: string, startTime: number, endTime: number): Promise<any[]>`

Gets a range of time series data points.

**Parameters:**
- `key`: Time series key
- `startTime`: Start timestamp
- `endTime`: End timestamp

**Returns:** Array of data points

#### Vector Operations

##### `vadd(key: string, id: string, vector: number[], metadata?: Record<string, any>): Promise<void>`

Adds a vector to the index.

**Parameters:**
- `key`: Vector index key
- `id`: Vector identifier
- `vector`: Numeric vector array
- `metadata`: Optional metadata

##### `vsearch(key: string, queryVector: number[], topK?: number): Promise<any[]>`

Searches for similar vectors.

**Parameters:**
- `key`: Vector index key
- `queryVector`: Query vector
- `topK`: Number of results to return

**Returns:** Array of search results with scores

##### `vget(key: string, id: string): Promise<any>`

Gets a vector by ID.

**Parameters:**
- `key`: Vector index key
- `id`: Vector identifier

**Returns:** Vector entry or null

### Transactions

#### `beginTransaction(options?: TransactionOptions): string`

Starts a new transaction.

**Parameters:**
- `options`: Transaction options (timeout, isolation level)

**Returns:** Transaction ID

#### `commitTransaction(transactionId: string): void`

Commits a transaction.

**Parameters:**
- `transactionId`: Transaction identifier

**Throws:** Error if transaction fails

#### `rollbackTransaction(transactionId: string): void`

Rolls back a transaction.

**Parameters:**
- `transactionId`: Transaction identifier

### Schema Validation

#### `setSchema(collectionName: string, schema: SchemaDefinition): void`

Sets a JSON schema for a collection.

**Parameters:**
- `collectionName`: Collection name
- `schema`: JSON schema definition

#### `getSchema(collectionName: string): SchemaDefinition | undefined`

Gets the schema for a collection.

**Parameters:**
- `collectionName`: Collection name

**Returns:** Schema definition or undefined

#### `removeSchema(collectionName: string): boolean`

Removes schema validation from a collection.

**Parameters:**
- `collectionName`: Collection name

**Returns:** true if schema was removed

### Change Streams

#### `watch(collectionName: string, callback: ChangeCallback): string`

Watches a collection for changes.

**Parameters:**
- `collectionName`: Collection to watch
- `callback`: Function called on changes

**Returns:** Watch ID

#### `unwatch(watchId: string): boolean`

Stops watching a collection.

**Parameters:**
- `watchId`: Watch identifier

**Returns:** true if watch was removed

### Query Optimization

#### `analyzeQuery(collectionName: string, query: Query): QueryPlan`

Analyzes and optimizes a query.

**Parameters:**
- `collectionName`: Collection name
- `query`: Query to analyze

**Returns:** Optimized query plan

#### `getQuerySuggestions(collectionName: string): string[]`

Gets query optimization suggestions.

**Parameters:**
- `collectionName`: Collection name

**Returns:** Array of suggestions

### Persistence

#### `save(): Promise<void>`

Saves database state to persistent storage.

#### `load(): Promise<void>`

Loads database state from persistent storage.

### Security (Enterprise)

#### `createUser(username: string, password: string, roles?: Role[]): Promise<void>`

Creates a new user.

**Parameters:**
- `username`: Username
- `password`: Password
- `roles`: User roles

#### `authenticateUser(username: string, password: string): Promise<SecurityContext | null>`

Authenticates a user.

**Parameters:**
- `username`: Username
- `password`: Password

**Returns:** Security context or null

#### `authorizePermission(context: SecurityContext, permission: Permission, resource?: string): boolean`

Checks if user has permission.

**Parameters:**
- `context`: Security context
- `permission`: Required permission
- `resource`: Optional resource identifier

**Returns:** true if authorized

### Clustering (Enterprise)

#### `joinCluster(nodeConfig: NodeConfig): Promise<void>`

Joins a cluster.

**Parameters:**
- `nodeConfig`: Node configuration

#### `leaveCluster(): Promise<void>`

Leaves the current cluster.

#### `getClusterStats(): ClusterStats`

Gets cluster statistics.

**Returns:** Cluster status information

### AI/ML Integration (Enterprise)

#### `loadMLModel(modelId: string, modelData: any, format: ModelFormat): Promise<void>`

Loads an ML model.

**Parameters:**
- `modelId`: Model identifier
- `modelData`: Model data/configuration
- `format`: Model format

#### `runMLInference(modelId: string, input: any): Promise<InferenceResult>`

Runs inference on a loaded model.

**Parameters:**
- `modelId`: Model identifier
- `input`: Input data

**Returns:** Inference results

#### `trainMLModel(modelId: string, trainingData: TrainingData): Promise<TrainingResult>`

Trains an ML model.

**Parameters:**
- `modelId`: Model identifier
- `trainingData`: Training dataset

**Returns:** Training results

## Collection Class

Represents a collection of documents.

### Constructor

```typescript
new Collection(name: string)
```

### CRUD Operations

#### `insert(document: any): Promise<string>`

Inserts a document.

**Parameters:**
- `document`: Document to insert

**Returns:** Document ID

#### `find(query?: Query, options?: FindOptions): Promise<any[]>`

Finds documents.

**Parameters:**
- `query`: Query object
- `options`: Query options

**Returns:** Array of documents

#### `findOne(query: Query): Promise<any | null>`

Finds one document.

**Parameters:**
- `query`: Query object

**Returns:** Document or null

#### `update(query: Query, changes: UpdateOperation): Promise<number>`

Updates documents.

**Parameters:**
- `query`: Query object
- `changes`: Update operations

**Returns:** Number updated

#### `remove(query: Query): Promise<number>`

Removes documents.

**Parameters:**
- `query`: Query object

**Returns:** Number removed

### Indexing

#### `createIndex(field: string, options?: IndexOptions): Promise<void>`

Creates an index.

**Parameters:**
- `field`: Field to index
- `options`: Index options

#### `dropIndex(field: string): Promise<void>`

Drops an index.

**Parameters:**
- `field`: Indexed field

### Utility Methods

#### `count(query?: Query): Promise<number>`

Counts documents.

**Parameters:**
- `query`: Query object

**Returns:** Document count

#### `distinct(field: string, query?: Query): Promise<any[]>`

Gets distinct values.

**Parameters:**
- `field`: Field name
- `query`: Query object

**Returns:** Distinct values

#### `getStats(): CollectionStats`

Gets collection statistics.

**Returns:** Collection stats

## Query Operators

### Comparison Operators

- `$eq`: Equal to
- `$ne`: Not equal to
- `$gt`: Greater than
- `$gte`: Greater than or equal
- `$lt`: Less than
- `$lte`: Less than or equal
- `$in`: In array
- `$nin`: Not in array

### Logical Operators

- `$and`: Logical AND
- `$or`: Logical OR
- `$not`: Logical NOT
- `$nor`: Logical NOR

### Array Operators

- `$all`: Match all elements
- `$elemMatch`: Element match
- `$size`: Array size

### Update Operators

- `$set`: Set field value
- `$unset`: Remove field
- `$inc`: Increment numeric value
- `$push`: Add to array
- `$pull`: Remove from array
- `$addToSet`: Add to set (unique)

## Error Types

### MonarchError

Base error class for all Monarch errors.

**Properties:**
- `message`: Error message
- `category`: Error category
- `severity`: Error severity
- `code`: Error code
- `timestamp`: Error timestamp
- `context`: Additional context

### ValidationError

Thrown for validation failures.

### SecurityError

Thrown for security violations.

### ResourceLimitError

Thrown when resource limits are exceeded.

### ConfigurationError

Thrown for configuration errors.

## Configuration

### DatabaseConfig

```typescript
interface DatabaseConfig {
  limits: DatabaseLimits;
  performance: PerformanceLimits;
  security: SecurityLimits;
  durability: DurabilityLimits;
  clustering: ClusteringLimits;
  ai: AIMLLimits;
  scripting: ScriptingLimits;
}
```

### DatabaseLimits

```typescript
interface DatabaseLimits {
  maxDocumentSize: number;
  maxCollectionSize: number;
  maxDocumentsPerCollection: number;
  maxDocumentsPerOperation: number;
  maxFieldNameLength: number;
  maxCollectionNameLength: number;
  maxQueryDepth: number;
  maxQueryOperators: number;
  maxQuerySize: number;
}
```

### PerformanceLimits

```typescript
interface PerformanceLimits {
  maxConcurrentOperations: number;
  operationTimeout: number;
  maxMetricsHistory: number;
  queryCacheSize: number;
  queryCacheTTL: number;
}
```

## Types

### Document

```typescript
interface Document {
  _id?: string;
  [key: string]: any;
}
```

### Query

```typescript
interface Query {
  [field: string]: any;
}
```

### UpdateOperation

```typescript
interface UpdateOperation {
  $set?: Record<string, any>;
  $unset?: Record<string, any>;
  $inc?: Record<string, number>;
  $push?: Record<string, any>;
  $pull?: Record<string, any>;
  $addToSet?: Record<string, any>;
}
```

### FindOptions

```typescript
interface FindOptions {
  limit?: number;
  skip?: number;
  sort?: Record<string, 1 | -1>;
}
```

### SchemaDefinition

```typescript
interface SchemaDefinition {
  type: string;
  properties?: Record<string, any>;
  required?: string[];
  [key: string]: any;
}
```

### ChangeEvent

```typescript
interface ChangeEvent {
  type: 'insert' | 'update' | 'delete';
  collection: string;
  document: any;
  timestamp: number;
  operationId?: string;
}
```

This API reference covers the core functionality. For enterprise features, additional documentation is available in the respective guides.
