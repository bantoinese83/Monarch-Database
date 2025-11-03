// Monarch Database - Quick Start Example
// Run with: node example.js

import { Monarch } from './src/monarch.js';

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
  console.log('✅ User inserted:', user.name);

  const post = await posts.insert({
    title: 'Hello Monarch!',
    content: 'This is my first post with Monarch Database.',
    authorId: user._id,
    createdAt: new Date()
  });
  console.log('✅ Post inserted:', post.title);

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

  // Redis-compatible operations
  await db.set('cache:key', { data: 'cached value', expires: Date.now() + 3600000 });
  const cached = await db.get('cache:key');
  console.log('✅ Cache works:', cached.data);

  await db.lpush('notifications', 'Welcome!', 'Check your email');
  const notification = await db.lpop('notifications');
  console.log('✅ Queue works:', notification);

  // Show stats
  const stats = db.getStats();
  console.log('\n📊 Database Stats:');
  console.log('  Collections:', stats.collectionCount);
  console.log('  Total Documents:', stats.totalDocuments);

  console.log('\n🎉 Monarch Database is working perfectly!');
  console.log('Ready for production use! 🚀');
}

// Run the example
main().catch(console.error);
