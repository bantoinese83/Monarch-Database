// Main exports
export { Monarch } from './monarch';
export { Collection } from './collection';

// Configuration
export type { MonarchConfig } from './monarch-config';

// Validators
export { CollectionValidator, DocumentValidator, QueryValidator } from './validators';

// Constants
export { LIMITS, ERROR_MESSAGES } from './constants';

// Types
export type {
  Document,
  Query,
  UpdateOperation,
  PersistenceAdapter,
  TransactionOptions,
  SchemaDefinition,
  ChangeStreamOptions,
  QueryPlan,
  // Data Structure Types
  DataStructureType,
  ListEntry,
  SetEntry,
  HashEntry,
  SortedSetEntry,
  StreamEntry,
  GeospatialEntry,
  TimeSeriesEntry,
  VectorEntry,
  VectorSearchResult,
  IndexData,
  // Data Structure Operation Interfaces
  ListOperations,
  SetOperations,
  HashOperations,
  SortedSetOperations,
  StreamOperations,
  GeospatialOperations,
  TimeSeriesOperations,
  VectorOperations,
  GraphOperations,
// Durability Types
  DurabilityLevel,
  DurabilityOptions,
  ConsistencyOptions,
  WALEntry,
  SnapshotMetadata,
// Security Types
  Permission,
  Role,
  User,
  SecurityContext,
  AccessControl,
// Clustering Types
  NodeStatus,
  ReplicationStrategy,
  ClusterNode,
  Shard,
  ClusterConfig,
// AI/ML Types
  MLTask,
  ModelFormat,
  MLModel,
  TrainingData,
  InferenceResult,
  MLIntegration,
// Scripting Types
  ScriptLanguage,
  ExecutionContext,
  Script,
  ScriptExecutionResult
} from './types';

// Adapters
export { FileSystemAdapter } from './adapters/filesystem';
export { IndexedDBAdapter } from './adapters/indexeddb';

// Performance monitoring
export { PerformanceMonitor, globalMonitor } from './performance-monitor';
export type { PerformanceMetrics } from './performance-monitor';
export { QueryCache } from './query-cache';

// Advanced features
export { TransactionManager } from './transaction-manager';
export { ChangeStreamsManager } from './change-streams';
export { SchemaValidator } from './schema-validator';
export { QueryOptimizer } from './query-optimizer';
export { OptimizedDataStructures as DataStructures } from './optimized-data-structures';
export { GraphDatabase } from './graph-database';

// Enterprise features
export { DurabilityManagerImpl as DurabilityManager } from './durability-manager';
export { EnhancedDurabilityManager } from './durability-enhanced';
export { SecurityManager } from './security-manager';
export { ClusteringManagerImpl as ClusteringManager } from './clustering-manager';
export { MultiRegionClusteringManager } from './clustering-multiregion';
export { AIMLIntegration } from './ai-ml-integration';
export { EnhancedAIMLIntegration } from './ai-ml-enhanced';
export { ScriptingEngineImpl as ScriptingEngine } from './scripting-engine';

// Observability & Operations
export { logger, LogLevel } from './logger';
export type { LogEntry, LoggerConfig } from './logger';
export { healthChecker, HealthChecker } from './health-check';
export type { HealthStatus, ReadinessStatus, LivenessStatus } from './health-check';
export { HTTPServer } from './http-server';
export type { ServerConfig } from './http-server';
export { envValidator, EnvValidator } from './env-validator';
export type { EnvConfig } from './env-validator';

// Security & Rate Limiting
export { RateLimiter, defaultRateLimiter } from './rate-limiter';
export type { RateLimitConfig, RateLimitResult } from './rate-limiter';
export { InputSanitizer, defaultSanitizer } from './input-sanitizer';
export type { SanitizationOptions } from './input-sanitizer';

// Backup & Recovery
export { BackupManager } from './backup-manager';
export type { BackupConfig, BackupMetadata } from './backup-manager';

// Error Handling
export { 
  ValidationError, 
  ResourceLimitError,
  SecurityError,
  PerformanceError,
  ConnectivityError,
  DataIntegrityError,
  ConfigurationError
} from './errors';
export type { MonarchError, ErrorSeverity, ErrorCategory } from './errors';

// Enhanced Features
export { ObservabilityManager, observability } from './observability';
export type { MetricDefinition, MetricValue, TraceSpan, AlertConfig } from './observability';
export {
  MemoryPool,
  LockFreeQueue,
  ZeroCopyBuffer,
  SIMDVectorOps,
  NUMAMemoryManager,
  CPUAffinityManager
} from './performance-optimized';
export {
  ObjectPool,
  QueryPlanCache,
  PerformanceProfiler,
  globalProfiler,
  fastHash,
  fastClone,
  fastMerge,
  ArrayPool,
  FastSet,
  CircularBuffer
} from './performance-optimizer';
export {
  WeakCache,
  MemoryPressureMonitor,
  CompactArray,
  BitmapSet,
  globalMemoryMonitor
} from './memory-optimizer';
export { ComplianceManager } from './security-compliance';
export type {
  AuditLogEntry,
  RetentionPolicy,
  DataSubjectRequest,
  EncryptionAtRestConfig
} from './security-compliance';

// CLI
export { CLIRegistry, registry as cliRegistry } from './cli/index';

// Server Mode
export { default as startServer } from './server';
