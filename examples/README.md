# Monarch Database Examples

This directory contains comprehensive examples demonstrating various use cases and features of Monarch Database. Each example is designed to be runnable and showcases real-world application patterns.

## 🚀 Quick Start

All examples use the published package. Make sure to install dependencies first:

```bash
npm install monarch-db
```

Then run any example:

```bash
npx tsx examples/example.ts
```

## 📚 Available Examples

### Core Database Features

- **`example.ts`** - Basic CRUD operations, queries, and indexing
- **`advanced-caching-demo.ts`** - Advanced caching patterns and performance optimization
- **`performance-example.ts`** - Performance benchmarking and optimization techniques

### Enterprise Applications

- **`realtime-chat-demo.ts`** - Real-time chat application with change streams
- **`ecommerce-cart-demo.ts`** - E-commerce shopping cart with transactions
- **`auth-session-demo.ts`** - User authentication and session management
- **`enterprise-integration-demo.ts`** - Integration with popular frameworks (Express, Fastify, etc.)
- **`enterprise-monarch-demo.ts`** - Enterprise-scale patterns and best practices

### Specialized Use Cases

- **`vector-search-demo.ts`** - AI/ML vector search and embeddings
- **`vector-database-demo.ts`** - Advanced vector database operations
- **`graph-analytics-demo.ts`** - Graph database queries and analytics
- **`iot-data-demo.ts`** - IoT sensor data processing and analytics
- **`langchain-integration.ts`** - Integration with LangChain for AI applications

### 🌀 Quantum Algorithms (World's First!)

Monarch Database features the world's first production quantum database algorithms. These examples demonstrate groundbreaking quantum computing applications on classical hardware.

- **`quantum-walk-demo.ts`** - Basic quantum walk algorithms demonstration
- **`quantum-social-network-analysis.ts`** - Social network analysis with quantum centrality and community detection
- **`quantum-recommendation-system.ts`** - E-commerce recommendation engine using quantum similarity search
- **`quantum-fraud-detection.ts`** - Real-time fraud detection using quantum graph analysis

## 🎯 Example Categories

### 🏗️ **Architecture Patterns**
- **CQRS**: Command Query Responsibility Segregation
- **Event Sourcing**: Event-driven architecture
- **Repository Pattern**: Data access abstraction

### 🔒 **Security & Authentication**
- **JWT Sessions**: Token-based authentication
- **Password Hashing**: Secure password storage
- **Rate Limiting**: API protection
- **Audit Logging**: Security monitoring

### 📊 **Data Processing**
- **Time Series**: IoT sensor data
- **Real-time Analytics**: Live data processing
- **Batch Processing**: High-volume data ingestion
- **Change Streams**: Real-time notifications

### 🤖 **AI/ML Integration**
- **Vector Search**: Similarity search
- **Embeddings**: AI model integration
- **Recommendation Systems**: ML-powered suggestions

### 🌀 **Quantum Computing**
- **Quantum Walk Algorithms**: Path finding and graph traversal
- **Quantum Centrality**: Influence analysis with interference patterns
- **Quantum Community Detection**: Group discovery through wave mechanics
- **Quantum Query Optimization**: World's first quantum query optimizer
- **Quantum Caching**: Interference-based cache management

### 🌐 **Web Applications**
- **REST APIs**: Express/Fastify integration
- **Real-time**: WebSocket-like functionality
- **Caching**: Performance optimization
- **Sessions**: User state management

## 🛠️ Running Examples

### Prerequisites
- Node.js 18+
- npm or yarn
- `monarch-db` package installed

### Individual Examples
```bash
# Basic example
npx tsx examples/example.ts

# Real-time chat
npx tsx examples/realtime-chat-demo.ts

# E-commerce
npx tsx examples/ecommerce-cart-demo.ts

# IoT data processing
npx tsx examples/iot-data-demo.ts

# 🌀 Quantum Examples (World's First!)
npx tsx examples/quantum-walk-demo.ts
npx tsx examples/quantum-social-network-analysis.ts
npx tsx examples/quantum-recommendation-system.ts
npx tsx examples/quantum-fraud-detection.ts
```

### With Custom Configuration
```bash
# Using environment variables
NODE_ENV=production npx tsx examples/example.ts

# With custom database path
DB_PATH=./my-data npx tsx examples/example.ts
```

## 📖 Example Structure

Each example follows a consistent structure:

1. **Setup**: Database initialization and configuration
2. **Data Models**: TypeScript interfaces for data structures
3. **Core Logic**: Business logic implementation
4. **Demo Execution**: Sample data and operations
5. **Cleanup**: Resource cleanup and statistics

## 🔧 Customization

### Adapting for Your Use Case

Most examples can be easily adapted by:

1. **Modifying data models** in the interface definitions
2. **Adding business logic** in the class methods
3. **Customizing demo data** in the execution section
4. **Adding error handling** and edge cases

### Environment Variables

Many examples support customization via environment variables:

- `DB_PATH`: Custom database location
- `NODE_ENV`: Environment mode
- `LOG_LEVEL`: Logging verbosity
- `PORT`: Server port (for web examples)

## 🎯 Learning Path

For new users, we recommend following this learning path:

### Traditional Database Learning
1. **Start** → `example.ts` (Basic operations)
2. **CRUD** → `ecommerce-cart-demo.ts` (Complex operations)
3. **Real-time** → `realtime-chat-demo.ts` (Change streams)
4. **Security** → `auth-session-demo.ts` (Authentication)
5. **Scale** → `iot-data-demo.ts` (High-volume data)
6. **AI/ML** → `vector-search-demo.ts` (Advanced features)

### 🌀 Quantum Database Learning (Advanced)
1. **Quantum Basics** → `quantum-walk-demo.ts` (Introduction to quantum algorithms)
2. **Social Networks** → `quantum-social-network-analysis.ts` (Quantum centrality & communities)
3. **Recommendations** → `quantum-recommendation-system.ts` (Quantum similarity search)
4. **Security** → `quantum-fraud-detection.ts` (Quantum fraud detection)

## 🤝 Contributing Examples

We welcome contributions of new examples! When adding examples:

1. **Follow the structure** of existing examples
2. **Include comprehensive comments** explaining concepts
3. **Add TypeScript interfaces** for data models
4. **Provide realistic demo data** and operations
5. **Include cleanup logic** for demo purposes
6. **Update this README** with the new example

## 📊 Performance Benchmarks

Several examples include performance demonstrations:

- **Vector Search**: Similarity search performance
- **Bulk Operations**: Batch processing speeds
- **Real-time Updates**: Change stream throughput
- **IoT Data**: High-frequency data ingestion

Run `npm run benchmark` to see performance comparisons.

## 🆘 Troubleshooting

### Common Issues

**"Cannot find module 'monarch-db'"**
```bash
npm install monarch-db
```

**"Example fails with permission error"**
```bash
# Ensure write permissions in current directory
mkdir -p ./monarch-data
```

**"Port already in use"**
```bash
# Change port in environment
PORT=3001 npx tsx examples/enterprise-integration-demo.ts
```

### Getting Help

- 📖 **Documentation**: [monarchdb.dev](https://monarchdb.dev)
- 💬 **Community**: [GitHub Discussions](https://github.com/bantoinese83/Monarch-Database/discussions)
- 🐛 **Issues**: [GitHub Issues](https://github.com/bantoinese83/Monarch-Database/issues)
- 📧 **Support**: hello@monarchdb.dev

---

**Happy coding with Monarch Database! 🎉**
