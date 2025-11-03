/**
 * Centralized Configuration System
 *
 * Consolidates all magic numbers, constants, and configuration values
 * into a single, type-safe configuration system.
 */

export interface DatabaseLimits {
  maxDocumentSize: number; // bytes
  maxCollectionSize: number; // bytes
  maxDocumentsPerCollection: number;
  maxDocumentsPerOperation: number;
  maxFieldNameLength: number;
  maxCollectionNameLength: number;
  maxQueryDepth: number;
  maxQueryOperators: number;
  maxQuerySize: number; // bytes
}

export interface PerformanceLimits {
  maxConcurrentOperations: number;
  operationTimeout: number; // ms
  maxMetricsHistory: number;
  queryCacheSize: number;
  queryCacheTTL: number; // ms
}

export interface SecurityLimits {
  sessionTimeout: number; // ms
  maxLoginAttempts: number;
  passwordMinLength: number;
  maxUsers: number;
  maxActiveSessions: number;
}

export interface DurabilityLimits {
  walMaxSize: number; // bytes
  snapshotInterval: number; // ms
  syncInterval: number; // ms
  maxSnapshots: number;
}

export interface ClusteringLimits {
  heartbeatInterval: number; // ms
  failoverTimeout: number; // ms
  maxNodes: number;
  maxShards: number;
}

export interface AIMLLimits {
  maxModelSize: number; // bytes
  maxTrainingTime: number; // ms
  maxInferenceBatchSize: number;
  maxConcurrentModels: number;
}

export interface ScriptingLimits {
  maxScriptSize: number; // bytes
  maxExecutionTime: number; // ms
  maxMemoryUsage: number; // bytes
  maxConcurrentScripts: number;
}

export interface DatabaseConfig {
  limits: DatabaseLimits;
  performance: PerformanceLimits;
  security: SecurityLimits;
  durability: DurabilityLimits;
  clustering: ClusteringLimits;
  ai: AIMLLimits;
  scripting: ScriptingLimits;
}

// Default configuration values
// @internal - Used internally only
const DEFAULT_CONFIG: DatabaseConfig = {
  limits: {
    maxDocumentSize: 10 * 1024 * 1024, // 10MB
    maxCollectionSize: 100 * 1024 * 1024, // 100MB
    maxDocumentsPerCollection: 100000,
    maxDocumentsPerOperation: 10000,
    maxFieldNameLength: 255,
    maxCollectionNameLength: 100,
    maxQueryDepth: 10,
    maxQueryOperators: 20,
    maxQuerySize: 1024 * 1024 // 1MB
  },

  performance: {
    maxConcurrentOperations: 50,
    operationTimeout: 30000, // 30 seconds
    maxMetricsHistory: 100,
    queryCacheSize: 1000,
    queryCacheTTL: 300000 // 5 minutes
  },

  security: {
    sessionTimeout: 24 * 60 * 60 * 1000, // 24 hours
    maxLoginAttempts: 5,
    passwordMinLength: 8,
    maxUsers: 10000,
    maxActiveSessions: 1000
  },

  durability: {
    walMaxSize: 100 * 1024 * 1024, // 100MB
    snapshotInterval: 300000, // 5 minutes
    syncInterval: 5000, // 5 seconds
    maxSnapshots: 10
  },

  clustering: {
    heartbeatInterval: 1000, // 1 second
    failoverTimeout: 5000, // 5 seconds
    maxNodes: 100,
    maxShards: 1000
  },

  ai: {
    maxModelSize: 1024 * 1024 * 1024, // 1GB
    maxTrainingTime: 3600000, // 1 hour
    maxInferenceBatchSize: 1000,
    maxConcurrentModels: 10
  },

  scripting: {
    maxScriptSize: 1024 * 1024, // 1MB
    maxExecutionTime: 30000, // 30 seconds
    maxMemoryUsage: 100 * 1024 * 1024, // 100MB
    maxConcurrentScripts: 20
  }
};

/**
 * Configuration Manager
 *
 * Provides type-safe access to configuration values
 * and allows runtime configuration updates.
 * @internal
 */
export class ConfigManager {
  private config: DatabaseConfig;

  constructor(initialConfig?: Partial<DatabaseConfig>) {
    this.config = { ...DEFAULT_CONFIG, ...initialConfig };
  }

  /**
   * Get the current configuration
   */
  getConfig(): DatabaseConfig {
    return { ...this.config };
  }

  /**
   * Update configuration values
   */
  updateConfig(updates: Partial<DatabaseConfig>): void {
    this.config = this.mergeConfigs(this.config, updates);
  }

  /**
   * Get database limits
   */
  getLimits(): DatabaseLimits {
    return this.config.limits;
  }

  /**
   * Get performance limits
   */
  getPerformanceLimits(): PerformanceLimits {
    return this.config.performance;
  }

  /**
   * Get security limits
   */
  getSecurityLimits(): SecurityLimits {
    return this.config.security;
  }

  /**
   * Get durability limits
   */
  getDurabilityLimits(): DurabilityLimits {
    return this.config.durability;
  }

  /**
   * Get clustering limits
   */
  getClusteringLimits(): ClusteringLimits {
    return this.config.clustering;
  }

  /**
   * Get AI/ML limits
   */
  getAIMLLimits(): AIMLLimits {
    return this.config.ai;
  }

  /**
   * Get scripting limits
   */
  getScriptingLimits(): ScriptingLimits {
    return this.config.scripting;
  }

  /**
   * Validate configuration values
   */
  validateConfig(): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    // Validate database limits
    if (this.config.limits.maxDocumentSize <= 0) {
      errors.push('maxDocumentSize must be positive');
    }
    if (this.config.limits.maxCollectionSize < this.config.limits.maxDocumentSize) {
      errors.push('maxCollectionSize must be >= maxDocumentSize');
    }

    // Validate performance limits
    if (this.config.performance.maxConcurrentOperations <= 0) {
      errors.push('maxConcurrentOperations must be positive');
    }

    // Validate security limits
    if (this.config.security.sessionTimeout <= 0) {
      errors.push('sessionTimeout must be positive');
    }

    return {
      valid: errors.length === 0,
      errors
    };
  }

  private mergeConfigs(base: DatabaseConfig, updates: Partial<DatabaseConfig>): DatabaseConfig {
    return {
      limits: { ...base.limits, ...updates.limits },
      performance: { ...base.performance, ...updates.performance },
      security: { ...base.security, ...updates.security },
      durability: { ...base.durability, ...updates.durability },
      clustering: { ...base.clustering, ...updates.clustering },
      ai: { ...base.ai, ...updates.ai },
      scripting: { ...base.scripting, ...updates.scripting }
    };
  }
}

// Global configuration instance
export const globalConfig = new ConfigManager();
