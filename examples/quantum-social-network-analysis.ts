/**
 * Quantum Social Network Analysis Example
 *
 * This example demonstrates using Monarch's quantum algorithms for
 * advanced social network analysis - finding influencers, communities,
 * and predicting connections in social graphs.
 *
 * Real-world applications:
 * - Influencer marketing optimization
 * - Community detection for targeted advertising
 * - Viral content prediction
 * - Social recommendation systems
 */

import { Monarch } from '../src/index';
import { isMainModule } from '../src/utils';

async function quantumSocialNetworkAnalysis() {
  console.log('🌀 QUANTUM SOCIAL NETWORK ANALYSIS');
  console.log('==================================\n');

  const db = new Monarch();

  // Initialize quantum engine
  console.log('Initializing quantum engine...');
  await db.initializeQuantumEngine();

  // Create a realistic social network graph
  console.log('Building social network graph...');
  const users = [
    { id: 'alice', name: 'Alice Johnson', interests: ['tech', 'ai', 'startups'] },
    { id: 'bob', name: 'Bob Smith', interests: ['finance', 'investing', 'blockchain'] },
    { id: 'charlie', name: 'Charlie Brown', interests: ['music', 'art', 'design'] },
    { id: 'diana', name: 'Diana Prince', interests: ['fitness', 'health', 'nutrition'] },
    { id: 'eve', name: 'Eve Wilson', interests: ['travel', 'photography', 'food'] },
    { id: 'frank', name: 'Frank Miller', interests: ['gaming', 'esports', 'streaming'] },
    { id: 'grace', name: 'Grace Lee', interests: ['science', 'research', 'education'] },
    { id: 'henry', name: 'Henry Ford', interests: ['automotive', 'engineering', 'innovation'] },
    { id: 'ivy', name: 'Ivy Chen', interests: ['fashion', 'style', 'beauty'] },
    { id: 'jack', name: 'Jack Ryan', interests: ['politics', 'news', 'journalism'] },
    { id: 'kate', name: 'Kate Middleton', interests: ['royalty', 'charity', 'fashion'] },
    { id: 'liam', name: 'Liam Neeson', interests: ['acting', 'movies', 'theater'] },
    { id: 'maya', name: 'Maya Angelou', interests: ['poetry', 'literature', 'activism'] },
    { id: 'nathan', name: 'Nathan Drake', interests: ['adventure', 'gaming', 'archaeology'] },
    { id: 'olivia', name: 'Olivia Wilde', interests: ['acting', 'directing', 'feminism'] }
  ];

  // Add users to database
  for (const user of users) {
    await db.addDocument('users', user);
  }

  // Create social connections (friendships/follows)
  console.log('Creating social connections...');
  const connections = [
    // Tech cluster
    { from: 'alice', to: 'bob', type: 'friend', strength: 0.9 },
    { from: 'alice', to: 'grace', type: 'colleague', strength: 0.8 },
    { from: 'bob', to: 'henry', type: 'follow', strength: 0.7 },
    { from: 'grace', to: 'henry', type: 'colleague', strength: 0.8 },

    // Creative cluster
    { from: 'charlie', to: 'ivy', type: 'friend', strength: 0.9 },
    { from: 'charlie', to: 'liam', type: 'colleague', strength: 0.7 },
    { from: 'ivy', to: 'kate', type: 'follow', strength: 0.8 },
    { from: 'liam', to: 'olivia', type: 'colleague', strength: 0.8 },

    // Lifestyle cluster
    { from: 'diana', to: 'eve', type: 'friend', strength: 0.8 },
    { from: 'eve', to: 'maya', type: 'follow', strength: 0.7 },
    { from: 'maya', to: 'olivia', type: 'friend', strength: 0.6 },

    // Gaming cluster
    { from: 'frank', to: 'nathan', type: 'friend', strength: 0.9 },
    { from: 'nathan', to: 'jack', type: 'follow', strength: 0.7 },

    // Cross-cluster connections (bridges)
    { from: 'alice', to: 'olivia', type: 'follow', strength: 0.6 }, // Tech to Arts
    { from: 'bob', to: 'jack', type: 'follow', strength: 0.5 },   // Finance to Politics
    { from: 'charlie', to: 'eve', type: 'follow', strength: 0.4 }, // Arts to Travel
    { from: 'diana', to: 'grace', type: 'follow', strength: 0.5 }  // Health to Science
  ];

  // Add connections as graph edges
  for (const conn of connections) {
    await db.createGraphNode(conn.from, { name: users.find(u => u.id === conn.from)?.name });
    await db.createGraphNode(conn.to, { name: users.find(u => u.id === conn.to)?.name });
    await db.createGraphEdge(conn.from, conn.to, conn);
  }

  console.log(`✅ Created social network with ${users.length} users and ${connections.length} connections\n`);

  // QUANTUM ANALYSIS 1: Find Influencers using Quantum Centrality
  console.log('🎯 QUANTUM ANALYSIS 1: Finding Social Influencers');
  console.log('-------------------------------------------------');

  const centralityResults = await db.calculateQuantumCentrality();
  console.log('Quantum centrality scores (higher = more influential):');

  const sortedByCentrality = Object.entries(centralityResults)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 5);

  for (const [userId, centrality] of sortedByCentrality) {
    const user = users.find(u => u.id === userId);
    console.log(`  ${user?.name} (${userId}): ${centrality.toFixed(4)}`);
  }
  console.log();

  // QUANTUM ANALYSIS 2: Detect Communities using Quantum Community Detection
  console.log('🎯 QUANTUM ANALYSIS 2: Detecting Social Communities');
  console.log('---------------------------------------------------');

  const communities = await db.detectCommunitiesQuantum();
  console.log('Quantum community detection results:');

  // Group users by community
  const communityGroups: { [communityId: number]: string[] } = {};
  for (const [userId, communityId] of Object.entries(communities)) {
    if (!communityGroups[communityId]) {
      communityGroups[communityId] = [];
    }
    communityGroups[communityId].push(userId);
  }

  for (const [communityId, memberIds] of Object.entries(communityGroups)) {
    const memberNames = memberIds.map(id => users.find(u => u.id === id)?.name).join(', ');
    const interests = memberIds
      .map(id => users.find(u => u.id === id)?.interests || [])
      .flat()
      .filter((value, index, self) => self.indexOf(value) === index) // unique
      .join(', ');

    console.log(`  Community ${communityId}: ${memberNames}`);
    console.log(`    Shared interests: ${interests}\n`);
  }

  // QUANTUM ANALYSIS 3: Predict Missing Connections
  console.log('🎯 QUANTUM ANALYSIS 3: Predicting Missing Connections');
  console.log('-----------------------------------------------------');

  // Find users who should be connected but aren't
  const predictions: Array<{from: string, to: string, probability: number}> = [];

  for (let i = 0; i < users.length; i++) {
    for (let j = i + 1; j < users.length; j++) {
      const userA = users[i];
      const userB = users[j];

      // Check if they're already connected
      const existingEdge = connections.find(c =>
        (c.from === userA.id && c.to === userB.id) ||
        (c.from === userB.id && c.to === userA.id)
      );

      if (!existingEdge) {
        // Calculate connection probability based on shared interests and quantum centrality
        const sharedInterests = userA.interests.filter(interest =>
          userB.interests.includes(interest)
        ).length;

        const centralityA = centralityResults[userA.id] || 0;
        const centralityB = centralityResults[userB.id] || 0;

        const probability = (sharedInterests * 0.4) + (centralityA * centralityB * 0.6);

        if (probability > 0.3) { // Only show high-probability predictions
          predictions.push({
            from: userA.id,
            to: userB.id,
            probability
          });
        }
      }
    }
  }

  predictions.sort((a, b) => b.probability - a.probability).slice(0, 5);

  console.log('Top 5 predicted connections:');
  for (const pred of predictions) {
    const userA = users.find(u => u.id === pred.from);
    const userB = users.find(u => u.id === pred.to);
    console.log(`  ${userA?.name} ↔ ${userB?.name}: ${(pred.probability * 100).toFixed(1)}% probability`);
  }
  console.log();

  // QUANTUM ANALYSIS 4: Shortest Path Analysis for Information Flow
  console.log('🎯 QUANTUM ANALYSIS 4: Information Flow Analysis');
  console.log('-----------------------------------------------');

  // Find shortest paths between key influencers
  const influencerIds = sortedByCentrality.slice(0, 3).map(([id]) => id);

  for (let i = 0; i < influencerIds.length; i++) {
    for (let j = i + 1; j < influencerIds.length; j++) {
      const from = influencerIds[i];
      const to = influencerIds[j];

      try {
        const pathResult = await db.findShortestPathQuantum(from, to);
        const fromUser = users.find(u => u.id === from);
        const toUser = users.find(u => u.id === to);

        console.log(`  ${fromUser?.name} → ${toUser?.name}:`);
        console.log(`    Path: ${pathResult.path.join(' → ')}`);
        console.log(`    Length: ${pathResult.distance}`);
        console.log(`    Quantum advantage: ${pathResult.quantumAdvantage?.toFixed(2)}x\n`);
      } catch (error) {
        console.log(`  No path found between ${fromUser?.name} and ${toUser?.name}`);
      }
    }
  }

  // PERFORMANCE ANALYSIS
  console.log('📊 PERFORMANCE ANALYSIS');
  console.log('======================');

  const quantumStats = await db.getQuantumStats();
  console.log('Quantum algorithm performance:');
  console.log(`  Centrality calculations: ${quantumStats.totalCentralityCalculations || 0}`);
  console.log(`  Community detections: ${quantumStats.totalCommunityDetections || 0}`);
  console.log(`  Path findings: ${quantumStats.totalPathFindings || 0}`);
  console.log(`  Average quantum advantage: ${quantumStats.averageAdvantage?.toFixed(2)}x`);
  console.log(`  Cache efficiency: ${quantumStats.cacheEfficiency?.toFixed(1)}%`);

  console.log('\n✅ Quantum social network analysis completed!');
  console.log('💡 Insights:');
  console.log('   - Quantum centrality identified key influencers for marketing');
  console.log('   - Community detection revealed interest-based clusters');
  console.log('   - Connection prediction suggests viral potential');
  console.log('   - Path analysis shows information flow efficiency');
}

// Run the example
if (isMainModule()) {
  quantumSocialNetworkAnalysis().catch(console.error);
}

export { quantumSocialNetworkAnalysis };
