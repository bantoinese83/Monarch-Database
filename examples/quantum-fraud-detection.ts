/**
 * Quantum Fraud Detection Example
 *
 * This example demonstrates using Monarch's quantum algorithms for
 * advanced fraud detection in financial transactions and user behavior.
 *
 * Real-world applications:
 * - Credit card fraud detection
 * - Insurance claim fraud prevention
 * - Online banking security
 * - E-commerce transaction monitoring
 */

import { Monarch } from '../src/index';
import { isMainModule } from '../src/utils';

async function quantumFraudDetection() {
  console.log('🌀 QUANTUM FRAUD DETECTION SYSTEM');
  console.log('=================================\n');

  const db = new Monarch();

  // Initialize quantum engine
  console.log('Initializing quantum fraud detection engine...');
  await db.initializeQuantumEngine();

  // Create comprehensive transaction dataset
  console.log('Building transaction network...');
  const accounts = [
    { id: 'acc_001', owner: 'Alice Johnson', type: 'personal', balance: 5000, risk_score: 0.1 },
    { id: 'acc_002', owner: 'Bob Smith', type: 'business', balance: 25000, risk_score: 0.2 },
    { id: 'acc_003', owner: 'Charlie Brown', type: 'personal', balance: 1200, risk_score: 0.3 },
    { id: 'acc_004', owner: 'Diana Prince', type: 'business', balance: 50000, risk_score: 0.1 },
    { id: 'acc_005', owner: 'Eve Wilson', type: 'personal', balance: 800, risk_score: 0.4 },
    { id: 'acc_006', owner: 'Frank Miller', type: 'personal', balance: 3200, risk_score: 0.2 },
    { id: 'acc_007', owner: 'Grace Lee', type: 'business', balance: 15000, risk_score: 0.1 },
    { id: 'acc_008', owner: 'Henry Ford', type: 'suspicious', balance: 100, risk_score: 0.9 },
    { id: 'acc_009', owner: 'Ivy Chen', type: 'personal', balance: 6500, risk_score: 0.2 },
    { id: 'acc_010', owner: 'Jack Ryan', type: 'business', balance: 75000, risk_score: 0.1 }
  ];

  // Add accounts to database
  for (const account of accounts) {
    await db.addDocument('accounts', account);
  }

  // Create transaction network with legitimate and fraudulent patterns
  console.log('Creating transaction network...');
  const transactions = [
    // Legitimate personal transactions
    { from: 'acc_001', to: 'acc_003', amount: 50, type: 'transfer', location: 'local', time: '09:30', legitimate: true },
    { from: 'acc_001', to: 'acc_006', amount: 25, type: 'payment', location: 'local', time: '14:15', legitimate: true },
    { from: 'acc_003', to: 'acc_005', amount: 30, type: 'transfer', location: 'local', time: '16:45', legitimate: true },
    { from: 'acc_005', to: 'acc_001', amount: 15, type: 'payment', location: 'local', time: '11:20', legitimate: true },
    { from: 'acc_006', to: 'acc_009', amount: 40, type: 'transfer', location: 'local', time: '13:10', legitimate: true },

    // Legitimate business transactions
    { from: 'acc_002', to: 'acc_004', amount: 5000, type: 'b2b', location: 'domestic', time: '10:00', legitimate: true },
    { from: 'acc_004', to: 'acc_007', amount: 2500, type: 'b2b', location: 'domestic', time: '15:30', legitimate: true },
    { from: 'acc_007', to: 'acc_002', amount: 1800, type: 'b2b', location: 'domestic', time: '09:15', legitimate: true },
    { from: 'acc_010', to: 'acc_004', amount: 10000, type: 'b2b', location: 'domestic', time: '14:00', legitimate: true },

    // Suspicious patterns (potential fraud)
    { from: 'acc_008', to: 'acc_001', amount: 500, type: 'transfer', location: 'international', time: '02:30', legitimate: false },
    { from: 'acc_008', to: 'acc_003', amount: 300, type: 'transfer', location: 'international', time: '03:15', legitimate: false },
    { from: 'acc_008', to: 'acc_005', amount: 200, type: 'transfer', location: 'international', time: '04:00', legitimate: false },
    { from: 'acc_008', to: 'acc_006', amount: 150, type: 'transfer', location: 'international', time: '04:45', legitimate: false },

    // Money laundering pattern (layering)
    { from: 'acc_008', to: 'acc_002', amount: 1000, type: 'transfer', location: 'international', time: '01:00', legitimate: false },
    { from: 'acc_002', to: 'acc_008', amount: 800, type: 'transfer', location: 'international', time: '01:30', legitimate: false },
    { from: 'acc_008', to: 'acc_004', amount: 600, type: 'transfer', location: 'international', time: '02:00', legitimate: false },
    { from: 'acc_004', to: 'acc_008', amount: 400, type: 'transfer', location: 'international', time: '02:30', legitimate: false },

    // More legitimate transactions for network analysis
    { from: 'acc_009', to: 'acc_010', amount: 750, type: 'payment', location: 'domestic', time: '12:00', legitimate: true },
    { from: 'acc_010', to: 'acc_009', amount: 600, type: 'transfer', location: 'domestic', time: '16:00', legitimate: true },
    { from: 'acc_003', to: 'acc_007', amount: 100, type: 'payment', location: 'domestic', time: '10:30', legitimate: true }
  ];

  // Build quantum transaction graph
  for (const tx of transactions) {
    const fromNode = `account_${tx.from}`;
    const toNode = `account_${tx.to}`;

    // Add account nodes with metadata
    const fromAccount = accounts.find(a => a.id === tx.from);
    const toAccount = accounts.find(a => a.id === tx.to);

    await db.createGraphNode(fromNode, {
      accountId: tx.from,
      owner: fromAccount?.owner,
      type: fromAccount?.type,
      balance: fromAccount?.balance,
      riskScore: fromAccount?.risk_score
    });

    await db.createGraphNode(toNode, {
      accountId: tx.to,
      owner: toAccount?.owner,
      type: toAccount?.type,
      balance: toAccount?.balance,
      riskScore: toAccount?.risk_score
    });

    // Create transaction edges with fraud indicators
    await db.createGraphEdge(fromNode, toNode, {
      amount: tx.amount,
      type: tx.type,
      location: tx.location,
      time: tx.time,
      legitimate: tx.legitimate,
      // Fraud indicators
      highAmount: tx.amount > 1000,
      unusualTime: this.isUnusualTime(tx.time),
      international: tx.location === 'international',
      suspiciousAccount: fromAccount?.type === 'suspicious' || toAccount?.type === 'suspicious'
    });
  }

  console.log(`✅ Created transaction network with ${accounts.length} accounts and ${transactions.length} transactions\n`);

  // QUANTUM ANALYSIS 1: Account Centrality Analysis
  console.log('🎯 QUANTUM ANALYSIS 1: Account Centrality Analysis');
  console.log('--------------------------------------------------');

  const accountCentrality = await db.calculateQuantumCentrality();
  console.log('Most central accounts (potential fraud hubs):');

  const suspiciousAccounts = Object.entries(accountCentrality)
    .filter(([nodeId]) => nodeId.startsWith('account_'))
    .sort(([, a], [, b]) => b - a)
    .slice(0, 5);

  for (const [nodeId, centrality] of suspiciousAccounts) {
    const accountId = nodeId.replace('account_', '');
    const account = accounts.find(a => a.id === accountId);
    const transactionCount = transactions.filter(tx => tx.from === accountId || tx.to === accountId).length;

    console.log(`  ${account?.owner} (${accountId}):`);
    console.log(`    Centrality: ${centrality.toFixed(4)}`);
    console.log(`    Risk Score: ${account?.risk_score}`);
    console.log(`    Transaction Count: ${transactionCount}`);
    console.log(`    Balance: $${account?.balance}\n`);
  }

  // QUANTUM ANALYSIS 2: Fraud Ring Detection
  console.log('🎯 QUANTUM ANALYSIS 2: Fraud Ring Detection');
  console.log('------------------------------------------');

  const fraudCommunities = await db.detectCommunitiesQuantum();

  // Analyze communities for fraud patterns
  const communityAnalysis: Array<{
    communityId: number;
    accounts: string[];
    riskIndicators: string[];
    totalTransactions: number;
    suspiciousTransactions: number;
  }> = [];

  const communityGroups: { [communityId: number]: string[] } = {};
  for (const [nodeId, communityId] of Object.entries(fraudCommunities)) {
    if (nodeId.startsWith('account_')) {
      const accountId = nodeId.replace('account_', '');
      if (!communityGroups[communityId]) {
        communityGroups[communityId] = [];
      }
      communityGroups[communityId].push(accountId);
    }
  }

  for (const [communityId, accountIds] of Object.entries(communityGroups)) {
    const communityAccounts = accountIds.map(id => accounts.find(a => a.id === id)!);
    const communityTransactions = transactions.filter(tx =>
      accountIds.includes(tx.from) || accountIds.includes(tx.to)
    );

    const suspiciousTx = communityTransactions.filter(tx => !tx.legitimate);
    const riskIndicators: string[] = [];

    // Analyze community for fraud patterns
    if (suspiciousTx.length > communityTransactions.length * 0.5) {
      riskIndicators.push('High suspicious transaction ratio');
    }

    if (communityAccounts.some(acc => acc.type === 'suspicious')) {
      riskIndicators.push('Contains suspicious account types');
    }

    const avgRisk = communityAccounts.reduce((sum, acc) => sum + acc.risk_score, 0) / communityAccounts.length;
    if (avgRisk > 0.5) {
      riskIndicators.push('High average risk score');
    }

    if (communityTransactions.some(tx => tx.international)) {
      riskIndicators.push('International transactions');
    }

    communityAnalysis.push({
      communityId: parseInt(communityId),
      accounts: accountIds,
      riskIndicators,
      totalTransactions: communityTransactions.length,
      suspiciousTransactions: suspiciousTx.length
    });
  }

  // Sort by risk (most suspicious first)
  communityAnalysis.sort((a, b) => {
    const aRisk = a.riskIndicators.length + (a.suspiciousTransactions / Math.max(a.totalTransactions, 1));
    const bRisk = b.riskIndicators.length + (b.suspiciousTransactions / Math.max(b.totalTransactions, 1));
    return bRisk - aRisk;
  });

  console.log('Fraud risk analysis by community:');
  for (const analysis of communityAnalysis.slice(0, 3)) {
    const accountNames = analysis.accounts.map(id => accounts.find(a => a.id === id)?.owner).join(', ');
    console.log(`  Community ${analysis.communityId}: ${accountNames}`);
    console.log(`    Risk indicators: ${analysis.riskIndicators.join(', ') || 'None'}`);
    console.log(`    Transactions: ${analysis.totalTransactions} (${analysis.suspiciousTransactions} suspicious)\n`);
  }

  // QUANTUM ANALYSIS 3: Transaction Path Analysis
  console.log('🎯 QUANTUM ANALYSIS 3: Transaction Path Analysis');
  console.log('-----------------------------------------------');

  // Analyze suspicious transaction paths
  const suspiciousAccount = 'acc_008';
  const targetAccounts = ['acc_001', 'acc_003', 'acc_005'];

  console.log(`Analyzing transaction paths from suspicious account ${suspiciousAccount}:`);
  for (const targetAccount of targetAccounts) {
    try {
      const pathResult = await db.findShortestPathQuantum(
        `account_${suspiciousAccount}`,
        `account_${targetAccount}`
      );

      const pathAccounts = pathResult.path.map(nodeId => nodeId.replace('account_', ''));
      const pathNames = pathAccounts.map(id => accounts.find(a => a.id === id)?.owner);

      console.log(`  Path to ${accounts.find(a => a.id === targetAccount)?.owner}:`);
      console.log(`    Route: ${pathNames.join(' → ')}`);
      console.log(`    Length: ${pathResult.distance} hops`);
      console.log(`    Transactions involved: ${pathResult.path.length - 1}\n`);
    } catch (error) {
      console.log(`  No path found to ${accounts.find(a => a.id === targetAccount)?.owner}\n`);
    }
  }

  // QUANTUM ANALYSIS 4: Fraud Pattern Recognition
  console.log('🎯 QUANTUM ANALYSIS 4: Fraud Pattern Recognition');
  console.log('-----------------------------------------------');

  // Analyze transaction patterns for anomalies
  const fraudPatterns = this.analyzeFraudPatterns(transactions, accounts);

  console.log('Detected fraud patterns:');
  for (const pattern of fraudPatterns.slice(0, 5)) {
    console.log(`  ${pattern.description}`);
    console.log(`    Severity: ${pattern.severity}/10`);
    console.log(`    Involved accounts: ${pattern.accounts.join(', ')}\n`);
  }

  // QUANTUM ANALYSIS 5: Risk Scoring Enhancement
  console.log('🎯 QUANTUM ANALYSIS 5: Enhanced Risk Scoring');
  console.log('--------------------------------------------');

  // Use quantum centrality to enhance risk scores
  console.log('Enhanced risk scores (combining quantum centrality with traditional metrics):');

  for (const account of accounts.slice(0, 5)) {
    const nodeId = `account_${account.id}`;
    const centrality = accountCentrality[nodeId] || 0;

    // Enhanced risk score combines traditional risk with quantum centrality
    const enhancedRisk = (account.risk_score * 0.6) + (centrality * 0.4);

    const riskLevel = enhancedRisk > 0.7 ? 'HIGH' : enhancedRisk > 0.4 ? 'MEDIUM' : 'LOW';

    console.log(`  ${account.owner}: ${enhancedRisk.toFixed(3)} (${riskLevel})`);
    console.log(`    Traditional risk: ${account.risk_score}`);
    console.log(`    Quantum centrality: ${centrality.toFixed(4)}\n`);
  }

  // PERFORMANCE ANALYSIS
  console.log('📊 FRAUD DETECTION PERFORMANCE');
  console.log('==============================');

  const quantumStats = await db.getQuantumStats();
  const totalFraudulentTx = transactions.filter(tx => !tx.legitimate).length;
  const detectedFraudCommunities = communityAnalysis.filter(c => c.riskIndicators.length > 0).length;

  console.log('Fraud detection results:');
  console.log(`  Total transactions analyzed: ${transactions.length}`);
  console.log(`  Actual fraudulent transactions: ${totalFraudulentTx}`);
  console.log(`  Fraud communities detected: ${detectedFraudCommunities}`);
  console.log(`  Quantum centrality calculations: ${quantumStats.totalCentralityCalculations || 0}`);
  console.log(`  Average quantum advantage: ${quantumStats.averageAdvantage?.toFixed(2)}x`);

  console.log('\n✅ Quantum fraud detection analysis completed!');
  console.log('💡 Security Insights:');
  console.log('   - Quantum centrality identifies fraud network hubs');
  console.log('   - Community detection reveals organized fraud rings');
  console.log('   - Path analysis traces money laundering routes');
  console.log('   - Enhanced risk scoring improves fraud prevention');
}

// Helper functions
function isUnusualTime(time: string): boolean {
  const hour = parseInt(time.split(':')[0]);
  return hour < 6 || hour > 22; // Outside 6 AM - 10 PM
}

function analyzeFraudPatterns(transactions: any[], accounts: any[]): Array<{
  description: string;
  severity: number;
  accounts: string[];
}> {
  const patterns: Array<{
    description: string;
    severity: number;
    accounts: string[];
  }> = [];

  // Pattern 1: Rapid succession transactions from same account
  const suspiciousAccount = 'acc_008';
  const suspiciousTx = transactions.filter(tx => tx.from === suspiciousAccount && !tx.legitimate);
  if (suspiciousTx.length >= 3) {
    patterns.push({
      description: 'Multiple rapid transactions from high-risk account',
      severity: 9,
      accounts: [suspiciousAccount]
    });
  }

  // Pattern 2: Money laundering cycle
  const launderingTx = transactions.filter(tx =>
    (tx.from === 'acc_008' && tx.to === 'acc_002') ||
    (tx.from === 'acc_002' && tx.to === 'acc_008') ||
    (tx.from === 'acc_008' && tx.to === 'acc_004') ||
    (tx.from === 'acc_004' && tx.to === 'acc_008')
  );
  if (launderingTx.length >= 4) {
    patterns.push({
      description: 'Circular money movement pattern (potential layering)',
      severity: 8,
      accounts: ['acc_008', 'acc_002', 'acc_004']
    });
  }

  // Pattern 3: Unusual timing patterns
  const nightTx = transactions.filter(tx => this.isUnusualTime(tx.time) && !tx.legitimate);
  if (nightTx.length >= 2) {
    patterns.push({
      description: 'Transactions at unusual hours',
      severity: 7,
      accounts: [...new Set(nightTx.map(tx => tx.from))]
    });
  }

  // Pattern 4: High-value transfers to suspicious accounts
  const highValueTx = transactions.filter(tx => tx.amount > 500 && tx.to === suspiciousAccount);
  if (highValueTx.length >= 1) {
    patterns.push({
      description: 'High-value transfers to suspicious account',
      severity: 8,
      accounts: [suspiciousAccount, ...highValueTx.map(tx => tx.from)]
    });
  }

  return patterns;
}

// Run the example
if (isMainModule()) {
  quantumFraudDetection().catch(console.error);
}

export { quantumFraudDetection };
