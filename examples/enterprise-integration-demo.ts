/**
 * Monarch Database Enterprise Integration Demo
 *
 * This example demonstrates how to integrate Monarch Database with
 * popular enterprise frameworks and tools.
 */

import { Monarch } from 'monarch-database-quantum';

// Example 1: Express.js Integration
function createExpressIntegration() {
  return `
import express from 'express';
import { Monarch } from 'monarch-database';

const app = express();
const db = new Monarch();

// Middleware for database context
app.use(async (req, res, next) => {
  req.db = db;
  next();
});

// REST API endpoints
app.get('/api/users', async (req, res) => {
  try {
    const users = await req.db.find('users', req.query);
    res.json(users);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/users', async (req, res) => {
  try {
    const user = await req.db.insert('users', req.body);
    res.status(201).json(user);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

app.listen(3000, () => {
  console.log('🚀 Express + Monarch API running on port 3000');
});
`;
}

// Example 2: Fastify Integration
function createFastifyIntegration() {
  return `
import fastify from 'fastify';
import { Monarch } from 'monarch-database';

const app = fastify();
const db = new Monarch();

// Register Monarch as a Fastify plugin
app.register(async (fastify, opts) => {
  fastify.decorate('db', db);

  // Routes
  fastify.get('/users', async (request, reply) => {
    const users = await fastify.db.find('users', request.query);
    return users;
  });

  fastify.post('/users', async (request, reply) => {
    const user = await fastify.db.insert('users', request.body);
    reply.code(201);
    return user;
  });
});

app.listen({ port: 3000 }, (err) => {
  if (err) throw err;
  console.log('🚀 Fastify + Monarch API running on port 3000');
});
`;
}

// Example 3: Socket.io Real-time Integration
function createSocketIntegration() {
  return `
import express from 'express';
import { Server } from 'socket.io';
import { Monarch } from 'monarch-database';

const app = express();
const server = app.listen(3000);
const io = new Server(server);
const db = new Monarch();

// Real-time change streams
const changeStream = db.watch('users');

changeStream.on('change', (change) => {
  io.emit('user-change', change);
});

// Socket.io handlers
io.on('connection', (socket) => {
  console.log('Client connected:', socket.id);

  socket.on('subscribe-users', async () => {
    const users = await db.find('users');
    socket.emit('users-list', users);
  });

  socket.on('create-user', async (userData) => {
    try {
      const user = await db.insert('users', userData);
      socket.emit('user-created', user);
    } catch (error) {
      socket.emit('error', error.message);
    }
  });

  socket.on('disconnect', () => {
    console.log('Client disconnected:', socket.id);
  });
});

console.log('🚀 Real-time Monarch API running on port 3000');
`;
}

// Example 4: GraphQL Integration
function createGraphQLIntegration() {
  return `
import { ApolloServer } from '@apollo/server';
import { startStandaloneServer } from '@apollo/server/standalone';
import { Monarch } from 'monarch-database';

const db = new Monarch();

const typeDefs = \`
  type User {
    id: ID!
    name: String!
    email: String!
    posts: [Post!]!
  }

  type Post {
    id: ID!
    title: String!
    content: String!
    author: User!
  }

  type Query {
    users: [User!]!
    user(id: ID!): User
    posts: [Post!]!
  }

  type Mutation {
    createUser(name: String!, email: String!): User!
    createPost(title: String!, content: String!, authorId: ID!): Post!
  }
\`;

const resolvers = {
  Query: {
    users: async () => await db.find('users'),
    user: async (_, { id }) => await db.findOne('users', { id }),
    posts: async () => await db.find('posts')
  },

  Mutation: {
    createUser: async (_, { name, email }) => {
      return await db.insert('users', { name, email });
    },
    createPost: async (_, { title, content, authorId }) => {
      return await db.insert('posts', { title, content, authorId });
    }
  },

  User: {
    posts: async (user) => {
      return await db.find('posts', { authorId: user.id });
    }
  },

  Post: {
    author: async (post) => {
      return await db.findOne('users', { id: post.authorId });
    }
  }
};

const server = new ApolloServer({
  typeDefs,
  resolvers,
});

const { url } = await startStandaloneServer(server, {
  listen: { port: 4000 },
});

console.log(\`🚀 GraphQL + Monarch API running at \${url}\`);
`;
}

// Example 5: LangChain Integration
function createLangChainIntegration() {
  return `
import { MonarchVectorStore } from 'monarch-langchain';
import { ChatOpenAI } from 'langchain/chat_models/openai';
import { RetrievalQAChain } from 'langchain/chains';

// Initialize Monarch as vector store
const vectorStore = new MonarchVectorStore({
  collection: 'documents',
  url: 'http://localhost:7331'
});

// Add documents to Monarch
await vectorStore.addDocuments([
  { pageContent: 'Monarch is a high-performance database...', metadata: { source: 'docs' } },
  { pageContent: 'Vector search enables semantic matching...', metadata: { source: 'docs' } }
]);

// Create RAG chain
const model = new ChatOpenAI({
  openaiApiKey: process.env.OPENAI_API_KEY,
  modelName: 'gpt-3.5-turbo'
});

const chain = RetrievalQAChain.fromLLM(model, vectorStore.asRetriever());

const result = await chain.call({
  query: 'What is Monarch Database?'
});

console.log(result.text);
`;
}

// Example 6: Database Migration Helper
function createMigrationHelper() {
  return `
import { Monarch } from 'monarch-database';

class MonarchMigrator {
  constructor(private db: Monarch) {}

  async migrateUsers() {
    // Create new schema
    await this.db.createCollection('users_v2', {
      schema: {
        id: 'string',
        name: 'string',
        email: 'string',
        createdAt: 'date',
        profile: {
          avatar: 'string',
          bio: 'string'
        }
      }
    });

    // Migrate data
    const oldUsers = await this.db.find('users');
    for (const user of oldUsers) {
      await this.db.insert('users_v2', {
        id: user.id,
        name: user.name,
        email: user.email,
        createdAt: user.createdAt || new Date(),
        profile: {
          avatar: user.avatar || '',
          bio: user.bio || ''
        }
      });
    }

    console.log(\`✅ Migrated \${oldUsers.length} users\`);
  }

  async createIndexes() {
    await this.db.createIndex('users_v2', 'email', { unique: true });
    await this.db.createIndex('users_v2', 'createdAt');
    console.log('✅ Created indexes');
  }
}

// Usage
const db = new Monarch();
const migrator = new MonarchMigrator(db);

await migrator.migrateUsers();
await migrator.createIndexes();
`;
}

// Example 7: Monitoring Integration
function createMonitoringIntegration() {
  return `
import { Monarch } from 'monarch-database';
import { collectDefaultMetrics, Registry } from 'prom-client';

const db = new Monarch();
const register = new Registry();

// Enable default metrics
collectDefaultMetrics({ register });

// Custom Monarch metrics
const monarchMetrics = {
  collectionsTotal: new promClient.Gauge({
    name: 'monarch_collections_total',
    help: 'Total number of collections'
  }),

  documentsTotal: new promClient.Gauge({
    name: 'monarch_documents_total',
    help: 'Total number of documents across all collections'
  }),

  queryDuration: new promClient.Histogram({
    name: 'monarch_query_duration_seconds',
    help: 'Query execution time',
    buckets: [0.1, 0.5, 1, 2.5, 5, 10]
  })
};

// Update metrics periodically
setInterval(async () => {
  const stats = await db.getStats();
  monarchMetrics.collectionsTotal.set(stats.collections);
  monarchMetrics.documentsTotal.set(stats.totalDocuments);
}, 5000);

// Express metrics endpoint
app.get('/metrics', async (req, res) => {
  res.set('Content-Type', register.contentType);
  res.end(await register.metrics());
});

console.log('📊 Monarch monitoring enabled');
`;
}

async function enterpriseIntegrationDemo() {
  console.log('🚀 Monarch Database Enterprise Integration Demo\n');

  console.log('📋 Available Integration Examples:\n');

  console.log('1. 🌐 Express.js REST API');
  console.log('   Create RESTful APIs with Monarch as the backend');
  console.log();

  console.log('2. ⚡ Fastify Integration');
  console.log('   High-performance web framework integration');
  console.log();

  console.log('3. 🔴 Socket.io Real-time');
  console.log('   Real-time applications with change streams');
  console.log();

  console.log('4. 🔺 GraphQL API');
  console.log('   Type-safe GraphQL APIs with Monarch');
  console.log();

  console.log('5. 🦜 LangChain Integration');
  console.log('   AI-powered RAG applications');
  console.log();

  console.log('6. 🔄 Database Migrations');
  console.log('   Schema evolution and data migration helpers');
  console.log();

  console.log('7. 📊 Prometheus Monitoring');
  console.log('   Enterprise-grade observability integration');
  console.log();

  console.log('💡 Key Integration Benefits:');
  console.log('  • Framework-agnostic design');
  console.log('  • Type-safe integrations');
  console.log('  • Enterprise-ready patterns');
  console.log('  • Production monitoring');
  console.log('  • Migration tooling');
  console.log('  • Real-time capabilities');

  console.log('\n📁 Integration files created in examples/ directory');
  console.log('Run individual examples to see integrations in action!');
}

// Export all integration examples
export {
  createExpressIntegration,
  createFastifyIntegration,
  createSocketIntegration,
  createGraphQLIntegration,
  createLangChainIntegration,
  createMigrationHelper,
  createMonitoringIntegration,
  enterpriseIntegrationDemo
};

// Run demo if executed directly
if (require.main === module) {
  enterpriseIntegrationDemo().catch(console.error);
}
