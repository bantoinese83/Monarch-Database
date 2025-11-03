/**
 * Monarch Configuration Interface
 * 
 * Supports dependency injection to follow SOLID principles (Dependency Inversion).
 * Allows injecting managers instead of hardcoding instantiations.
 */

import { PersistenceAdapter } from './types';
import { TransactionManager } from './transaction-manager';
import { DurabilityManagerImpl } from './durability-manager';
import { SecurityManager } from './security-manager';
import { ClusteringManagerImpl } from './clustering-manager';
import { AIMLIntegration } from './ai-ml-integration';
import { ScriptingEngineImpl } from './scripting-engine';

/**
 * Configuration for Monarch database instance
 * Allows dependency injection of all managers
 */
export interface MonarchConfig {
  /**
   * Persistence adapter for data persistence
   */
  adapter?: PersistenceAdapter;
  
  /**
   * Transaction manager factory
   * If not provided, a default TransactionManager will be created
   */
  transactionManagerFactory?: () => TransactionManager;
  
  /**
   * Durability manager factory
   * If not provided, will be lazily created with default './data' path
   */
  durabilityManagerFactory?: () => DurabilityManagerImpl;
  
  /**
   * Security manager factory
   * If not provided, will be lazily created with default encryption key
   * WARNING: Default encryption key is for development only!
   */
  securityManagerFactory?: () => SecurityManager;
  
  /**
   * Clustering manager factory
   * If not provided, will be lazily created
   */
  clusteringManagerFactory?: () => ClusteringManagerImpl;
  
  /**
   * AI/ML integration factory
   * If not provided, will be lazily created
   */
  aiIntegrationFactory?: () => AIMLIntegration;
  
  /**
   * Scripting engine factory
   * If not provided, will be lazily created
   */
  scriptingEngineFactory?: () => ScriptingEngineImpl;
  
  /**
   * Encryption key for security manager (if using default factory)
   * Should be provided via environment variable in production
   */
  encryptionKey?: string;
  
  /**
   * Durability data path (if using default factory)
   */
  durabilityDataPath?: string;
}

