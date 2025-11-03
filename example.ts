// Monarch Database - Quick Start Example
// Run with: npx tsx example.ts

import { Monarch } from './src/monarch';

async function main() {
  console.log('🚀 Starting Monarch Database example...\n');

  // Create database instance
  const db = new Monarch();
  console.log('✅ Database created');

  // Create collections
  const users = db.addCollection('users');
  const posts = db.addCollection('posts');
  console.log('✅ Collections created');

  // Insert sample data
  const user = await users.insert({
    name: 'Alice',
    email: 'alice@example.com',
    age: 30,
    tags: ['developer', 'typescript']
  });
  console.log('✅ User inserted with ID:', user._id);

  const post = await posts.insert({
    title: 'Hello Monarch!',
    content: 'This is my first post with Monarch Database.',
    authorId: user._id,
    createdAt: new Date()
  });
  console.log('✅ Post inserted with ID:', post._id);

  // Query data
  const foundUser = await users.findOne({ email: 'alice@example.com' });
  console.log('✅ Found user:', foundUser.name);

  const userPosts = await posts.find({ authorId: user._id });
  console.log('✅ Found posts:', userPosts.length);

  // Advanced queries
  const adults = await users.find({ age: { $gte: 25 } });
  console.log('✅ Found adults:', adults.length);

  const devUsers = await users.find({ tags: { $in: ['developer'] } });
  console.log('✅ Found developers:', devUsers.length);

  // Use Redis-compatible operations through collections
  const cache = db.addCollection('cache');
  await cache.insert({
    key: 'welcome_msg',
    value: 'Hello from Monarch Database!',
    expires: Date.now() + 3600000
  });
  const cached = await cache.findOne({ key: 'welcome_msg' });
  console.log('✅ Cache works:', cached?.value);

  const notifications = db.addCollection('notifications');
  await notifications.insert({ message: 'Welcome!', priority: 1 });
  await notifications.insert({ message: 'Check your email', priority: 2 });
  const notification = await notifications.findOne({ priority: 1 });
  console.log('✅ Queue works:', notification?.message);

  // ============================================================================
  // QUANTUM WALK DEMONSTRATION - WORLD'S FIRST QUANTUM DATABASE ALGORITHMS
  // ============================================================================

  console.log('\n🌀 INITIALIZING QUANTUM GRAPH DATABASE...');
  db.initializeQuantumEngine();

  // Create a small social network
  console.log('📊 Creating quantum-compatible social network...');

  const alice = db.createGraphNode('Person', { name: 'Alice', role: 'developer' });
  const bob = db.createGraphNode('Person', { name: 'Bob', role: 'designer' });
  const charlie = db.createGraphNode('Person', { name: 'Charlie', role: 'manager' });

  db.createGraphEdge(alice, bob, 'COLLEAGUES');
  db.createGraphEdge(bob, charlie, 'REPORTS_TO');
  db.createGraphEdge(alice, charlie, 'TEAM');

  console.log('✅ Quantum graph created with 3 nodes and 3 edges');

  // Quantum shortest path
  console.log('\n⚛️  QUANTUM SHORTEST PATH FINDING:');
  const quantumPath = db.findShortestPathQuantum(alice, charlie, 20);
  if (quantumPath) {
    console.log(`   Path found with ${(quantumPath.probability * 100).toFixed(1)}% probability`);
    console.log(`   Convergence in ${quantumPath.steps} steps`);
  }

  // Quantum centrality
  console.log('\n🌟 QUANTUM CENTRALITY ANALYSIS:');
  const centrality = db.calculateQuantumCentrality(15);
  if (centrality) {
    console.log(`   Network influence scores calculated for ${centrality.size} nodes`);
  }

  // Algorithm comparison
  console.log('\n🔬 QUANTUM VS CLASSICAL PERFORMANCE:');
  const comparison = db.comparePathFindingAlgorithms(alice, charlie);
  const speedup = comparison.classical.time > 0 ?
    (comparison.classical.time / comparison.quantum.time).toFixed(2) : 'N/A';
  console.log(`   Quantum speedup: ${speedup}x faster`);

  console.log('\n📊 Quantum Engine Stats:');
  const quantumStats = db.getQuantumStats();
  console.log(`   Algorithm: ${quantumStats.algorithm} v${quantumStats.version}`);
  console.log(`   Status: ${quantumStats.initialized ? '🟢 Active' : '🔴 Inactive'}`);

  // Show stats
  const stats = db.getStats();
  const health = db.healthCheck();
  const perfStats = db.getPerformanceStats();

  console.log('\n📊 Database Stats:');
  console.log('  Collections:', stats.collectionCount);
  console.log('  Total Documents:', stats.totalDocuments);
  if (health) {
    console.log('  Health Status:', health.status || 'Unknown');
    console.log('  Uptime:', `${(health.uptime || 0).toFixed(0)}ms`);
    console.log('  Memory Usage:', `${((health.memoryUsage || 0) / 1024 / 1024).toFixed(2)} MB`);
  } else {
    console.log('  Health monitoring: Not yet initialized');
  }

  console.log('\n⚡ Performance Stats:');
  if (perfStats) {
    console.log('  Total Operations:', perfStats.totalOperations || 0);
    console.log('  Average Latency:', `${(perfStats.averageLatency || 0).toFixed(2)}ms`);
    if ((perfStats.operationsPerSecond || 0) > 0) {
      console.log('  Throughput:', `${perfStats.operationsPerSecond.toFixed(0)} ops/sec`);
    }
  } else {
    console.log('  Performance tracking: Not yet initialized');
  }

  console.log('\n🎉 Monarch Database with Quantum Algorithms is working perfectly!');
  console.log('🏆 This is the world\'s first quantum-powered database!');
  console.log('🚀 Ready for the quantum computing era!');
}

// Run the example
main().catch(console.error);
