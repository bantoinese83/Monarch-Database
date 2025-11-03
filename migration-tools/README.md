# Monarch Database Migration Tools

Automated migration tools to help you migrate data from Redis and MongoDB to Monarch Database.

## Features

- **Redis Migration**: Migrate Redis data structures (Strings, Hashes, Lists, Sets, Sorted Sets) to Monarch collections
- **MongoDB Migration**: Migrate MongoDB collections to Monarch collections with batch processing
- **Progress Tracking**: Real-time progress monitoring and detailed statistics
- **Selective Migration**: Choose specific collections, data types, or key patterns to migrate
- **Data Transformation**: Apply custom transformation functions during migration
- **Dry Run Mode**: Preview what would be migrated without actually doing it
- **Error Handling**: Robust error handling with detailed logging

## Installation

The migration tools are included with Monarch Database. Install dependencies:

```bash
cd migration-tools
npm install
```

## Redis Migration

### Basic Usage

```bash
# Migrate all data from local Redis
npx tsx redis-migration.ts --redis-host localhost --redis-port 6379

# Migrate from remote Redis with authentication
npx tsx redis-migration.ts --redis-host redis.example.com --redis-port 6380 --redis-password mypassword
```

### Advanced Options

```bash
# Dry run to see what would be migrated
npx tsx redis-migration.ts --dry-run --verbose

# Migrate only specific data types
npx tsx redis-migration.ts --types string,hash

# Migrate keys matching a pattern
npx tsx redis-migration.ts --key-pattern "user:*"

# Custom batch size and output location
npx tsx redis-migration.ts --batch-size 500 --monarch-path ./my-migrated-data
```

### Redis Migration Options

| Option | Description | Default |
|--------|-------------|---------|
| `--redis-host` | Redis host | localhost |
| `--redis-port` | Redis port | 6379 |
| `--redis-password` | Redis password | (none) |
| `--redis-db` | Redis database number | 0 |
| `--monarch-path` | Monarch database path | ./migrated-data |
| `--batch-size` | Migration batch size | 1000 |
| `--types` | Comma-separated types to migrate | string,hash,list,set,zset |
| `--key-pattern` | Key pattern to migrate | * |
| `--dry-run` | Show what would be migrated | false |
| `--verbose` | Enable verbose logging | false |

### Data Structure Mapping

| Redis Type | Monarch Collection | Document Structure |
|------------|-------------------|-------------------|
| String | `redis_strings` | `{redisKey, value, ttl, migratedAt}` |
| Hash | `redis_hashes` | `{redisKey, fields, ttl, migratedAt}` |
| List | `redis_lists` | `{redisKey, items, ttl, migratedAt}` |
| Set | `redis_sets` | `{redisKey, members, ttl, migratedAt}` |
| Sorted Set | `redis_zsets` | `{redisKey, members[{value, score}], ttl, migratedAt}` |

## MongoDB Migration

### Basic Usage

```bash
# Migrate all collections from MongoDB
npx tsx mongodb-migration.ts --mongo-database myapp

# Migrate from remote MongoDB
npx tsx mongodb-migration.ts --mongo-uri mongodb+srv://user:pass@cluster.mongodb.net --mongo-database myapp
```

### Advanced Options

```bash
# Migrate specific collections only
npx tsx mongodb-migration.ts --mongo-database myapp --collections users,products,orders

# Dry run to see what would be migrated
npx tsx mongodb-migration.ts --mongo-database myapp --dry-run --verbose

# Skip validation and preserve original IDs
npx tsx mongodb-migration.ts --mongo-database myapp --skip-validation --preserve-ids

# Use custom transformation functions
npx tsx mongodb-migration.ts --mongo-database myapp --transform-funcs ./transforms.js
```

### MongoDB Migration Options

| Option | Description | Default |
|--------|-------------|---------|
| `--mongo-uri` | MongoDB connection URI | mongodb://localhost:27017 |
| `--mongo-database` | MongoDB database name | (required) |
| `--collections` | Collections to migrate | all |
| `--monarch-path` | Monarch database path | ./migrated-data |
| `--batch-size` | Migration batch size | 1000 |
| `--skip-validation` | Skip document validation | false |
| `--preserve-ids` | Preserve MongoDB _id values | false |
| `--transform-funcs` | Path to transformation file | (none) |
| `--dry-run` | Show what would be migrated | false |
| `--verbose` | Enable verbose logging | false |

## Data Transformation

You can apply custom transformation functions during MongoDB migration to modify documents as they're migrated.

### Transformation Functions File

Create a `transforms.js` file:

```javascript
export default {
  // Transform all collections
  '*': (doc) => {
    // Add migration metadata to all documents
    doc.migratedAt = new Date();
    doc.source = 'mongodb';
    return doc;
  },

  // Transform specific collections
  users: (doc) => {
    // Rename fields
    if (doc.email) {
      doc.emailAddress = doc.email;
      delete doc.email;
    }

    // Transform nested data
    if (doc.profile) {
      doc.firstName = doc.profile.firstName;
      doc.lastName = doc.profile.lastName;
      delete doc.profile;
    }

    return doc;
  },

  orders: (doc) => {
    // Convert date strings to Date objects
    if (doc.createdAt && typeof doc.createdAt === 'string') {
      doc.createdAt = new Date(doc.createdAt);
    }

    // Flatten nested arrays
    if (doc.items && Array.isArray(doc.items)) {
      doc.itemCount = doc.items.length;
      doc.totalValue = doc.items.reduce((sum, item) => sum + (item.price * item.quantity), 0);
    }

    return doc;
  }
};
```

### Transformation Best Practices

1. **Immutable Transformations**: Always return a new object rather than modifying the original
2. **Error Handling**: Wrap transformation logic in try-catch blocks
3. **Type Safety**: Check data types before transformation
4. **Performance**: Keep transformations lightweight to avoid slowing down migration
5. **Testing**: Test transformations on sample data before running full migration

## Migration Monitoring

Both tools provide real-time progress monitoring:

```
Migration Progress: 45.2% (45230/100000) - 1250 docs/sec - ETA: 45s
```

Progress is updated every 10 seconds (MongoDB) or 5 seconds (Redis) and includes:
- Percentage complete
- Documents/keys processed
- Processing rate (docs/sec)
- Estimated time remaining

## Error Handling

The migration tools handle various error scenarios:

- **Connection Errors**: Automatic retry with exponential backoff
- **Document Validation Errors**: Skip invalid documents and continue
- **Network Timeouts**: Resume migration from last successful batch
- **Memory Issues**: Automatic batch size adjustment

Failed documents are logged but don't stop the migration process.

## Performance Optimization

### Redis Migration
- Uses Redis SCAN for memory-efficient key iteration
- Configurable batch sizes for memory management
- Parallel processing of different data types

### MongoDB Migration
- Uses MongoDB cursors for memory-efficient document streaming
- Batch processing to balance memory usage and performance
- Sorted collection processing (largest collections first)

### General Tips
- Increase batch size for faster networks and powerful machines
- Use dry-run mode to estimate migration time
- Monitor system resources during large migrations
- Consider migrating during off-peak hours

## Troubleshooting

### Redis Connection Issues
```bash
# Test Redis connection
redis-cli -h localhost -p 6379 ping
```

### MongoDB Connection Issues
```bash
# Test MongoDB connection
mongosh mongodb://localhost:27017 --eval "db.adminCommand('ping')"
```

### Memory Issues
- Reduce batch size: `--batch-size 500`
- Monitor system memory usage
- Consider migrating in smaller chunks using collection filters

### Performance Issues
- Check network latency between source and Monarch database
- Ensure sufficient disk I/O for write operations
- Consider disabling validation during migration: `--skip-validation`

## Integration with Monarch CLI

After migration, you can use the Monarch CLI to inspect and manage migrated data:

```bash
# List migrated collections
monarch collections

# Query migrated Redis strings
monarch query redis_strings '{"redisKey": "user:123"}'

# Query migrated MongoDB documents
monarch query users '{"emailAddress": "user@example.com"}'

# Get database statistics
monarch stats
```

## Support

For issues or questions about migration:

1. Check the [Monarch Database documentation](../README.md)
2. Review migration logs for error details
3. Test with small datasets first
4. Use dry-run mode to preview migrations

## Examples

See the `examples/` directory for complete migration examples and sample transformation functions.
