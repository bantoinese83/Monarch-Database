import { ClusteringManager, ClusterConfig, ClusterNode, Shard } from './types';
import { logger } from './logger';
import { ValidationError } from './errors';
import { ERROR_MESSAGES } from './constants';

export class ClusteringManagerImpl implements ClusteringManager {
  private config?: ClusterConfig;
  private nodeId: string;
  private isCoordinator = false;
  private heartbeatTimer?: NodeJS.Timeout;
  private failoverTimer?: NodeJS.Timeout;

  constructor(nodeId: string = `node_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`) {
    this.nodeId = nodeId;
  }

  private validateClusterConfig(config: ClusterConfig | null | undefined): void {
    if (!config || typeof config !== 'object') {
      throw new ValidationError('Invalid cluster configuration: must be an object', 'clusterConfig', config);
    }

    if (!Array.isArray(config.nodes)) {
      throw new ValidationError('Invalid cluster configuration: nodes must be an array', 'clusterConfig', config);
    }

    if (!Array.isArray(config.shards)) {
      throw new ValidationError('Invalid cluster configuration: shards must be an array', 'clusterConfig', config);
    }

    const validStrategies = ['master-slave', 'replica-set', 'sharded'];
    if (config.replicationStrategy && !validStrategies.includes(config.replicationStrategy)) {
      throw new ValidationError(
        `Invalid replication strategy: ${config.replicationStrategy}. Must be one of: ${validStrategies.join(', ')}`,
        'replicationStrategy',
        config.replicationStrategy
      );
    }
  }

  async joinCluster(config: ClusterConfig): Promise<void> {
    // Validate cluster configuration
    this.validateClusterConfig(config);
    
    this.config = config;

    // Determine if this node is the coordinator
    this.isCoordinator = config.nodes.some(node => node.id === this.nodeId && node.role === 'coordinator');

    // Start heartbeat monitoring
    this.startHeartbeat();

    // Start failover monitoring if coordinator
    if (this.isCoordinator) {
      this.startFailoverMonitoring();
    }

    logger.info('Node joined cluster', {
      nodeId: this.nodeId,
      role: this.isCoordinator ? 'coordinator' : 'worker',
      nodeCount: config.nodes.length,
      shardCount: config.shards.length
    });
  }

  async leaveCluster(): Promise<void> {
    if (this.heartbeatTimer) clearInterval(this.heartbeatTimer);
    if (this.failoverTimer) clearInterval(this.failoverTimer);

    if (this.config && this.isCoordinator) {
      // Elect new coordinator if leaving
      await this.electNewCoordinator();
    }

    this.config = undefined;
    logger.info('Node left cluster', { nodeId: this.nodeId });
  }

  getNodeStatus(): ClusterNode {
    if (!this.config) {
      return {
        id: this.nodeId,
        host: 'localhost',
        port: 6379,
        status: 'offline',
        role: 'master',
        lastHeartbeat: Date.now(),
        metadata: {}
      };
    }

    const node = this.config.nodes.find(n => n.id === this.nodeId);
    if (node) {
      return {
        ...node,
        lastHeartbeat: Date.now(),
        status: this.checkNodeHealth(node) ? 'online' : 'failed'
      };
    }

    // Return default status if node not found in config
    return {
      id: this.nodeId,
      host: 'localhost',
      port: 6379,
      status: 'online',
      role: 'master',
      lastHeartbeat: Date.now(),
      metadata: { autoRegistered: true }
    };
  }

  async redistributeData(): Promise<void> {
    if (!this.config || !this.isCoordinator) {
      throw new Error('Only coordinator can redistribute data');
    }

    logger.info('Starting data redistribution');

    // Analyze current shard distribution
    const shardStats = this.analyzeShardDistribution();

    // Identify imbalanced shards
    const imbalancedShards = this.findImbalancedShards(shardStats);

    if (imbalancedShards.length === 0) {
      logger.info('Shards are already balanced');
      return;
    }

    // Redistribute data
    for (const shard of imbalancedShards) {
      await this.rebalanceShard(shard, shardStats);
    }

    logger.info('Data redistribution completed');
  }

  async handleFailover(failedNodeId: string): Promise<void> {
    if (!this.config || !this.isCoordinator) {
      throw new Error('Only coordinator can handle failover');
    }

    logger.warn('Handling failover for node', { failedNodeId });

    const failedNode = this.config.nodes.find(n => n.id === failedNodeId);
    if (!failedNode) {
      logger.warn('Node not found in cluster configuration', { failedNodeId });
      return;
    }

    // Mark node as failed
    failedNode.status = 'failed';

    // Find affected shards
    const affectedShards = this.config.shards.filter(shard =>
      shard.primaryNode === failedNodeId || shard.replicaNodes.includes(failedNodeId)
    );

    // Handle failover for each affected shard
    for (const shard of affectedShards) {
      await this.failoverShard(shard, failedNodeId);
    }

    logger.info('Failover completed', { affectedShards: affectedShards.length });
  }

  async getClusterStats(): Promise<{ nodes: number; shards: number; health: number }> {
    if (!this.config) {
      return { nodes: 1, shards: 0, health: 100 };
    }

    const onlineNodes = (this.config.nodes || []).filter(node =>
      this.checkNodeHealth(node)
    ).length;

    // Count active shards for stats (unused for now but may be needed in future)
    // eslint-disable-next-line @typescript-eslint/no-unused-vars, no-unused-vars
    const _activeShards = (this.config.shards || []).filter(shard =>
      shard.status === 'active'
    ).length;

    const totalNodes = this.config.nodes?.length || 1;
    const health = Math.round((onlineNodes / totalNodes) * 100);

    return {
      nodes: totalNodes,
      shards: this.config.shards?.length || 0,
      health
    };
  }

  // Private helper methods

  private startHeartbeat(): void {
    if (!this.config) return;

    this.heartbeatTimer = setInterval(() => {
      this.sendHeartbeat();
    }, this.config.heartbeatInterval);
  }

  private startFailoverMonitoring(): void {
    if (!this.config) return;

    this.failoverTimer = setInterval(() => {
      this.checkForFailedNodes();
    }, this.config.failoverTimeout / 4); // Check more frequently than timeout
  }

  private sendHeartbeat(): void {
    if (!this.config) return;

    // In a real implementation, this would send heartbeats to other nodes
    // For demo purposes, we'll simulate heartbeat logic

    for (const node of this.config.nodes) {
      if (node.id !== this.nodeId) {
        // Simulate network heartbeat
        node.lastHeartbeat = Date.now();
      }
    }
  }

  private checkForFailedNodes(): void {
    if (!this.config) return;

    const now = Date.now();
    const failedNodes = this.config.nodes.filter(node =>
      now - node.lastHeartbeat > this.config!.failoverTimeout
    );

    for (const failedNode of failedNodes) {
      if (failedNode.status !== 'failed') {
        logger.warn('Node detected as failed', { nodeId: failedNode.id });
        this.handleFailover(failedNode.id);
      }
    }
  }

  private checkNodeHealth(node: ClusterNode): boolean {
    if (node.status === 'failed' || node.status === 'maintenance') {
      return false;
    }

    // Check heartbeat freshness
    const now = Date.now();
    return (now - node.lastHeartbeat) < (this.config?.failoverTimeout || 30000);
  }

  private async electNewCoordinator(): Promise<void> {
    if (!this.config) return;

    // Simple election algorithm: choose node with lowest ID
    const aliveNodes = this.config.nodes.filter(node =>
      node.status === 'online' && node.id !== this.nodeId
    );

    if (aliveNodes.length === 0) return;

    aliveNodes.sort((a, b) => a.id.localeCompare(b.id));
    const newCoordinator = aliveNodes[0];

    newCoordinator.role = 'coordinator';
    logger.info('Elected new coordinator', { coordinatorId: newCoordinator.id });
  }

  private analyzeShardDistribution(): Map<string, { collections: number; dataSize: number }> {
    const stats = new Map<string, { collections: number; dataSize: number }>();

    if (!this.config) return stats;

    for (const shard of this.config.shards) {
      const primaryNode = this.config.nodes.find(n => n.id === shard.primaryNode);
      if (!primaryNode || primaryNode.status !== 'online') continue;

      const existing = stats.get(shard.primaryNode) || { collections: 0, dataSize: 0 };
      stats.set(shard.primaryNode, {
        collections: existing.collections + shard.collections.length,
        dataSize: existing.dataSize + this.estimateShardSize(shard)
      });
    }

    return stats;
  }

  private estimateShardSize(shard: Shard): number {
    // Simple estimation based on collection count
    // In real implementation, this would track actual data sizes
    return shard.collections.length * 1024 * 1024; // 1MB per collection
  }

  private findImbalancedShards(shardStats: Map<string, { collections: number; dataSize: number }>): Shard[] {
    if (!this.config) return [];

    const avgCollections = Array.from(shardStats.values())
      .reduce((sum, stat) => sum + stat.collections, 0) / shardStats.size;

    const imbalancedShards: Shard[] = [];

    for (const shard of this.config.shards) {
      const stats = shardStats.get(shard.primaryNode);
      if (stats && Math.abs(stats.collections - avgCollections) > avgCollections * 0.2) {
        imbalancedShards.push(shard);
      }
    }

    return imbalancedShards;
  }

  private async rebalanceShard(shard: Shard, shardStats: Map<string, { collections: number; dataSize: number }>): Promise<void> {
    if (!this.config) return;

    // Find least loaded node
    let targetNode: string | undefined;
    let minLoad = Infinity;

    for (const [nodeId, stats] of shardStats) {
      if (stats.collections < minLoad) {
        minLoad = stats.collections;
        targetNode = nodeId;
      }
    }

    if (!targetNode || targetNode === shard.primaryNode) return;

    logger.info('Migrating shard', { shardId: shard.id, from: shard.primaryNode, to: targetNode });

    // Update shard configuration
    shard.primaryNode = targetNode;
    shard.status = 'migrating';

    // Simulate migration time
    await new Promise(resolve => setTimeout(resolve, 1000));

    shard.status = 'active';
    logger.info('Shard migration completed', { shardId: shard.id });
  }

  private async failoverShard(shard: Shard, failedNodeId: string): Promise<void> {
    if (!this.config) return;

    if (shard.primaryNode === failedNodeId) {
      // Primary node failed - promote a replica
      if (shard.replicaNodes.length > 0) {
        const newPrimary = shard.replicaNodes[0];
        shard.primaryNode = newPrimary;
        shard.replicaNodes = shard.replicaNodes.slice(1);

        // Find a new replica
        const availableNodes = this.config.nodes.filter(node =>
          node.status === 'online' &&
          node.id !== newPrimary &&
          !shard.replicaNodes.includes(node.id)
        );

        if (availableNodes.length > 0) {
          shard.replicaNodes.push(availableNodes[0].id);
        }

        logger.info('Promoted node to primary', { nodeId: newPrimary, shardId: shard.id });
      } else {
        // No replicas available - mark shard as failed
        shard.status = 'failed';
        logger.error('No replicas available for shard', { shardId: shard.id });
      }
    } else {
      // Replica node failed - remove from replica list
      shard.replicaNodes = shard.replicaNodes.filter(id => id !== failedNodeId);

      // Try to add a new replica
      const availableNodes = this.config.nodes.filter(node =>
        node.status === 'online' &&
        node.id !== shard.primaryNode &&
        !shard.replicaNodes.includes(node.id)
      );

      if (availableNodes.length > 0) {
        shard.replicaNodes.push(availableNodes[0].id);
        logger.info('Added new replica to shard', { nodeId: availableNodes[0].id, shardId: shard.id });
      }
    }
  }

  // Utility methods for testing and monitoring

  getClusterConfig(): ClusterConfig | undefined {
    return this.config;
  }

  simulateNodeFailure(nodeId: string): void {
    if (!this.config) return;

    const node = this.config.nodes.find(n => n.id === nodeId);
    if (node) {
      node.status = 'failed';
      node.lastHeartbeat = 0;
      logger.info('Simulated failure of node', { nodeId });
    }
  }

  simulateNetworkPartition(nodeIds: string[]): void {
    if (!this.config) return;

    for (const nodeId of nodeIds) {
      const node = this.config.nodes.find(n => n.id === nodeId);
      if (node) {
        node.lastHeartbeat = Date.now() - (this.config.failoverTimeout + 1000);
        logger.info('Simulated network partition for node', { nodeId });
      }
    }
  }
}
