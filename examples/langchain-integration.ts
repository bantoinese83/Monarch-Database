/**
 * LangChain + Monarch Database Integration
 *
 * This example shows how to use Monarch as a vector store for LangChain,
 * enabling RAG (Retrieval-Augmented Generation) applications.
 */

import { Monarch } from 'monarch-database-quantum';

/**
 * Check if the current module is the main entry point
 * Compatible with both CommonJS and ES module environments
 */
function isMainModule(): boolean {
  // ES module environment
  if (typeof import.meta !== 'undefined' && import.meta.url) {
    try {
      // Get the current file URL and compare with the main entry point
      const currentUrl = new URL(import.meta.url);
      const mainUrl = new URL(process.argv[1], `file://${process.cwd()}/`);
      return currentUrl.href === mainUrl.href;
    } catch {
      return false;
    }
  }

  // CommonJS environment
  if (typeof require !== 'undefined' && require.main) {
    return require.main === module;
  }

  // Fallback - assume not main module if we can't determine
  return false;
}

// Mock LangChain-like interfaces (in real usage, import from 'langchain')
interface Document {
  pageContent: string;
  metadata: Record<string, any>;
}

interface VectorStore {
  addDocuments(documents: Document[]): Promise<void>;
  similaritySearch(query: string, k?: number): Promise<Document[]>;
}

// Monarch Vector Store implementation for LangChain
class MonarchVectorStore implements VectorStore {
  constructor(
    private db: Monarch,
    private collectionName: string = 'documents'
  ) {}

  // Generate simple embeddings (in production, use OpenAI/TensorFlow/etc.)
  private generateEmbedding(text: string): number[] {
    // Simple hash-based embedding for demo
    const hash = text.split('').reduce((a, b) => {
      a = ((a << 5) - a) + b.charCodeAt(0);
      return a & a;
    }, 0);

    const embedding: number[] = [];
    for (let i = 0; i < 128; i++) {
      embedding.push(Math.sin(hash + i) * Math.cos(hash * i));
    }
    return embedding;
  }

  async addDocuments(documents: Document[]): Promise<void> {
    const structures = this.db.getOptimizedDataStructures();

    for (let i = 0; i < documents.length; i++) {
      const doc = documents[i];
      const embedding = this.generateEmbedding(doc.pageContent);

      await structures.vadd(
        this.collectionName,
        `doc_${i}`,
        embedding,
        {
          content: doc.pageContent,
          metadata: doc.metadata,
          id: `doc_${i}`
        }
      );
    }
  }

  async similaritySearch(query: string, k: number = 4): Promise<Document[]> {
    const structures = this.db.getOptimizedDataStructures();
    const queryEmbedding = this.generateEmbedding(query);

    const results = await structures.vsearch(this.collectionName, queryEmbedding, k);

    const documents: Document[] = [];
    for (const result of results) {
      // In a real implementation, you'd retrieve the full document data
      documents.push({
        pageContent: `Document ${result.id} content...`, // Mock content
        metadata: { score: result.score, id: result.id }
      });
    }

    return documents;
  }
}

// RAG Chain implementation
class RetrievalQAChain {
  constructor(
    private llm: any, // Mock LLM
    private retriever: any
  ) {}

  async call(inputs: { query: string }): Promise<{ text: string }> {
    // Retrieve relevant documents
    const docs = await this.retriever.similaritySearch(inputs.query, 3);

    // Create context from retrieved documents
    const context = docs.map(doc => doc.pageContent).join('\n\n');

    // Generate response using LLM (mocked)
    const prompt = `Context: ${context}\n\nQuestion: ${inputs.query}\n\nAnswer:`;
    const response = `Based on the retrieved information: ${context.substring(0, 200)}...`;

    return { text: response };
  }
}

async function langChainIntegrationDemo() {
  console.log('🦜 LangChain + Monarch Database Integration Demo\n');

  // Initialize Monarch
  const db = new Monarch();
  const vectorStore = new MonarchVectorStore(db, 'knowledge_base');

  // Sample documents for RAG
  const documents: Document[] = [
    {
      pageContent: 'Monarch Database is a high-performance, in-memory database designed for modern applications. It combines the speed of Redis with the query power of MongoDB, plus advanced features like vector search for AI workloads.',
      metadata: { source: 'overview', category: 'introduction' }
    },
    {
      pageContent: 'Vector search in Monarch enables semantic similarity matching using cosine similarity. It supports high-dimensional vectors and provides fast approximate nearest neighbor search with configurable precision.',
      metadata: { source: 'features', category: 'vector-search' }
    },
    {
      pageContent: 'Graph operations in Monarch allow you to model and query complex relationships. The graph database supports adjacency lists, traversals, and pattern matching for connected data analysis.',
      metadata: { source: 'features', category: 'graph-database' }
    },
    {
      pageContent: 'Enterprise features include durability with WAL and snapshots, multi-region clustering, comprehensive security with RBAC and audit logging, and full observability with Prometheus metrics.',
      metadata: { source: 'features', category: 'enterprise' }
    },
    {
      pageContent: 'Performance benchmarks show Monarch achieving 241 operations per second for inserts and 4.47K operations per second for indexed queries, with sub-millisecond latency.',
      metadata: { source: 'performance', category: 'benchmarks' }
    }
  ];

  console.log('📚 Adding documents to Monarch vector store...');
  await vectorStore.addDocuments(documents);
  console.log(`✅ Added ${documents.length} documents\n`);

  // Mock LLM for demo (in real usage, use ChatOpenAI from langchain)
  const mockLLM = {
    call: async (prompt: string) => {
      // Simple mock responses based on keywords
      if (prompt.includes('performance')) {
        return 'Monarch Database achieves exceptional performance with 241 ops/sec for inserts and 4.47K ops/sec for indexed queries.';
      }
      if (prompt.includes('vector search')) {
        return 'Vector search uses cosine similarity for semantic matching and supports high-dimensional embeddings.';
      }
      if (prompt.includes('graph')) {
        return 'Graph operations support adjacency lists, traversals, and complex relationship queries.';
      }
      return 'Monarch Database is a high-performance in-memory database with advanced features for modern applications.';
    }
  };

  // Create RAG chain
  const retriever = vectorStore;
  const chain = new RetrievalQAChain(mockLLM, retriever);

  // Example queries
  const queries = [
    'What are the performance benchmarks for Monarch Database?',
    'How does vector search work in Monarch?',
    'What graph operations are supported?',
    'What enterprise features does Monarch offer?'
  ];

  console.log('🤖 Running RAG queries...\n');

  for (const query of queries) {
    console.log(`❓ Query: "${query}"`);

    // Retrieve relevant documents
    const relevantDocs = await vectorStore.similaritySearch(query, 2);
    console.log(`📄 Retrieved ${relevantDocs.length} relevant documents`);

    // Generate answer using RAG
    const result = await chain.call({ query });
    console.log(`💬 Answer: ${result.text}\n`);
  }

  console.log('✨ LangChain integration demo completed!');
  console.log('\n💡 Key benefits of Monarch + LangChain integration:');
  console.log('  • Persistent vector storage with ACID guarantees');
  console.log('  • High-performance similarity search');
  console.log('  • Scalable document retrieval');
  console.log('  • RAG applications with reliable data foundation');
  console.log('  • Enterprise-grade vector operations');
  console.log('  • Integration with existing LangChain workflows');
}

// Export for use in other examples
export { MonarchVectorStore, RetrievalQAChain, langChainIntegrationDemo };

// Run demo if executed directly
if (isMainModule()) {
  langChainIntegrationDemo().catch(console.error);
}
