#!/usr/bin/env tsx

import { Monarch } from 'monarch-db';

// Example usage of Monarch Database
async function main() {
  console.log('🚀 Monarch Database Example\n');

  // Create a database instance
  const db = new Monarch();

  // Create collections
  const users = db.addCollection('users');
  const products = db.addCollection('products');

  // Create indexes for faster lookups
  users.createIndex('email');
  products.createIndex('category');

  console.log('📝 Inserting sample data...');

  // Insert users
  users.insert([
    { name: 'Alice Johnson', email: 'alice@example.com', age: 30, city: 'New York' },
    { name: 'Bob Smith', email: 'bob@example.com', age: 25, city: 'San Francisco' },
    { name: 'Charlie Brown', email: 'charlie@example.com', age: 35, city: 'Chicago' },
    { name: 'Diana Prince', email: 'diana@example.com', age: 28, city: 'Boston' }
  ]);

  // Insert products
  products.insert([
    { name: 'Laptop', price: 1200, category: 'electronics', inStock: true },
    { name: 'Book', price: 20, category: 'books', inStock: true },
    { name: 'Headphones', price: 150, category: 'electronics', inStock: false },
    { name: 'T-shirt', price: 25, category: 'clothing', inStock: true },
    { name: 'Coffee Mug', price: 12, category: 'home', inStock: true }
  ]);

  console.log('✅ Data inserted successfully!\n');

  // Demonstrate queries
  console.log('🔍 Query Examples:\n');

  // Find all users
  console.log('All users:', users.find().length);

  // Find users by age range
  const adults = users.find({ age: { $gte: 30 } });
  console.log(`Users 30+: ${adults.length} (${adults.map(u => u.name).join(', ')})`);

  // Find user by email (using index)
  const alice = users.find({ email: 'alice@example.com' });
  console.log(`User with email alice@example.com: ${alice[0]?.name}`);

  // Complex product query
  const affordableElectronics = products.find({
    price: { $lt: 500 },
    category: 'electronics',
    inStock: true
  });
  console.log(`Affordable electronics in stock: ${affordableElectronics.map(p => p.name).join(', ')}`);

  // Update example
  const updated = users.update({ city: 'New York' }, { city: 'NYC' });
  console.log(`\n📝 Updated ${updated} user(s) from New York to NYC`);

  // Remove example
  const removed = products.remove({ price: { $lt: 15 } });
  console.log(`🗑️ Removed ${removed} cheap product(s)`);

  // Statistics
  const userStats = users.stats();
  const productStats = products.stats();
  const dbStats = db.stats();

  console.log('\n📊 Database Statistics:');
  console.log(`Collections: ${dbStats.collectionCount}`);
  console.log(`Total Documents: ${dbStats.totalDocuments}`);
  console.log(`Users Collection: ${userStats.documentCount} documents, ${userStats.indexCount} indexes`);
  console.log(`Products Collection: ${productStats.documentCount} documents, ${productStats.indexCount} indexes`);

  // Health check (new feature)
  console.log('\n🏥 Health Check:');
  const health = await db.healthCheck();
  console.log(`Status: ${health.status}`);
  console.log(`Uptime: ${health.uptime}ms`);
  console.log(`Collections: ${health.collections}`);
  console.log(`Memory Usage: ${(health.memoryUsage / 1024 / 1024).toFixed(2)} MB`);

  console.log('\n🎉 Example completed successfully!');
}

// Run the example
main().catch(console.error);
