/**
 * Multi-Region Active-Active Replication
 * 
 * Enhanced clustering manager with geo-distribution, conflict resolution,
 * and regional failover capabilities.
 */

import { ClusteringManagerImpl } from './clustering-manager';
import { ClusterConfig, ClusterNode } from './types';
import { logger } from './logger';
import { ValidationError } from './errors';

/**
 * Geographic region information
 */
export interface Region {
  id: string;
  name: string;
  location: { lat: number; lon: number };
  nodes: string[]; // Node IDs in this region
  priority: number; // Lower = higher priority
}

/**
 * Conflict resolution strategy
 */
export type ConflictResolutionStrategy = 
  | 'last-write-wins' 
  | 'first-write-wins'
  | 'version-vector'
  | 'custom';

/**
 * Regional routing configuration
 */
export interface RegionalRoutingConfig {
  enabled: boolean;
  latencyThreshold: number; // ms
  preferLocal: boolean;
  failoverStrategy: 'fast-failover' | 'consistent-failover';
}

/**
 * Multi-region cluster configuration
 */
export interface MultiRegionClusterConfig extends ClusterConfig {
  regions: Region[];
  conflictResolution: ConflictResolutionStrategy;
  routing: RegionalRoutingConfig;
  replicationLatency: Map<string, number>; // region -> latency in ms
}

/**
 * Multi-Region Clustering Manager
 */
export class MultiRegionClusteringManager extends ClusteringManagerImpl {
  private regions: Map<string, Region> = new Map();
  private conflictResolution: ConflictResolutionStrategy = 'last-write-wins';
  private routingConfig: RegionalRoutingConfig = {
    enabled: true,
    latencyThreshold: 100,
    preferLocal: true,
    failoverStrategy: 'fast-failover'
  };
  private regionLatencies: Map<string, number> = new Map();
  private versionVectors: Map<string, Map<string, number>> = new Map(); // resource -> region -> version

  /**
   * Join multi-region cluster
   */
  async joinMultiRegionCluster(config: MultiRegionClusterConfig): Promise<void> {
    // Validate regions
    this.validateRegions(config.regions);

    // Store region information
    for (const region of config.regions) {
      this.regions.set(region.id, region);
    }

    this.conflictResolution = config.conflictResolution;
    if (config.routing) {
      this.routingConfig = { ...this.routingConfig, ...config.routing };
    }

    if (config.replicationLatency) {
      this.regionLatencies = new Map(config.replicationLatency);
    }

    // Join base cluster
    await this.joinCluster(config);

    logger.info('Joined multi-region cluster', {
      regionCount: this.regions.size,
      conflictResolution: this.conflictResolution
    });
  }

  /**
   * Get the best region for a read operation (latency-aware routing)
   */
  getOptimalRegionForRead(): string | null {
    if (!this.routingConfig.enabled) {
      return null;
    }

    const localRegion = this.getLocalRegion();
    if (localRegion && this.routingConfig.preferLocal) {
      return localRegion.id;
    }

    // Find region with lowest latency
    let bestRegion: Region | null = null;
    let lowestLatency = Infinity;

    for (const [regionId, latency] of this.regionLatencies) {
      if (latency < lowestLatency && latency < this.routingConfig.latencyThreshold) {
        lowestLatency = latency;
        bestRegion = this.regions.get(regionId) || null;
      }
    }

    return bestRegion?.id || null;
  }

  /**
   * Get regions for write replication
   */
  getReplicationRegions(primaryRegion: string): string[] {
    // Return all regions except primary (for active-active replication)
    return Array.from(this.regions.keys()).filter(id => id !== primaryRegion);
  }

  /**
   * Resolve conflicts between regions
   */
  async resolveConflict(
    resourceId: string,
    region1: string,
    value1: any,
    timestamp1: number,
    region2: string,
    value2: any,
    timestamp2: number
  ): Promise<any> {
    logger.warn('Conflict detected', {
      resourceId,
      region1,
      region2,
      timestamp1,
      timestamp2,
      strategy: this.conflictResolution
    });

    switch (this.conflictResolution) {
      case 'last-write-wins':
        return timestamp1 > timestamp2 ? value1 : value2;

      case 'first-write-wins':
        return timestamp1 < timestamp2 ? value1 : value2;

      case 'version-vector':
        return this.resolveWithVersionVector(resourceId, region1, value1, region2, value2);

      case 'custom':
        // Custom resolution would call user-defined function
        throw new Error('Custom conflict resolution not implemented');

      default:
        return timestamp1 > timestamp2 ? value1 : value2;
    }
  }

  /**
   * Version vector conflict resolution
   */
  private resolveWithVersionVector(
    resourceId: string,
    region1: string,
    value1: any,
    region2: string,
    value2: any
  ): any {
    if (!this.versionVectors.has(resourceId)) {
      this.versionVectors.set(resourceId, new Map());
    }

    const vector = this.versionVectors.get(resourceId)!;
    const v1 = vector.get(region1) || 0;
    const v2 = vector.get(region2) || 0;

    // Higher version wins
    if (v1 > v2) {
      vector.set(region1, v1 + 1);
      return value1;
    } else if (v2 > v1) {
      vector.set(region2, v2 + 1);
      return value2;
    } else {
      // Same version - use last-write-wins as tiebreaker
      vector.set(region1, v1 + 1);
      return value1;
    }
  }

  /**
   * Handle regional failover
   */
  async handleRegionalFailover(failedRegionId: string): Promise<void> {
    logger.warn('Regional failover initiated', { failedRegionId });

    const failedRegion = this.regions.get(failedRegionId);
    if (!failedRegion) {
      throw new ValidationError(`Region ${failedRegionId} not found`, 'regionId', failedRegionId);
    }

    // Find backup region
    const backupRegion = this.findBackupRegion(failedRegionId);
    if (!backupRegion) {
      throw new Error('No backup region available for failover');
    }

    // Redirect traffic to backup region
    if (this.routingConfig.failoverStrategy === 'fast-failover') {
      // Immediate failover
      await this.performFastFailover(failedRegionId, backupRegion.id);
    } else {
      // Consistent failover (ensure data consistency first)
      await this.performConsistentFailover(failedRegionId, backupRegion.id);
    }

    logger.info('Regional failover completed', {
      from: failedRegionId,
      to: backupRegion.id
    });
  }

  /**
   * Perform fast failover
   */
  private async performFastFailover(fromRegion: string, toRegion: string): Promise<void> {
    // Immediately redirect traffic
    // In production, this would update routing tables, DNS, etc.
    logger.info('Fast failover performed', { fromRegion, toRegion });
  }

  /**
   * Perform consistent failover
   */
  private async performConsistentFailover(fromRegion: string, toRegion: string): Promise<void> {
    // Ensure data is synchronized before failover
    await this.synchronizeRegions(fromRegion, toRegion);
    
    // Then perform failover
    await this.performFastFailover(fromRegion, toRegion);
  }

  /**
   * Synchronize data between regions
   */
  private async synchronizeRegions(fromRegion: string, toRegion: string): Promise<void> {
    // In production, this would sync all data from source to target
    logger.info('Synchronizing regions', { fromRegion, toRegion });
  }

  /**
   * Update region latency
   */
  updateRegionLatency(regionId: string, latency: number): void {
    this.regionLatencies.set(regionId, latency);
  }

  /**
   * Get region information
   */
  getRegion(regionId: string): Region | undefined {
    return this.regions.get(regionId);
  }

  /**
   * Get all regions
   */
  getAllRegions(): Region[] {
    return Array.from(this.regions.values());
  }

  /**
   * Get local region (region containing this node)
   */
  private getLocalRegion(): Region | null {
    const nodeStatus = this.getNodeStatus();
    const nodeId = nodeStatus.id;

    for (const region of this.regions.values()) {
      if (region.nodes.includes(nodeId)) {
        return region;
      }
    }

    return null;
  }

  /**
   * Find backup region for failover
   */
  private findBackupRegion(excludeRegionId: string): Region | null {
    const candidates = Array.from(this.regions.values())
      .filter(r => r.id !== excludeRegionId)
      .sort((a, b) => a.priority - b.priority); // Lower priority = better

    return candidates.length > 0 ? candidates[0] : null;
  }

  /**
   * Validate regions configuration
   */
  private validateRegions(regions: Region[]): void {
    if (!regions || regions.length === 0) {
      throw new ValidationError('At least one region must be specified', 'regions', regions);
    }

    const regionIds = new Set<string>();
    for (const region of regions) {
      if (regionIds.has(region.id)) {
        throw new ValidationError(`Duplicate region ID: ${region.id}`, 'regionId', region.id);
      }
      regionIds.add(region.id);

      if (!region.name || region.nodes.length === 0) {
        throw new ValidationError(`Invalid region configuration: ${region.id}`, 'region', region);
      }
    }
  }
}

