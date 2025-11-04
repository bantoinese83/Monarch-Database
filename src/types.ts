export interface Document {
  _id?: string;
  [key: string]: any;
}

export interface QueryOperators {
  $gt?: any;
  $gte?: any;
  $lt?: any;
  $lte?: any;
  $ne?: any;
  $in?: any[];
  $nin?: any[];
}

export type QueryValue = any | QueryOperators;

export interface Query {
  [key: string]: QueryValue;
}

export interface UpdateOperation {
  [key: string]: any;
}

export interface BulkInsertOptions {
  batchSize?: number; // Number of documents to process per batch (default: 5000)
  skipValidation?: boolean; // Skip document validation for performance (default: false)
  emitEvents?: boolean; // Emit change events for each inserted document (default: true)
  timeout?: number; // Timeout in milliseconds for the entire operation (default: 300000)
}

export interface BulkInsertResult {
  insertedCount: number; // Number of documents successfully inserted
  insertedIds: string[]; // Array of inserted document IDs
}

export interface BulkDeleteOptions {
  limit?: number; // Maximum number of documents to delete (default: unlimited)
  emitEvents?: boolean; // Emit change events for each deleted document (default: true)
  timeout?: number; // Timeout in milliseconds for the entire operation (default: 120000)
}

export interface BulkDeleteResult {
  deletedCount: number; // Number of documents successfully deleted
  deletedIds: string[]; // Array of deleted document IDs
}

export interface IndexData {
  fieldName: string;
  data: Map<any, Document[]>;
}

export interface PersistenceAdapter {
  save(data: any): Promise<void>;
  load(): Promise<any>;
}

export interface TransactionOptions {
  isolation?: 'read-committed' | 'repeatable-read' | 'serializable';
  timeout?: number; // milliseconds
}

export interface Transaction {
  id: string;
  operations: TransactionOperation[];
  status: 'active' | 'committed' | 'rolled-back' | 'failed';
  startTime: number;
  options: TransactionOptions;
}

export interface TransactionOperation {
  type: 'insert' | 'update' | 'remove';
  collection: string;
  data: any;
  timestamp: number;
}

export interface ChangeEvent {
  type: 'insert' | 'update' | 'remove';
  collection: string;
  document: Document;
  oldDocument?: Document;
  timestamp: number;
  transactionId?: string;
}

export interface ChangeStreamOptions {
  collection?: string;
  operation?: 'insert' | 'update' | 'remove';
  filter?: (event: ChangeEvent) => boolean;
}

export interface ChangeStreamListener {
  id: string;
  options: ChangeStreamOptions;
  callback: (event: ChangeEvent) => void;
}

export interface SchemaDefinition {
  $schema?: string;
  type: 'object';
  properties?: Record<string, SchemaProperty>;
  required?: string[];
  additionalProperties?: boolean;
}

export interface SchemaProperty {
  type?: string | string[];
  properties?: Record<string, SchemaProperty>;
  items?: SchemaProperty;
  enum?: any[];
  minimum?: number;
  maximum?: number;
  minLength?: number;
  maxLength?: number;
  pattern?: string;
  format?: string;
  required?: string[];
  additionalProperties?: boolean;
}

export interface QueryPlan {
  collection: string;
  query: Query;
  indexUsed?: string;
  estimatedCost: number;
  estimatedResults: number;
  executionSteps: QueryStep[];
  // Quantum optimization fields
  quantumOptimized?: boolean;
  quantumAdvantage?: number;
  executionTime?: number;
  // Extended fields for quantum optimization
  strategy?: any;
  indexes?: string[];
  joins?: any[];
  filters?: any[];
}

export interface QueryStep {
  type: 'scan' | 'index-lookup' | 'filter' | 'sort' | 'limit' | 'quantum-optimized';
  description: string;
  cost: number;
  selectivity: number;
}

// Data Structure Types
export type DataStructureType = 'document' | 'list' | 'set' | 'hash' | 'sorted-set' | 'stream' | 'geospatial' | 'time-series' | 'graph';

export interface ListEntry {
  value: any;
  timestamp: number;
}

export interface SetEntry {
  value: any;
  timestamp: number;
}

export interface HashEntry {
  field: string;
  value: any;
  timestamp: number;
}

export interface SortedSetEntry {
  value: any;
  score: number;
  timestamp: number;
}

export interface StreamEntry {
  id: string;
  fields: Record<string, any>;
  timestamp: number;
}

export interface GeospatialEntry {
  id: string;
  longitude: number;
  latitude: number;
  name?: string;
  metadata?: Record<string, any>;
}

export interface TimeSeriesEntry {
  timestamp: number;
  value: number;
  labels?: Record<string, string>;
}

// Data Structure Operations
export interface ListOperations {
  lpush(key: string, values: any[]): Promise<number>;
  rpush(key: string, values: any[]): Promise<number>;
  lpop(key: string): Promise<any>;
  rpop(key: string): Promise<any>;
  lrange(key: string, start: number, end: number): Promise<any[]>;
  llen(key: string): Promise<number>;
  ltrim(key: string, start: number, end: number): Promise<void>;
  lindex(key: string, index: number): Promise<any>;
  lset(key: string, index: number, value: any): Promise<void>;
  lrem(key: string, count: number, value: any): Promise<number>;
}

export interface SetOperations {
  sadd(key: string, members: any[]): Promise<number>;
  srem(key: string, members: any[]): Promise<number>;
  smembers(key: string): Promise<any[]>;
  sismember(key: string, member: any): Promise<boolean>;
  scard(key: string): Promise<number>;
  sdiff(keys: string[]): Promise<any[]>;
  sinter(keys: string[]): Promise<any[]>;
  sunion(keys: string[]): Promise<any[]>;
  srandmember(key: string, count?: number): Promise<any[]>;
}

export interface HashOperations {
  hset(key: string, field: string, value: any): Promise<number>;
  hget(key: string, field: string): Promise<any>;
  hgetall(key: string): Promise<Record<string, any>>;
  hdel(key: string, fields: string[]): Promise<number>;
  hexists(key: string, field: string): Promise<boolean>;
  hkeys(key: string): Promise<string[]>;
  hvals(key: string): Promise<any[]>;
  hlen(key: string): Promise<number>;
  hincrby(key: string, field: string, increment: number): Promise<number>;
  hincrbyfloat(key: string, field: string, increment: number): Promise<number>;
}

export interface SortedSetOperations {
  zadd(key: string, scores: Record<string, number>): Promise<number>;
  zrem(key: string, members: any[]): Promise<number>;
  zscore(key: string, member: any): Promise<number | null>;
  zrank(key: string, member: any): Promise<number | null>;
  zrevrank(key: string, member: any): Promise<number | null>;
  zrange(key: string, start: number, end: number, withScores?: boolean): Promise<any[]>;
  zrevrange(key: string, start: number, end: number, withScores?: boolean): Promise<any[]>;
  zrangebyscore(key: string, min: number, max: number): Promise<any[]>;
  zcard(key: string): Promise<number>;
  zcount(key: string, min: number, max: number): Promise<number>;
  zincrby(key: string, increment: number, member: any): Promise<number>;
}

export interface StreamOperations {
  xadd(key: string, id: string, fields: Record<string, any>): Promise<string>;
  xread(streams: Record<string, string>, count?: number, block?: number): Promise<Record<string, StreamEntry[]>>;
  xrange(key: string, start: string, end: string, count?: number): Promise<StreamEntry[]>;
  xrevrange(key: string, end: string, start: string, count?: number): Promise<StreamEntry[]>;
  xlen(key: string): Promise<number>;
  xdel(key: string, ids: string[]): Promise<number>;
  xtrim(key: string, strategy: 'maxlen' | 'minid', threshold: string | number): Promise<number>;
}

export interface GeospatialOperations {
  geoadd(key: string, longitude: number, latitude: number, member: string, name?: string): Promise<number>;
  geopos(key: string, members: string[]): Promise<Array<{ longitude: number; latitude: number } | null>>;
  geodist(key: string, member1: string, member2: string, unit?: 'm' | 'km' | 'mi' | 'ft'): Promise<number | null>;
  georadius(key: string, longitude: number, latitude: number, radius: number, unit: 'm' | 'km' | 'mi' | 'ft', options?: { withCoord?: boolean; withDist?: boolean; count?: number }): Promise<any[]>;
  georadiusbymember(key: string, member: string, radius: number, unit: 'm' | 'km' | 'mi' | 'ft', options?: { withCoord?: boolean; withDist?: boolean; count?: number }): Promise<any[]>;
  geohash(key: string, members: string[]): Promise<string[]>;
}

export interface TimeSeriesOperations {
  tsadd(key: string, timestamp: number, value: number, labels?: Record<string, string>): Promise<void>;
  tsget(key: string, timestamp: number): Promise<TimeSeriesEntry | null>;
  tsrange(key: string, fromTimestamp: number, toTimestamp: number): Promise<TimeSeriesEntry[]>;
  tsrevrange(key: string, fromTimestamp: number, toTimestamp: number): Promise<TimeSeriesEntry[]>;
  tslast(key: string): Promise<TimeSeriesEntry | null>;
  tscount(key: string): Promise<number>;
  tsmin(key: string): Promise<TimeSeriesEntry | null>;
  tsmax(key: string): Promise<TimeSeriesEntry | null>;
  tsavg(key: string, fromTimestamp?: number, toTimestamp?: number): Promise<number | null>;
}

// Vector Search Types
export interface VectorEntry {
  id: string;
  vector: number[];
  metadata?: Record<string, any>;
}

export interface VectorSearchResult {
  id: string;
  score: number;
  metadata?: Record<string, any>;
}

export interface VectorOperations {
  vadd(key: string, id: string, vector: number[], metadata?: Record<string, any>): Promise<void>;
  vget(key: string, id: string): Promise<VectorEntry | null>;
  vsearch(key: string, queryVector: number[], topK?: number, includeMetadata?: boolean): Promise<VectorSearchResult[]>;
  vdel(key: string, ids: string[]): Promise<number>;
  vcount(key: string): Promise<number>;
}

// Graph Database Types
export interface GraphOperations {
  // Node operations
  gcreateNode(graphKey: string, label?: string, properties?: Record<string, any>): Promise<string>;
  ggetNode(graphKey: string, nodeId: string): Promise<any | null>;
  gupdateNode(graphKey: string, nodeId: string, properties: Record<string, any>): Promise<boolean>;
  gdeleteNode(graphKey: string, nodeId: string): Promise<boolean>;
  
  // Edge operations
  gcreateEdge(graphKey: string, from: string, to: string, type?: string, properties?: Record<string, any>): Promise<string>;
  ggetEdge(graphKey: string, edgeId: string): Promise<any | null>;
  gupdateEdge(graphKey: string, edgeId: string, properties: Record<string, any>): Promise<boolean>;
  gdeleteEdge(graphKey: string, edgeId: string): Promise<boolean>;
  
  // Query operations
  ggetNeighbors(graphKey: string, nodeId: string, direction?: 'outgoing' | 'incoming' | 'both'): Promise<any[]>;
  gtraverse(graphKey: string, startNodeId: string, options?: any): Promise<any>;
  gfindByLabel(graphKey: string, label: string): Promise<any[]>;
  gfindByProperty(graphKey: string, field: string, value: any): Promise<any[]>;
  ggetStats(graphKey: string): Promise<any>;
}

// Durability and Consistency Types
export type DurabilityLevel = 'none' | 'low' | 'medium' | 'high' | 'maximum';
export type ConsistencyMode = 'strong' | 'eventual' | 'causal' | 'session';

export interface DurabilityOptions {
  level: DurabilityLevel;
  syncInterval: number; // milliseconds between syncs
  maxWALSize: number; // maximum WAL file size in bytes
  snapshotInterval: number; // milliseconds between snapshots
  compressionEnabled: boolean;
  encryptionEnabled: boolean;
}

export interface ConsistencyOptions {
  mode: ConsistencyMode;
  readConcern?: 'local' | 'majority' | 'linearizable';
  writeConcern?: 'unacknowledged' | 'acknowledged' | 'majority' | 'linearizable';
}

export interface WALEntry {
  id: string;
  timestamp: number;
  operation: string;
  collection?: string;
  data: any;
  checksum: string;
}

export interface SnapshotMetadata {
  id: string;
  timestamp: number;
  collections: Record<string, { count: number; checksum: string }>;
  walPosition: number;
}

export interface DurabilityManager {
  configure(options: DurabilityOptions): Promise<void>;
  writeWAL(entry: WALEntry): Promise<void>;
  createSnapshot(): Promise<string>;
  recoverFromWAL(): Promise<void>;
  getStats(): Promise<{ walSize: number; snapshots: number; lastSync: number }>;
}

// Security Types
export type Permission = 'read' | 'write' | 'admin' | 'create' | 'drop';
export type Role = 'admin' | 'developer' | 'user' | 'viewer' | 'guest';

export interface User {
  id: string;
  username: string;
  roles: Role[];
  permissions: Permission[];
  encryptedPassword?: string;
  metadata?: Record<string, any>;
}

export interface SecurityContext {
  user: User;
  sessionId: string;
  permissions: Permission[];
  expiresAt: number;
}

export interface AccessControl {
  authenticate(username: string, password: string): Promise<SecurityContext | null>;
  authorize(context: SecurityContext, permission: Permission, resource?: string): boolean;
  encrypt(data: any): Promise<string>;
  decrypt(encryptedData: string): Promise<any>;
  hashPassword(password: string): Promise<string>;
  verifyPassword(password: string, hash: string): Promise<boolean>;
}

// Clustering Types
export type NodeStatus = 'online' | 'offline' | 'maintenance' | 'failed';
export type ReplicationStrategy = 'master-slave' | 'multi-master' | 'sharding';

export interface ClusterNode {
  id: string;
  host: string;
  port: number;
  status: NodeStatus;
  role: 'master' | 'slave' | 'coordinator';
  lastHeartbeat: number;
  metadata: Record<string, any>;
}

export interface Shard {
  id: string;
  collections: string[];
  primaryNode: string;
  replicaNodes: string[];
  status: 'active' | 'migrating' | 'failed';
}

export interface ClusterConfig {
  nodes: ClusterNode[];
  shards: Shard[];
  replicationStrategy: ReplicationStrategy;
  heartbeatInterval: number;
  failoverTimeout: number;
}

export interface ClusteringManager {
  joinCluster(config: ClusterConfig): Promise<void>;
  leaveCluster(): Promise<void>;
  getNodeStatus(): ClusterNode;
  redistributeData(): Promise<void>;
  handleFailover(failedNodeId: string): Promise<void>;
  getClusterStats(): Promise<{ nodes: number; shards: number; health: number }>;
}

// AI/ML Integration Types
export type MLTask = 'classification' | 'regression' | 'clustering' | 'dimensionality-reduction' | 'anomaly-detection';
export type ModelFormat = 'onnx' | 'tensorflow' | 'pytorch' | 'sklearn' | 'ensemble';

export interface MLModel {
  id: string;
  name: string;
  format: ModelFormat;
  task: MLTask;
  inputShape: number[];
  outputShape: number[];
  parameters: Record<string, any>;
  metadata: Record<string, any>;
}

export interface TrainingData {
  features: number[][];
  labels: number[] | string[];
  metadata?: Record<string, any>;
}

export interface InferenceResult {
  predictions: number[] | string[];
  confidence?: number[];
  metadata?: Record<string, any>;
}

export interface MLIntegration {
  loadModel(model: MLModel, modelData: Buffer): Promise<string>;
  unloadModel(modelId: string): Promise<void>;
  trainModel(modelId: string, data: TrainingData, options?: Record<string, any>): Promise<MLModel>;
  runInference(modelId: string, input: number[][]): Promise<InferenceResult>;
  getModelStats(modelId: string): Promise<{ accuracy: number; latency: number; throughput: number }>;
}

// Scripting Extensions Types
export type ScriptLanguage = 'lua' | 'javascript' | 'wasm';
export type ExecutionContext = 'server' | 'client' | 'edge';

export interface Script {
  id: string;
  name: string;
  language: ScriptLanguage;
  code: string;
  context: ExecutionContext;
  permissions: Permission[];
  metadata: Record<string, any>;
}

export interface ScriptExecutionResult {
  success: boolean;
  result?: any;
  error?: string;
  executionTime: number;
  memoryUsed: number;
}

export interface ScriptingEngine {
  loadScript(script: Script): Promise<string>;
  executeScript(scriptId: string, context: Record<string, any>): Promise<ScriptExecutionResult>;
  unloadScript(scriptId: string): Promise<void>;
  getScriptStats(scriptId: string): Promise<{ executions: number; avgTime: number; errors: number }>;
}

// Quantum Walk Algorithm Types
export interface ComplexNumber {
  real: number;
  imag: number;
}

export interface QuantumState {
  amplitudes: Map<string, ComplexNumber>;
}

export interface QuantumGraph {
  nodes: string[];
  edges: Map<string, string[]>;
  weights?: Map<string, Map<string, number>>;
}

export interface QuantumPathResult {
  path: string[];
  probability: number;
  steps: number;
  convergence: number;
}

export interface QuantumWalkPathFinder {
  findShortestPath(startNode: string, targetNode: string, maxSteps?: number): QuantumPathResult;
  calculateQuantumCentrality(maxSteps?: number): Map<string, number>;
  detectCommunities(maxSteps?: number): Map<string, number>;
}

export interface QuantumGraphEngine {
  initialize(graph: QuantumGraph): void;
  findShortestPath(startNode: string, targetNode: string, maxSteps?: number): QuantumPathResult | null;
  calculateCentrality(maxSteps?: number): Map<string, number> | null;
  detectCommunities(maxSteps?: number): Map<string, number> | null;
  getStats(): {
    initialized: boolean;
    algorithm: string;
    version: string;
  };
}
