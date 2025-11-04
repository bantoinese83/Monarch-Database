/**
 * Monarch Database Vector Search Demo
 *
 * This example demonstrates how to use Monarch's vector search capabilities
 * for AI/ML workloads, similarity search, and recommendation systems.
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

// Sample product data with embeddings
interface Product {
  id: string;
  name: string;
  description: string;
  category: string;
  price: number;
  vector: number[]; // 128-dimensional embedding
}

// Generate mock product data with embeddings
function generateProductData(): Product[] {
  const products: Product[] = [
    {
      id: 'laptop-001',
      name: 'MacBook Pro 16"',
      description: 'High-performance laptop for developers and creative professionals',
      category: 'electronics',
      price: 2499,
      vector: Array.from({ length: 128 }, () => Math.random() * 2 - 1)
    },
    {
      id: 'laptop-002',
      name: 'Dell XPS 13',
      description: 'Ultra-portable laptop with premium build quality',
      category: 'electronics',
      price: 1299,
      vector: Array.from({ length: 128 }, () => Math.random() * 2 - 1)
    },
    {
      id: 'book-001',
      name: 'Clean Code',
      description: 'A handbook of agile software craftsmanship',
      category: 'books',
      price: 45,
      vector: Array.from({ length: 128 }, () => Math.random() * 2 - 1)
    },
    {
      id: 'book-002',
      name: 'The Pragmatic Programmer',
      description: 'Your journey to mastery in software development',
      category: 'books',
      price: 39,
      vector: Array.from({ length: 128 }, () => Math.random() * 2 - 1)
    },
    {
      id: 'headphones-001',
      name: 'Sony WH-1000XM4',
      description: 'Industry-leading noise canceling wireless headphones',
      category: 'electronics',
      price: 349,
      vector: Array.from({ length: 128 }, () => Math.random() * 2 - 1)
    }
  ];

  return products;
}

// Cosine similarity function for demo purposes
function cosineSimilarity(a: number[], b: number[]): number {
  const dotProduct = a.reduce((sum, val, i) => sum + val * b[i], 0);
  const magnitudeA = Math.sqrt(a.reduce((sum, val) => sum + val * val, 0));
  const magnitudeB = Math.sqrt(b.reduce((sum, val) => sum + val * val, 0));
  return dotProduct / (magnitudeA * magnitudeB);
}

// Generate embedding for a text query (mock implementation)
function generateQueryEmbedding(query: string): number[] {
  // In a real implementation, this would use a model like OpenAI embeddings
  // For demo purposes, we'll create a deterministic but varied embedding
  const seed = query.split('').reduce((hash, char) => {
    return ((hash << 5) - hash) + char.charCodeAt(0);
  }, 0);

  const embedding: number[] = [];
  for (let i = 0; i < 128; i++) {
    embedding.push(Math.sin(seed + i) * Math.cos(seed * i));
  }

  return embedding;
}

async function vectorSearchDemo() {
  console.log('🚀 Monarch Database Vector Search Demo\n');

  // Initialize database
  const db = new Monarch();
  const structures = db.getOptimizedDataStructures();

  // Generate and index product data
  console.log('📦 Indexing product data...');
  const products = generateProductData();

  for (const product of products) {
    await structures.vadd('products', product.id, product.vector, {
      name: product.name,
      description: product.description,
      category: product.category,
      price: product.price
    });
  }

  console.log(`✅ Indexed ${products.length} products\n`);

  // Example 1: Find similar laptops
  console.log('💻 Example 1: Find similar laptops');
  const laptopQuery = generateQueryEmbedding('high performance laptop for programming');
  const similarLaptops = await structures.vsearch('products', laptopQuery, 3);

  console.log('Top 3 similar products:');
  for (const result of similarLaptops) {
    const product = products.find(p => p.id === result.id);
    if (product) {
      console.log(`  • ${product.name} (${product.category}) - $${product.price}`);
      console.log(`    Score: ${(result.score * 100).toFixed(1)}%`);
    }
  }
  console.log();

  // Example 2: Recommendation system
  console.log('🎯 Example 2: Recommendation system');
  const userPurchaseHistory = ['laptop-001', 'book-001'];

  // Create user profile vector by averaging purchased items
  const userProfileVector = userPurchaseHistory
    .map(id => products.find(p => p.id === id)?.vector || [])
    .filter(v => v.length > 0)
    .reduce((acc, vec) => {
      return acc.map((val, i) => val + vec[i]);
    }, new Array(128).fill(0))
    .map(val => val / userPurchaseHistory.length);

  const recommendations = await structures.vsearch('products', userProfileVector, 5);

  console.log('Recommended products for user:');
  for (const result of recommendations) {
    const product = products.find(p => p.id === result.id);
    if (product && !userPurchaseHistory.includes(product.id)) {
      console.log(`  • ${product.name} (${product.category}) - $${product.price}`);
    }
  }
  console.log();

  // Example 3: Category-specific search
  console.log('📚 Example 3: Category-specific search with filtering');

  // First, let's add category filtering by creating separate collections
  const electronicsCollection = products.filter(p => p.category === 'electronics');
  const booksCollection = products.filter(p => p.category === 'books');

  for (const product of electronicsCollection) {
    await structures.vadd('electronics', product.id, product.vector, {
      name: product.name,
      description: product.description,
      price: product.price
    });
  }

  for (const product of booksCollection) {
    await structures.vadd('books', product.id, product.vector, {
      name: product.name,
      description: product.description,
      price: product.price
    });
  }

  const bookQuery = generateQueryEmbedding('programming and software development books');
  const techBooks = await structures.vsearch('books', bookQuery, 2);

  console.log('Top programming books:');
  for (const result of techBooks) {
    const product = products.find(p => p.id === result.id);
    if (product) {
      console.log(`  • ${product.name} - $${product.price}`);
    }
  }
  console.log();

  // Example 4: Performance comparison with traditional search
  console.log('⚡ Example 4: Performance comparison');

  const searchQuery = generateQueryEmbedding('wireless headphones with noise canceling');

  // Vector search
  const startVector = performance.now();
  const vectorResults = await structures.vsearch('products', searchQuery, 10);
  const vectorTime = performance.now() - startVector;

  // Traditional keyword search (simulated)
  const startKeyword = performance.now();
  const keywordResults = products.filter(p =>
    p.description.toLowerCase().includes('noise') ||
    p.description.toLowerCase().includes('wireless') ||
    p.name.toLowerCase().includes('headphones')
  ).slice(0, 10);
  const keywordTime = performance.now() - startKeyword;

  console.log(`Vector search: ${vectorTime.toFixed(2)}ms (${vectorResults.length} results)`);
  console.log(`Keyword search: ${keywordTime.toFixed(2)}ms (${keywordResults.length} results)`);
  console.log(`Performance improvement: ${(keywordTime / vectorTime).toFixed(1)}x faster`);
  console.log();

  console.log('✨ Vector search demo completed!');
  console.log('\n💡 Key benefits of Monarch vector search:');
  console.log('  • Semantic understanding (not just keyword matching)');
  console.log('  • Scalable similarity search');
  console.log('  • AI/ML workload optimization');
  console.log('  • Real-time recommendation systems');
  console.log('  • Multi-modal data handling');
}

// Run the demo
if (isMainModule()) {
  vectorSearchDemo().catch(console.error);
}

export { vectorSearchDemo };
