/**
 * Performance Load Testing
 * 
 * Automated load tests for performance regression detection
 */

import { Monarch } from '../../src/monarch';

async function runLoadTest() {
  const db = new Monarch();
  const collection = db.addCollection('load_test');

  const testSizes = [100, 1000, 10000];
  const results: Record<string, any> = {};

  for (const size of testSizes) {
    console.log(`\nTesting with ${size} documents...`);

    // Insert performance
    const insertStart = performance.now();
    const docs = Array.from({ length: size }, (_, i) => ({
      id: i,
      name: `Document ${i}`,
      value: Math.random(),
      timestamp: Date.now()
    }));
    
    for (const doc of docs) {
      await collection.insert(doc);
    }
    const insertTime = performance.now() - insertStart;
    results[`insert_${size}`] = {
      time: insertTime,
      throughput: size / (insertTime / 1000)
    };

    // Query performance
    const queryStart = performance.now();
    await collection.find({ value: { $gt: 0.5 } });
    const queryTime = performance.now() - queryStart;
    results[`query_${size}`] = {
      time: queryTime,
      throughput: size / (queryTime / 1000)
    };

    // Update performance
    const updateStart = performance.now();
    await collection.update({ value: { $gt: 0.5 } }, { $set: { updated: true } });
    const updateTime = performance.now() - updateStart;
    results[`update_${size}`] = {
      time: updateTime,
      throughput: size / (updateTime / 1000)
    };
  }

  return results;
}

// Export for use in CI/CD
export { runLoadTest };

if (require.main === module) {
  runLoadTest().then(results => {
    console.log('\n=== Load Test Results ===');
    console.log(JSON.stringify(results, null, 2));
  });
}

