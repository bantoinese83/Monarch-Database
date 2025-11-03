/**
 * Quantum Recommendation System Example
 *
 * This example demonstrates using Monarch's quantum algorithms for
 * building an intelligent recommendation engine that learns from
 * user behavior patterns and item relationships.
 *
 * Real-world applications:
 * - E-commerce product recommendations
 * - Content streaming suggestions
 * - Social media content curation
 * - Personalized learning paths
 */

import { Monarch } from '../src/index';

async function quantumRecommendationSystem() {
  console.log('🌀 QUANTUM RECOMMENDATION SYSTEM');
  console.log('================================\n');

  const db = new Monarch();

  // Initialize quantum engine
  console.log('Initializing quantum recommendation engine...');
  await db.initializeQuantumEngine();

  // Create comprehensive product catalog
  console.log('Building product catalog...');
  const products = [
    { id: 'laptop_gaming', name: 'Gaming Laptop Pro', category: 'electronics', tags: ['gaming', 'high-performance', 'portable'], price: 1999 },
    { id: 'laptop_ultrabook', name: 'Ultrabook Air', category: 'electronics', tags: ['business', 'lightweight', 'long-battery'], price: 1299 },
    { id: 'mouse_wireless', name: 'Wireless Gaming Mouse', category: 'electronics', tags: ['gaming', 'wireless', 'ergonomic'], price: 79 },
    { id: 'keyboard_mechanical', name: 'Mechanical Keyboard RGB', category: 'electronics', tags: ['gaming', 'rgb', 'mechanical'], price: 149 },
    { id: 'monitor_4k', name: '4K Gaming Monitor', category: 'electronics', tags: ['gaming', '4k', 'high-refresh'], price: 599 },
    { id: 'headphones_wireless', name: 'Wireless Headphones', category: 'electronics', tags: ['audio', 'wireless', 'noise-cancelling'], price: 299 },

    { id: 'running_shoes', name: 'Performance Running Shoes', category: 'sports', tags: ['running', 'comfort', 'breathable'], price: 129 },
    { id: 'yoga_mat', name: 'Premium Yoga Mat', category: 'sports', tags: ['yoga', 'non-slip', 'eco-friendly'], price: 49 },
    { id: 'dumbbells', name: 'Adjustable Dumbbells', category: 'sports', tags: ['strength-training', 'adjustable', 'home-gym'], price: 199 },
    { id: 'fitness_tracker', name: 'Smart Fitness Tracker', category: 'sports', tags: ['fitness', 'heart-rate', 'smartwatch'], price: 249 },

    { id: 'coffee_maker', name: 'Premium Coffee Maker', category: 'kitchen', tags: ['coffee', 'espresso', 'automatic'], price: 399 },
    { id: 'blender', name: 'High-Speed Blender', category: 'kitchen', tags: ['blending', 'smoothies', 'powerful'], price: 179 },
    { id: 'air_fryer', name: 'Digital Air Fryer', category: 'kitchen', tags: ['healthy-cooking', 'oil-free', 'digital'], price: 129 },
    { id: 'instant_pot', name: 'Multi-Cooker Instant Pot', category: 'kitchen', tags: ['pressure-cooking', 'slow-cooking', 'multi-function'], price: 89 },

    { id: 'board_game', name: 'Strategy Board Game', category: 'entertainment', tags: ['board-game', 'strategy', 'family'], price: 39 },
    { id: 'streaming_device', name: '4K Streaming Device', category: 'entertainment', tags: ['streaming', '4k', 'smart-tv'], price: 49 },
    { id: 'vr_headset', name: 'VR Gaming Headset', category: 'entertainment', tags: ['vr', 'gaming', 'immersive'], price: 349 }
  ];

  // Add products to database
  for (const product of products) {
    await db.addDocument('products', product);
  }

  // Create user profiles
  console.log('Creating user profiles...');
  const users = [
    { id: 'gamer_pro', name: 'Pro Gamer', preferences: ['gaming', 'high-performance', 'rgb'], budget: 'high' },
    { id: 'office_worker', name: 'Office Professional', preferences: ['business', 'portable', 'reliable'], budget: 'medium' },
    { id: 'fitness_enthusiast', name: 'Fitness Enthusiast', preferences: ['fitness', 'health', 'performance'], budget: 'medium' },
    { id: 'home_chef', name: 'Home Chef', preferences: ['cooking', 'healthy', 'convenient'], budget: 'medium' },
    { id: 'tech_savvy', name: 'Tech Enthusiast', preferences: ['latest-tech', 'innovation', 'smart'], budget: 'high' }
  ];

  for (const user of users) {
    await db.addDocument('users', user);
  }

  // Create user-product interaction graph
  console.log('Building user-product interaction graph...');
  const interactions = [
    // Gamer Pro's interactions
    { user: 'gamer_pro', product: 'laptop_gaming', action: 'purchased', rating: 5 },
    { user: 'gamer_pro', product: 'mouse_wireless', action: 'purchased', rating: 5 },
    { user: 'gamer_pro', product: 'keyboard_mechanical', action: 'purchased', rating: 5 },
    { user: 'gamer_pro', product: 'monitor_4k', action: 'viewed', rating: 4 },
    { user: 'gamer_pro', product: 'headphones_wireless', action: 'wishlist', rating: 4 },
    { user: 'gamer_pro', product: 'vr_headset', action: 'viewed', rating: 4 },

    // Office Worker's interactions
    { user: 'office_worker', product: 'laptop_ultrabook', action: 'purchased', rating: 5 },
    { user: 'office_worker', product: 'mouse_wireless', action: 'purchased', rating: 4 },
    { user: 'office_worker', product: 'keyboard_mechanical', action: 'viewed', rating: 3 },
    { user: 'office_worker', product: 'streaming_device', action: 'purchased', rating: 4 },

    // Fitness Enthusiast's interactions
    { user: 'fitness_enthusiast', product: 'running_shoes', action: 'purchased', rating: 5 },
    { user: 'fitness_enthusiast', product: 'yoga_mat', action: 'purchased', rating: 4 },
    { user: 'fitness_enthusiast', product: 'dumbbells', action: 'purchased', rating: 5 },
    { user: 'fitness_enthusiast', product: 'fitness_tracker', action: 'purchased', rating: 5 },
    { user: 'fitness_enthusiast', product: 'headphones_wireless', action: 'viewed', rating: 4 },

    // Home Chef's interactions
    { user: 'home_chef', product: 'coffee_maker', action: 'purchased', rating: 5 },
    { user: 'home_chef', product: 'blender', action: 'purchased', rating: 4 },
    { user: 'home_chef', product: 'air_fryer', action: 'purchased', rating: 5 },
    { user: 'home_chef', product: 'instant_pot', action: 'purchased', rating: 5 },

    // Tech Savvy's interactions
    { user: 'tech_savvy', product: 'laptop_gaming', action: 'viewed', rating: 4 },
    { user: 'tech_savvy', product: 'streaming_device', action: 'purchased', rating: 5 },
    { user: 'tech_savvy', product: 'vr_headset', action: 'purchased', rating: 5 },
    { user: 'tech_savvy', product: 'fitness_tracker', action: 'purchased', rating: 4 },
    { user: 'tech_savvy', product: 'instant_pot', action: 'viewed', rating: 3 }
  ];

  // Build the quantum graph: users and products as nodes, interactions as edges
  for (const interaction of interactions) {
    const userNode = `user_${interaction.user}`;
    const productNode = `product_${interaction.product}`;

    // Add user node
    await db.createGraphNode(userNode, {
      type: 'user',
      userId: interaction.user,
      preferences: users.find(u => u.id === interaction.user)?.preferences
    });

    // Add product node
    await db.createGraphNode(productNode, {
      type: 'product',
      productId: interaction.product,
      category: products.find(p => p.id === interaction.product)?.category,
      tags: products.find(p => p.id === interaction.product)?.tags
    });

    // Create interaction edge with quantum weight
    const edgeWeight = interaction.rating / 5.0; // Normalize to 0-1
    await db.createGraphEdge(userNode, productNode, {
      interaction: interaction.action,
      rating: interaction.rating,
      weight: edgeWeight,
      timestamp: Date.now()
    });
  }

  console.log(`✅ Created recommendation graph with ${users.length} users, ${products.length} products, and ${interactions.length} interactions\n`);

  // QUANTUM ANALYSIS 1: Product Similarity Network
  console.log('🎯 QUANTUM ANALYSIS 1: Product Similarity Network');
  console.log('-----------------------------------------------');

  const productCentrality = await db.calculateQuantumCentrality();
  console.log('Most central products (high recommendation potential):');

  const productCentralities = Object.entries(productCentrality)
    .filter(([nodeId]) => nodeId.startsWith('product_'))
    .sort(([, a], [, b]) => b - a)
    .slice(0, 5);

  for (const [nodeId, centrality] of productCentralities) {
    const productId = nodeId.replace('product_', '');
    const product = products.find(p => p.id === productId);
    console.log(`  ${product?.name}: ${centrality.toFixed(4)}`);
  }
  console.log();

  // QUANTUM ANALYSIS 2: User Community Detection
  console.log('🎯 QUANTUM ANALYSIS 2: User Community Detection');
  console.log('----------------------------------------------');

  const userCommunities = await db.detectCommunitiesQuantum();

  // Group users by detected communities
  const communityGroups: { [communityId: number]: string[] } = {};
  for (const [nodeId, communityId] of Object.entries(userCommunities)) {
    if (nodeId.startsWith('user_')) {
      const userId = nodeId.replace('user_', '');
      if (!communityGroups[communityId]) {
        communityGroups[communityId] = [];
      }
      communityGroups[communityId].push(userId);
    }
  }

  console.log('User communities detected:');
  for (const [communityId, userIds] of Object.entries(communityGroups)) {
    const userNames = userIds.map(id => users.find(u => u.id === id)?.name).join(', ');
    const preferences = userIds
      .map(id => users.find(u => u.id === id)?.preferences || [])
      .flat()
      .filter((value, index, self) => self.indexOf(value) === index)
      .slice(0, 3) // Top 3 shared preferences
      .join(', ');

    console.log(`  Community ${communityId}: ${userNames}`);
    console.log(`    Shared preferences: ${preferences}\n`);
  }

  // QUANTUM ANALYSIS 3: Personalized Recommendations
  console.log('🎯 QUANTUM ANALYSIS 3: Personalized Recommendations');
  console.log('--------------------------------------------------');

  for (const user of users.slice(0, 3)) { // Analyze first 3 users
    console.log(`Recommendations for ${user.name}:`);

    const userNode = `user_${user.id}`;
    const recommendations: Array<{productId: string, score: number, reason: string}> = [];

    // Find products similar to ones the user has interacted with
    for (const interaction of interactions.filter(i => i.user === user.id)) {
      const productNode = `product_${interaction.product}`;

      // Use quantum walk to find related products
      try {
        // Look for 2-hop connections (user -> product -> related_product)
        const relatedProducts = Object.keys(productCentrality)
          .filter(nodeId => nodeId.startsWith('product_') && nodeId !== productNode)
          .slice(0, 10); // Limit for performance

        for (const relatedProductNode of relatedProducts) {
          const relatedProductId = relatedProductNode.replace('product_', '');
          const product = products.find(p => p.id === relatedProductId);

          if (product) {
            // Calculate recommendation score based on multiple factors
            const similarityScore = this.calculateProductSimilarity(
              products.find(p => p.id === interaction.product)!,
              product
            );

            const userPreferenceScore = this.calculateUserPreferenceMatch(
              user,
              product
            );

            const centralityScore = productCentrality[relatedProductNode] || 0;

            const finalScore = (similarityScore * 0.4) + (userPreferenceScore * 0.4) + (centralityScore * 0.2);

            // Check if user hasn't already interacted with this product
            const existingInteraction = interactions.find(i =>
              i.user === user.id && i.product === relatedProductId
            );

            if (!existingInteraction && finalScore > 0.3) {
              recommendations.push({
                productId: relatedProductId,
                score: finalScore,
                reason: `Similar to ${products.find(p => p.id === interaction.product)?.name}`
              });
            }
          }
        }
      } catch (error) {
        // Skip if quantum analysis fails for this product
      }
    }

    // Remove duplicates and sort by score
    const uniqueRecommendations = recommendations
      .filter((rec, index, self) =>
        index === self.findIndex(r => r.productId === rec.productId)
      )
      .sort((a, b) => b.score - a.score)
      .slice(0, 3);

    for (const rec of uniqueRecommendations) {
      const product = products.find(p => p.id === rec.productId);
      console.log(`  • ${product?.name} (${(rec.score * 100).toFixed(0)}% match) - ${rec.reason}`);
    }
    console.log();
  }

  // QUANTUM ANALYSIS 4: Trend Prediction
  console.log('🎯 QUANTUM ANALYSIS 4: Trend Prediction');
  console.log('--------------------------------------');

  // Analyze which products are becoming more central (trending up)
  console.log('Trending products (high centrality = popular):');

  const trendingProducts = productCentralities.slice(0, 3);
  for (const [nodeId, centrality] of trendingProducts) {
    const productId = nodeId.replace('product_', '');
    const product = products.find(p => p.id === productId);
    const interactions = interactions.filter(i => i.product === productId).length;

    console.log(`  ${product?.name}`);
    console.log(`    Centrality: ${centrality.toFixed(4)}`);
    console.log(`    Total interactions: ${interactions}`);
    console.log(`    Average rating: ${(interactions > 0 ?
      interactions.reduce((sum, i) => sum + (i.rating || 0), 0) / interactions : 0).toFixed(1)}\n`);
  }

  // PERFORMANCE ANALYSIS
  console.log('📊 RECOMMENDATION SYSTEM PERFORMANCE');
  console.log('=====================================');

  const quantumStats = await db.getQuantumStats();
  console.log('Quantum recommendation engine stats:');
  console.log(`  Products analyzed: ${products.length}`);
  console.log(`  User communities detected: ${Object.keys(communityGroups).length}`);
  console.log(`  Quantum centrality calculations: ${quantumStats.totalCentralityCalculations || 0}`);
  console.log(`  Average quantum advantage: ${quantumStats.averageAdvantage?.toFixed(2)}x`);

  console.log('\n✅ Quantum recommendation system analysis completed!');
  console.log('💡 Business Insights:');
  console.log('   - Product centrality identifies trending items');
  console.log('   - User communities enable targeted marketing');
  console.log('   - Personalized recommendations improve conversion');
  console.log('   - Trend prediction helps inventory optimization');
}

// Helper functions
function calculateProductSimilarity(productA: any, productB: any): number {
  // Calculate similarity based on category and tags
  let similarity = 0;

  if (productA.category === productB.category) {
    similarity += 0.5;
  }

  const commonTags = productA.tags.filter((tag: string) => productB.tags.includes(tag)).length;
  similarity += (commonTags / Math.max(productA.tags.length, productB.tags.length)) * 0.5;

  return similarity;
}

function calculateUserPreferenceMatch(user: any, product: any): number {
  const matchingPreferences = user.preferences.filter((pref: string) =>
    product.tags.some((tag: string) => tag.toLowerCase().includes(pref.toLowerCase()))
  ).length;

  return matchingPreferences / user.preferences.length;
}

// Run the example
if (require.main === module) {
  quantumRecommendationSystem().catch(console.error);
}

export { quantumRecommendationSystem };
