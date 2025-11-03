#!/usr/bin/env tsx

import { Monarch, globalMonitor } from './src';

// Performance demonstration example
async function performanceDemo() {
  console.log('🚀 Monarch Performance & Caching Demo\n');

  const db = new Monarch();
  const users = db.addCollection('users');
  const products = db.addCollection('products');

  // Create indices for better performance
  users.createIndex('email');
  users.createIndex('age');
  products.createIndex('category');

  console.log('📊 Performance monitoring enabled automatically\n');

  // Insert test data
  console.log('📝 Inserting test data...');
  const userDocs = Array.from({ length: 5000 }, (_, i) => ({
    name: `User${i}`,
    email: `user${i}@example.com`,
    age: Math.floor(Math.random() * 80) + 18,
    city: ['New York', 'London', 'Tokyo', 'Paris', 'Berlin'][Math.floor(Math.random() * 5)]
  }));

  const productDocs = Array.from({ length: 2000 }, (_, i) => ({
    name: `Product${i}`,
    price: Math.floor(Math.random() * 1000) + 10,
    category: ['electronics', 'books', 'clothing', 'home', 'sports'][Math.floor(Math.random() * 5)],
    inStock: Math.random() > 0.2
  }));

  users.insert(userDocs);
  products.insert(productDocs);

  console.log(`✅ Inserted ${userDocs.length} users and ${productDocs.length} products\n`);

  // Demonstrate query caching
  console.log('🔍 Query Performance with Caching:\n');

  // First query (will be cached)
  console.log('First query (cold cache):');
  const start1 = performance.now();
  const adults = users.find({ age: { $gte: 30 } });
  const time1 = performance.now() - start1;
  console.log(`  Found ${adults.length} adults in ${time1.toFixed(2)}ms`);

  // Second identical query (should use cache)
  console.log('Second identical query (warm cache):');
  const start2 = performance.now();
  const adults2 = users.find({ age: { $gte: 30 } });
  const time2 = performance.now() - start2;
  console.log(`  Found ${adults2.length} adults in ${time2.toFixed(2)}ms`);

  const speedup = time1 / time2;
  console.log(`  🚀 Cache speedup: ${speedup.toFixed(1)}x faster\n`);

  // Index vs non-index comparison
  console.log('⚡ Index Performance Comparison:\n');

  // Query on indexed field
  const start3 = performance.now();
  const nyUsers = users.find({ city: 'New York' });
  const time3 = performance.now() - start3;
  console.log(`  Indexed query (city): ${nyUsers.length} results in ${time3.toFixed(2)}ms`);

  // Query on non-indexed field (different field)
  const start4 = performance.now();
  const nameQuery = users.find({ name: 'User100' }); // Exact match on non-indexed field
  const time4 = performance.now() - start4;
  console.log(`  Non-indexed query: ${nameQuery.length} results in ${time4.toFixed(2)}ms`);

  console.log('\n💾 Cache Statistics:');
  const cacheStats = users.getPerformanceMetrics().cacheStats;
  console.log(`  Cache size: ${cacheStats.size}/${cacheStats.maxSize}`);
  console.log(`  Cache hit rate: ${(cacheStats.hitRate * 100).toFixed(1)}%`);

  // Complex queries
  console.log('\n🔧 Complex Query Performance:');
  const start5 = performance.now();
  const expensiveElectronics = products.find({
    price: { $gte: 500, $lt: 800 },
    category: 'electronics',
    inStock: true
  });
  const time5 = performance.now() - start5;
  console.log(`  Complex query: ${expensiveElectronics.length} results in ${time5.toFixed(2)}ms`);

  // Performance report
  console.log('\n📈 Performance Report:');
  console.log(users.getPerformanceReport());

  console.log('\n✨ Demo completed! Monarch includes:');
  console.log('  • Automatic performance monitoring');
  console.log('  • Intelligent query caching');
  console.log('  • Efficient Map-based storage');
  console.log('  • Batch index operations');
  console.log('  • O(1) document access/removal');
}

// Run the demo
performanceDemo().catch(console.error);
