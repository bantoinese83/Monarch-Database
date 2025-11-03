/**
 * Enhanced AI/ML Integration
 * 
 * Expanded AI/ML support with real-time inference, model versioning,
 * auto-scaling, and advanced model management.
 */

import { AIMLIntegration } from './ai-ml-integration';
import { MLModel, TrainingData, InferenceResult, MLTask } from './types';
import { logger } from './logger';

/**
 * Model version metadata
 */
export interface ModelVersion {
  version: string;
  modelId: string;
  accuracy: number;
  latency: number;
  createdAt: number;
  isActive: boolean;
  trafficSplit?: number; // Percentage of traffic for A/B testing
}

/**
 * Inference pipeline configuration
 */
export interface InferencePipelineConfig {
  batchSize?: number;
  timeout?: number;
  retries?: number;
  cacheEnabled?: boolean;
  cacheTTL?: number;
}

/**
 * Auto-scaling configuration
 */
export interface AutoScalingConfig {
  enabled: boolean;
  minInstances: number;
  maxInstances: number;
  targetLatency: number; // ms
  scaleUpThreshold: number; // requests per second
  scaleDownThreshold: number; // requests per second
}

/**
 * Enhanced AI/ML Integration with advanced features
 */
export class EnhancedAIMLIntegration extends AIMLIntegration {
  private modelVersions: Map<string, ModelVersion[]> = new Map(); // modelId -> versions
  private activeVersions: Map<string, string> = new Map(); // modelId -> active version
  private inferenceCache: Map<string, { result: InferenceResult; timestamp: number }> = new Map();
  private requestQueue: Array<{ input: number[][]; resolve: (result: InferenceResult) => void; reject: (error: Error) => void }> = [];
  private pipelineConfig: InferencePipelineConfig = {
    batchSize: 10,
    timeout: 5000,
    retries: 2,
    cacheEnabled: true,
    cacheTTL: 60000 // 1 minute
  };
  private autoScaling: AutoScalingConfig = {
    enabled: false,
    minInstances: 1,
    maxInstances: 10,
    targetLatency: 100,
    scaleUpThreshold: 100,
    scaleDownThreshold: 10
  };
  private currentInstances = 1;
  private requestMetrics: { count: number; totalLatency: number; lastReset: number } = {
    count: 0,
    totalLatency: 0,
    lastReset: Date.now()
  };

  /**
   * Create a new model version
   */
  async createModelVersion(
    baseModelId: string,
    version: string,
    modelData: Buffer
  ): Promise<string> {
    const baseModel = (this as any).models.get(baseModelId);
    if (!baseModel) {
      throw new Error(`Base model ${baseModelId} not found`);
    }

    // Create new version
    const newModel: MLModel = {
      ...baseModel,
      id: `${baseModelId}_v${version}`,
      parameters: {
        ...baseModel.parameters,
        version,
        parentModel: baseModelId
      }
    };

    await this.loadModel(newModel, modelData);

    // Track version
    if (!this.modelVersions.has(baseModelId)) {
      this.modelVersions.set(baseModelId, []);
    }

    const versionMeta: ModelVersion = {
      version,
      modelId: newModel.id,
      accuracy: 0.85, // Would be determined during training
      latency: 0,
      createdAt: Date.now(),
      isActive: false
    };

    this.modelVersions.get(baseModelId)!.push(versionMeta);

    logger.info('Model version created', { baseModelId, version, newModelId: newModel.id });
    return newModel.id;
  }

  /**
   * Activate a model version (for A/B testing or updates)
   */
  async activateVersion(baseModelId: string, version: string, trafficSplit: number = 100): Promise<void> {
    const versions = this.modelVersions.get(baseModelId);
    if (!versions) {
      throw new Error(`No versions found for model ${baseModelId}`);
    }

    const versionMeta = versions.find(v => v.version === version);
    if (!versionMeta) {
      throw new Error(`Version ${version} not found for model ${baseModelId}`);
    }

    // Deactivate other versions
    versions.forEach(v => {
      v.isActive = false;
      v.trafficSplit = 0;
    });

    // Activate this version
    versionMeta.isActive = true;
    versionMeta.trafficSplit = trafficSplit;
    this.activeVersions.set(baseModelId, versionMeta.modelId);

    logger.info('Model version activated', { baseModelId, version, trafficSplit });
  }

  /**
   * Real-time inference with batching and caching
   */
  async runInferenceRealTime(
    modelId: string,
    input: number[][],
    useCache: boolean = true
  ): Promise<InferenceResult[]> {
    const startTime = Date.now();

    // Check cache if enabled
    if (this.pipelineConfig.cacheEnabled && useCache) {
      const cacheKey = this.getCacheKey(modelId, input);
      const cached = this.inferenceCache.get(cacheKey);
      if (cached && Date.now() - cached.timestamp < (this.pipelineConfig.cacheTTL || 60000)) {
        logger.debug('Cache hit for inference', { modelId, inputSize: input.length });
        return Array.isArray(cached.result) ? cached.result : [cached.result];
      }
    }

    // Get active version if versioning is used
    const activeVersionId = this.activeVersions.get(modelId) || modelId;

    // Run inference
    const result = await this.runInferenceWithRetry(activeVersionId, input);

    // Cache result
    if (this.pipelineConfig.cacheEnabled && useCache) {
      const cacheKey = this.getCacheKey(modelId, input);
      this.inferenceCache.set(cacheKey, {
        result: Array.isArray(result) ? result[0] : result,
        timestamp: Date.now()
      });
    }

    // Update metrics for auto-scaling
    const latency = Date.now() - startTime;
    this.updateRequestMetrics(latency);

    // Check if auto-scaling is needed
    if (this.autoScaling.enabled) {
      this.checkAutoScaling();
    }

    return Array.isArray(result) ? result : [result];
  }

  /**
   * Run inference with retries
   */
  private async runInferenceWithRetry(
    modelId: string,
    input: number[][]
  ): Promise<InferenceResult | InferenceResult[]> {
    const retries = this.pipelineConfig.retries || 2;
    let lastError: Error | null = null;

    for (let attempt = 0; attempt <= retries; attempt++) {
      try {
        return await (this as any).runInference(modelId, input);
      } catch (error) {
        lastError = error as Error;
        if (attempt < retries) {
          logger.warn('Inference failed, retrying', { modelId, attempt: attempt + 1 }, lastError);
          await new Promise(resolve => setTimeout(resolve, 100 * (attempt + 1))); // Exponential backoff
        }
      }
    }

    throw lastError || new Error('Inference failed after retries');
  }

  /**
   * Batch inference processing
   */
  async runBatchInference(
    modelId: string,
    batch: number[][][],
    batchSize?: number
  ): Promise<InferenceResult[][]> {
    const size = batchSize || this.pipelineConfig.batchSize || 10;
    const results: InferenceResult[][] = [];

    // Process in batches
    for (let i = 0; i < batch.length; i += size) {
      const batchChunk = batch.slice(i, i + size);
      
      // Process batch chunk in parallel
      const chunkResults = await Promise.all(
        batchChunk.map(input => this.runInferenceRealTime(modelId, input))
      );

      results.push(...chunkResults);
    }

    return results;
  }

  /**
   * Configure inference pipeline
   */
  configurePipeline(config: Partial<InferencePipelineConfig>): void {
    this.pipelineConfig = { ...this.pipelineConfig, ...config };
    logger.info('Inference pipeline configured', { config: this.pipelineConfig });
  }

  /**
   * Configure auto-scaling
   */
  configureAutoScaling(config: Partial<AutoScalingConfig>): void {
    this.autoScaling = { ...this.autoScaling, ...config };
    logger.info('Auto-scaling configured', { config: this.autoScaling });
  }

  /**
   * Get model version history
   */
  getVersionHistory(modelId: string): ModelVersion[] {
    return this.modelVersions.get(modelId) || [];
  }

  /**
   * Get current auto-scaling status
   */
  getAutoScalingStatus(): {
    enabled: boolean;
    currentInstances: number;
    targetInstances: number;
    metrics: { rps: number; avgLatency: number };
  } {
    const metrics = this.getRequestMetrics();
    const targetInstances = this.calculateTargetInstances(metrics);

    return {
      enabled: this.autoScaling.enabled,
      currentInstances: this.currentInstances,
      targetInstances,
      metrics: {
        rps: metrics.rps,
        avgLatency: metrics.avgLatency
      }
    };
  }

  /**
   * Clear inference cache
   */
  clearCache(): void {
    this.inferenceCache.clear();
    logger.info('Inference cache cleared');
  }

  // Private helper methods

  private getCacheKey(modelId: string, input: number[][]): string {
    return `${modelId}_${JSON.stringify(input)}`;
  }

  private updateRequestMetrics(latency: number): void {
    const now = Date.now();
    const window = 60000; // 1 minute window

    // Reset metrics if window has passed
    if (now - this.requestMetrics.lastReset > window) {
      this.requestMetrics.count = 0;
      this.requestMetrics.totalLatency = 0;
      this.requestMetrics.lastReset = now;
    }

    this.requestMetrics.count++;
    this.requestMetrics.totalLatency += latency;
  }

  private getRequestMetrics(): { rps: number; avgLatency: number } {
    const window = 60000; // 1 minute
    const elapsed = Date.now() - this.requestMetrics.lastReset;
    const windowFraction = Math.min(elapsed / window, 1);

    const rps = windowFraction > 0 ? (this.requestMetrics.count / windowFraction) * (60000 / elapsed) : 0;
    const avgLatency = this.requestMetrics.count > 0
      ? this.requestMetrics.totalLatency / this.requestMetrics.count
      : 0;

    return { rps, avgLatency };
  }

  private calculateTargetInstances(metrics: { rps: number; avgLatency: number }): number {
    if (!this.autoScaling.enabled) {
      return this.currentInstances;
    }

    let target = this.currentInstances;

    // Scale up if high load or latency
    if (metrics.rps > this.autoScaling.scaleUpThreshold ||
        metrics.avgLatency > this.autoScaling.targetLatency) {
      target = Math.min(
        this.currentInstances + 1,
        this.autoScaling.maxInstances
      );
    }

    // Scale down if low load and good latency
    if (metrics.rps < this.autoScaling.scaleDownThreshold &&
        metrics.avgLatency < this.autoScaling.targetLatency * 0.5) {
      target = Math.max(
        this.currentInstances - 1,
        this.autoScaling.minInstances
      );
    }

    return target;
  }

  private checkAutoScaling(): void {
    const metrics = this.getRequestMetrics();
    const targetInstances = this.calculateTargetInstances(metrics);

    if (targetInstances !== this.currentInstances) {
      logger.info('Auto-scaling triggered', {
        from: this.currentInstances,
        to: targetInstances,
        rps: metrics.rps,
        avgLatency: metrics.avgLatency
      });

      // In a real implementation, this would scale the actual inference instances
      this.currentInstances = targetInstances;
    }
  }
}

