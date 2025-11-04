/**
 * Monarch Database Graph Analytics Demo
 *
 * This example demonstrates how to use Monarch's graph database capabilities
 * for social network analysis, recommendation systems, and connected data analytics.
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

interface User {
  id: string;
  name: string;
  interests: string[];
  location: string;
}

interface Post {
  id: string;
  content: string;
  authorId: string;
  timestamp: number;
  tags: string[];
}

// Social network dataset
function createSocialNetworkData() {
  const users: User[] = [
    { id: 'alice', name: 'Alice Johnson', interests: ['tech', 'ai', 'coding'], location: 'San Francisco' },
    { id: 'bob', name: 'Bob Smith', interests: ['design', 'ux', 'art'], location: 'New York' },
    { id: 'charlie', name: 'Charlie Brown', interests: ['tech', 'startup', 'finance'], location: 'Austin' },
    { id: 'diana', name: 'Diana Prince', interests: ['ai', 'research', 'teaching'], location: 'Boston' },
    { id: 'eve', name: 'Eve Wilson', interests: ['design', 'coding', 'music'], location: 'Seattle' },
    { id: 'frank', name: 'Frank Miller', interests: ['finance', 'investing', 'tech'], location: 'Chicago' }
  ];

  const posts: Post[] = [
    { id: 'post1', content: 'Excited about the future of AI!', authorId: 'alice', timestamp: Date.now() - 86400000, tags: ['ai', 'future'] },
    { id: 'post2', content: 'Just launched my new app!', authorId: 'charlie', timestamp: Date.now() - 43200000, tags: ['startup', 'launch'] },
    { id: 'post3', content: 'Beautiful design inspiration', authorId: 'bob', timestamp: Date.now() - 21600000, tags: ['design', 'inspiration'] },
    { id: 'post4', content: 'Research breakthrough in machine learning', authorId: 'diana', timestamp: Date.now() - 10800000, tags: ['research', 'ml'] }
  ];

  return { users, posts };
}

async function graphAnalyticsDemo() {
  console.log('🚀 Monarch Database Graph Analytics Demo\n');

  const db = new Monarch();
  const structures = db.getOptimizedDataStructures();

  const { users, posts } = createSocialNetworkData();

  // Build social graph
  console.log('🏗️  Building social network graph...');

  // Create user nodes
  for (const user of users) {
    await structures.gcreateNode('social', user.id, {
      name: user.name,
      interests: user.interests,
      location: user.location,
      type: 'user'
    });
  }

  // Create post nodes
  for (const post of posts) {
    await structures.gcreateNode('social', post.id, {
      content: post.content,
      timestamp: post.timestamp,
      tags: post.tags,
      type: 'post'
    });
  }

  // Create relationships
  console.log('🔗 Creating relationships...');

  // User follows relationships (simulated social connections)
  const follows = [
    ['alice', 'charlie'], ['alice', 'diana'], ['alice', 'eve'],
    ['bob', 'eve'], ['bob', 'alice'],
    ['charlie', 'frank'], ['charlie', 'alice'],
    ['diana', 'alice'], ['diana', 'charlie'],
    ['eve', 'bob'], ['eve', 'alice'],
    ['frank', 'charlie'], ['frank', 'alice']
  ];

  for (const [follower, following] of follows) {
    await structures.gcreateEdge('social', follower, following, 'follows', {
      since: Date.now() - Math.random() * 365 * 24 * 60 * 60 * 1000, // Random follow date within last year
      strength: Math.random()
    });
  }

  // Author relationships (posts to authors)
  for (const post of posts) {
    await structures.gcreateEdge('social', post.id, post.authorId, 'authored_by', {
      timestamp: post.timestamp
    });
  }

  console.log('✅ Graph built successfully\n');

  // Example 1: Find mutual connections
  console.log('🤝 Example 1: Finding mutual connections');
  const aliceConnections = await structures.ggetNeighbors('social', 'alice');
  const bobConnections = await structures.ggetNeighbors('social', 'bob');

  const aliceFollowerIds = aliceConnections.map(conn => conn.target);
  const bobFollowerIds = bobConnections.map(conn => conn.target);

  const mutualConnections = aliceFollowerIds.filter(id => bobFollowerIds.includes(id));

  console.log('Alice and Bob\'s mutual connections:');
  for (const userId of mutualConnections) {
    const user = users.find(u => u.id === userId);
    if (user) {
      console.log(`  • ${user.name} (${user.location})`);
    }
  }
  console.log();

  // Example 2: Find users with similar interests
  console.log('🎯 Example 2: Interest-based recommendations');
  const targetUser = users.find(u => u.id === 'alice')!;
  const similarUsers: Array<{ user: User; score: number }> = [];

  for (const user of users.filter(u => u.id !== 'alice')) {
    const commonInterests = targetUser.interests.filter(interest =>
      user.interests.includes(interest)
    );
    const score = commonInterests.length / Math.max(targetUser.interests.length, user.interests.length);
    if (score > 0) {
      similarUsers.push({ user, score });
    }
  }

  similarUsers.sort((a, b) => b.score - a.score);

  console.log('Users similar to Alice based on interests:');
  for (const { user, score } of similarUsers.slice(0, 3)) {
    console.log(`  • ${user.name} (${(score * 100).toFixed(0)}% match)`);
  }
  console.log();

  // Example 3: Content discovery through social connections
  console.log('📱 Example 3: Content discovery via social graph');

  // Find posts from people Alice follows
  const aliceFollows = aliceConnections.map(conn => conn.target);
  const relevantPosts: Post[] = [];

  for (const post of posts) {
    if (aliceFollows.includes(post.authorId)) {
      relevantPosts.push(post);
    }
  }

  console.log('Recent posts from people Alice follows:');
  for (const post of relevantPosts.slice(0, 3)) {
    const author = users.find(u => u.id === post.authorId);
    console.log(`  • "${post.content}" by ${author?.name}`);
    console.log(`    Tags: ${post.tags.join(', ')}`);
  }
  console.log();

  // Example 4: Graph traversal for influence analysis
  console.log('📊 Example 4: Influence analysis through graph traversal');

  // Simple PageRank-style influence calculation
  const influence: Record<string, number> = {};

  // Initialize influence scores
  for (const user of users) {
    influence[user.id] = 1.0;
  }

  // Simple iterative influence calculation
  for (let iteration = 0; iteration < 3; iteration++) {
    const newInfluence = { ...influence };

    for (const user of users) {
      const followers = await structures.ggetNeighbors('social', user.id);
      const influenceShare = influence[user.id] / Math.max(followers.length, 1);

      for (const follower of followers) {
        newInfluence[follower.target] += influenceShare * 0.1;
      }
    }

    influence = newInfluence;
  }

  // Sort by influence
  const influenceRanking = Object.entries(influence)
    .map(([id, score]) => ({ user: users.find(u => u.id === id)!, score }))
    .sort((a, b) => b.score - a.score);

  console.log('Top influencers in the network:');
  for (const { user, score } of influenceRanking.slice(0, 3)) {
    console.log(`  • ${user.name}: ${(score).toFixed(2)} influence score`);
  }
  console.log();

  // Example 5: Path finding and network analysis
  console.log('🔍 Example 5: Network connectivity analysis');

  // Find shortest paths between users
  const paths: Array<{ from: string; to: string; path: string[] }> = [];

  // Simple BFS for path finding
  async function findPath(startId: string, endId: string): Promise<string[] | null> {
    const visited = new Set<string>();
    const queue = [{ node: startId, path: [startId] }];

    while (queue.length > 0) {
      const { node, path } = queue.shift()!;

      if (node === endId) {
        return path;
      }

      if (visited.has(node)) continue;
      visited.add(node);

      const neighbors = await structures.ggetNeighbors('social', node);
      for (const neighbor of neighbors) {
        if (!visited.has(neighbor.target)) {
          queue.push({
            node: neighbor.target,
            path: [...path, neighbor.target]
          });
        }
      }
    }

    return null;
  }

  // Find connection paths
  const path1 = await findPath('alice', 'frank');
  const path2 = await findPath('bob', 'diana');

  console.log('Connection paths:');
  if (path1) {
    const names = path1.map(id => users.find(u => u.id === id)?.name);
    console.log(`  Alice → Frank: ${names.join(' → ')}`);
  }
  if (path2) {
    const names = path2.map(id => users.find(u => u.id === id)?.name);
    console.log(`  Bob → Diana: ${names.join(' → ')}`);
  }
  console.log();

  console.log('✨ Graph analytics demo completed!');
  console.log('\n💡 Key benefits of Monarch graph analytics:');
  console.log('  • Native graph data modeling');
  console.log('  • Efficient relationship queries');
  console.log('  • Social network analysis');
  console.log('  • Recommendation algorithms');
  console.log('  • Path finding and connectivity');
  console.log('  • Influence and centrality metrics');
}

// Run the demo
if (isMainModule()) {
  graphAnalyticsDemo().catch(console.error);
}

export { graphAnalyticsDemo };
