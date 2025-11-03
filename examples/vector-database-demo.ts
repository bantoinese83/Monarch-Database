/**
 * Monarch Vector Database Demo
 *
 * This example demonstrates how Monarch can be used as a high-performance
 * vector database for AI workloads, similar to Pinecone, Weaviate, or Qdrant.
 *
 * Features showcased:
 * - Vector storage and retrieval
 * - Semantic search with cosine similarity
 * - Metadata filtering
 * - High-dimensional vector support (1536+ dimensions)
 * - Performance optimized for AI/ML applications
 */

import { Monarch } from '../src/monarch';

interface Document {
  id: string;
  content: string;
  embedding: number[];
  metadata: {
    category: string;
    author: string;
    timestamp: number;
    tags: string[];
  };
}

class VectorDatabaseDemo {
  private db: Monarch;

  constructor() {
    this.db = new Monarch();
  }

  /**
   * Initialize the vector database with sample documents
   */
  async initializeDataset(): Promise<void> {
    console.log('🚀 Initializing Monarch Vector Database...');

    // Sample documents with their embeddings (simplified 4D for demo)
    const documents: Document[] = [
      {
        id: 'doc1',
        content: 'Machine learning algorithms optimize performance through data analysis',
        embedding: [0.8, 0.2, 0.1, 0.9],
        metadata: {
          category: 'technology',
          author: 'Dr. Sarah Chen',
          timestamp: Date.now(),
          tags: ['ML', 'AI', 'algorithms']
        }
      },
      {
        id: 'doc2',
        content: 'Neural networks process information using interconnected nodes',
        embedding: [0.7, 0.3, 0.8, 0.2],
        metadata: {
          category: 'technology',
          author: 'Prof. Michael Johnson',
          timestamp: Date.now(),
          tags: ['neural-networks', 'deep-learning']
        }
      },
      {
        id: 'doc3',
        content: 'Climate change impacts global weather patterns significantly',
        embedding: [0.1, 0.9, 0.3, 0.7],
        metadata: {
          category: 'environment',
          author: 'Dr. Emma Rodriguez',
          timestamp: Date.now(),
          tags: ['climate', 'environment', 'weather']
        }
      },
      {
        id: 'doc4',
        content: 'Sustainable energy solutions reduce carbon emissions',
        embedding: [0.2, 0.8, 0.9, 0.1],
        metadata: {
          category: 'environment',
          author: 'Dr. James Wilson',
          timestamp: Date.now(),
          tags: ['sustainability', 'energy', 'carbon']
        }
      },
      {
        id: 'doc5',
        content: 'Quantum computing promises exponential processing power',
        embedding: [0.6, 0.4, 0.5, 0.8],
        metadata: {
          category: 'technology',
          author: 'Dr. Lisa Zhang',
          timestamp: Date.now(),
          tags: ['quantum', 'computing', 'physics']
        }
      }
    ];

    // Store documents and their vector embeddings
    for (const doc of documents) {
      await this.db.vadd('documents', doc.id, doc.embedding, {
        content: doc.content,
        ...doc.metadata
      });
    }

    // Store original documents in collections for reference
    const collection = this.db.addCollection('documents_collection');
    for (const doc of documents) {
      await collection.insert(doc);
    }

    console.log(`✅ Stored ${documents.length} documents with vector embeddings`);
  }

  /**
   * Perform semantic search for AI queries
   */
  async semanticSearch(query: string, topK: number = 5): Promise<void> {
    console.log(`\n🔍 Performing semantic search for: "${query}"`);

    // Simulate query embedding (in real app, use OpenAI, Cohere, etc.)
    const queryEmbeddings: Record<string, number[]> = {
      'machine learning algorithms': [0.9, 0.1, 0.2, 0.8],
      'climate change effects': [0.2, 0.8, 0.4, 0.6],
      'quantum computing': [0.7, 0.3, 0.6, 0.9],
      'sustainable energy': [0.1, 0.9, 0.8, 0.2],
      'neural network architecture': [0.8, 0.2, 0.9, 0.3]
    };

    const queryVector = queryEmbeddings[query.toLowerCase()];
    if (!queryVector) {
      console.log('❌ Query not found in predefined embeddings');
      return;
    }

    // Perform vector search
    const startTime = Date.now();
    const results = await this.db.vsearch('documents', queryVector, topK, true);
    const searchTime = Date.now() - startTime;

    console.log(`⚡ Search completed in ${searchTime}ms`);
    console.log(`📊 Found ${results.length} relevant documents:\n`);

    for (let i = 0; i < results.length; i++) {
      const result = results[i];
      console.log(`${i + 1}. ${result.id} (similarity: ${(result.score * 100).toFixed(1)}%)`);

      if (result.metadata) {
        console.log(`   Content: ${(result.metadata as any).content}`);
        console.log(`   Category: ${(result.metadata as any).category}`);
        console.log(`   Author: ${(result.metadata as any).author}`);
        console.log(`   Tags: ${(result.metadata as any).tags?.join(', ')}`);
      }
      console.log('');
    }
  }

  /**
   * Demonstrate metadata filtering capabilities
   */
  async filteredSearch(): Promise<void> {
    console.log('\n🎯 Demonstrating filtered search capabilities...');

    // Search for technology documents
    const techQuery = [0.8, 0.3, 0.2, 0.7]; // Technology-related vector
    const techResults = await this.db.vsearch('documents', techQuery, 10, true);

    console.log('Technology documents found:');
    techResults
      .filter(result => (result.metadata as any)?.category === 'technology')
      .forEach((result, index) => {
        console.log(`${index + 1}. ${result.id} (${(result.score * 100).toFixed(1)}% match)`);
      });
  }

  /**
   * Demonstrate real-time updates and change streams
   */
  async realTimeUpdates(): Promise<void> {
    console.log('\n📡 Demonstrating real-time vector updates...');

    // Set up change stream listener
    const listenerId = await this.db.watch({
      collection: 'documents_collection',
      operation: 'insert'
    }, (event) => {
      console.log(`🔔 Real-time update: New document ${event.document._id} inserted`);
    });

    // Add a new document
    const newDoc = {
      id: 'doc6',
      content: 'Edge computing brings processing closer to data sources',
      embedding: [0.5, 0.6, 0.7, 0.4],
      metadata: {
        category: 'technology',
        author: 'Dr. Alex Kumar',
        timestamp: Date.now(),
        tags: ['edge-computing', 'IoT', 'distributed-systems']
      }
    };

    await this.db.vadd('documents', newDoc.id, newDoc.embedding, {
      content: newDoc.content,
      ...newDoc.metadata
    });

    const collection = this.db.getCollection('documents_collection');
    if (collection) {
      await collection.insert(newDoc);
    }

    // Clean up listener
    await this.db.unwatch(listenerId);
    console.log('✅ Real-time listener cleaned up');
  }

  /**
   * Performance benchmarking
   */
  async performanceBenchmark(): Promise<void> {
    console.log('\n⚡ Running performance benchmarks...');

    const vectorCount = 1000;
    const dimensions = 128;

    console.log(`Adding ${vectorCount} ${dimensions}D vectors...`);

    const startTime = Date.now();
    for (let i = 0; i < vectorCount; i++) {
      const vector = Array.from({ length: dimensions }, () => Math.random() * 2 - 1);
      await this.db.vadd('benchmark', `vec${i}`, vector, { index: i });
    }
    const insertTime = Date.now() - startTime;

    console.log(`✅ Inserted ${vectorCount} vectors in ${insertTime}ms`);
    console.log(`📈 Average insert time: ${(insertTime / vectorCount).toFixed(2)}ms per vector`);

    // Benchmark search performance
    console.log('\n🔍 Benchmarking search performance...');
    const queryVector = Array.from({ length: dimensions }, () => Math.random() * 2 - 1);

    const searchStart = Date.now();
    const searchResults = await this.db.vsearch('benchmark', queryVector, 10);
    const searchTime = Date.now() - searchStart;

    console.log(`⚡ Search through ${vectorCount} vectors completed in ${searchTime}ms`);
    console.log(`📊 Found ${searchResults.length} results`);
    console.log(`🏆 Best match score: ${(searchResults[0].score * 100).toFixed(2)}%`);
  }

  /**
   * Demonstrate advanced AI use cases
   */
  async aiUseCases(): Promise<void> {
    console.log('\n🤖 Demonstrating AI use cases...');

    // 1. Recommendation system
    console.log('🎯 Building recommendation system...');
    await this.setupRecommendationSystem();

    // 2. Content similarity
    console.log('📝 Analyzing content similarity...');
    await this.contentSimilarityAnalysis();

    // 3. Semantic clustering
    console.log('🔗 Performing semantic clustering...');
    await this.semanticClustering();
  }

  private async setupRecommendationSystem(): Promise<void> {
    // User preferences
    const users = [
      { id: 'alice', preferences: [0.9, 0.1, 0.2, 0.8] }, // Loves tech
      { id: 'bob', preferences: [0.2, 0.8, 0.9, 0.1] },   // Loves environment
    ];

    // Items
    const items = [
      { id: 'book1', vector: [0.8, 0.2, 0.3, 0.7], category: 'tech' },
      { id: 'book2', vector: [0.3, 0.8, 0.7, 0.2], category: 'environment' },
    ];

    for (const user of users) {
      await this.db.vadd('users', user.id, user.preferences);
    }

    for (const item of items) {
      await this.db.vadd('items', item.id, item.vector, { category: item.category });
    }

    // Recommend for Alice
    const alicePrefs = (await this.db.vget('users', 'alice'))!.vector;
    const recommendations = await this.db.vsearch('items', alicePrefs, 2, true);

    console.log('📚 Recommendations for Alice (tech enthusiast):');
    recommendations.forEach((rec, i) => {
      console.log(`   ${i + 1}. ${rec.id} (${(rec.metadata as any)?.category}) - ${(rec.score * 100).toFixed(1)}% match`);
    });
  }

  private async contentSimilarityAnalysis(): Promise<void> {
    // Compare document similarities
    const docs = await this.db.vsearch('documents', [0.8, 0.2, 0.1, 0.9], 5, true);

    console.log('📊 Document similarity analysis:');
    docs.forEach((doc, i) => {
      const similarity = (doc.score * 100).toFixed(1);
      const content = (doc.metadata as any)?.content?.substring(0, 50) + '...';
      console.log(`   ${similarity}% similar: ${content}`);
    });
  }

  private async semanticClustering(): Promise<void> {
    // Simple clustering based on vector similarity
    const allDocs = await this.db.vsearch('documents', [0.5, 0.5, 0.5, 0.5], 10, true);

    const techDocs = allDocs.filter(doc => (doc.metadata as any)?.category === 'technology');
    const envDocs = allDocs.filter(doc => (doc.metadata as any)?.category === 'environment');

    console.log('📈 Semantic clustering results:');
    console.log(`   Technology cluster: ${techDocs.length} documents`);
    console.log(`   Environment cluster: ${envDocs.length} documents`);
  }

  /**
   * Run the complete demo
   */
  async runDemo(): Promise<void> {
    try {
      await this.initializeDataset();

      // Demonstrate core functionality
      await this.semanticSearch('machine learning algorithms');
      await this.semanticSearch('climate change effects');
      await this.filteredSearch();
      await this.realTimeUpdates();

      // Advanced features
      await this.performanceBenchmark();
      await this.aiUseCases();

      console.log('\n🎉 Monarch Vector Database demo completed successfully!');
      console.log('🚀 Monarch is ready for production AI workloads!');

    } catch (error) {
      console.error('❌ Demo failed:', error);
    }
  }
}

// Run the demo
const demo = new VectorDatabaseDemo();
demo.runDemo().catch(console.error);
