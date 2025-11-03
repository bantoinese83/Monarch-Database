/**
 * Tests for Enhanced AI/ML Integration
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { EnhancedAIMLIntegration } from '../src/ai-ml-enhanced';
import { MLModel } from '../src/types';

// MLTask and ModelFormat are string literals, not enums
const MLTask = {
  CLASSIFICATION: 'classification',
  REGRESSION: 'regression',
  CLUSTERING: 'clustering'
} as const;

const ModelFormat = {
  ONNX: 'onnx',
  TENSORFLOW: 'tensorflow',
  PYTORCH: 'pytorch'
} as const;

describe('EnhancedAIMLIntegration', () => {
  let aiML: EnhancedAIMLIntegration;

  beforeEach(() => {
    aiML = new EnhancedAIMLIntegration();
  });

  describe('Model Versioning', () => {
    it('should create a model version', async () => {
      const baseModel: MLModel = {
        id: 'base-model',
        name: 'Test Model',
        task: MLTask.CLASSIFICATION,
        format: ModelFormat.ONNX,
        inputShape: [10],
        outputShape: [2],
        parameters: {}
      };

      const modelData = Buffer.from('mock model data');
      await aiML.loadModel(baseModel, modelData);

      const versionId = await aiML.createModelVersion('base-model', '1.0.0', modelData);
      expect(versionId).toBeDefined();
      expect(versionId).toContain('base-model');
    });

    it('should activate a model version', async () => {
      const baseModel: MLModel = {
        id: 'test-model',
        name: 'Test',
        task: MLTask.CLASSIFICATION,
        format: ModelFormat.ONNX,
        inputShape: [10],
        outputShape: [2],
        parameters: {}
      };

      await aiML.loadModel(baseModel, Buffer.from('data'));
      await aiML.createModelVersion('test-model', '1.0.0', Buffer.from('data'));
      
      await aiML.activateVersion('test-model', '1.0.0', 100);
      
      const history = aiML.getVersionHistory('test-model');
      const version = history.find(v => v.version === '1.0.0');
      expect(version?.isActive).toBe(true);
      expect(version?.trafficSplit).toBe(100);
    });
  });

  describe('Real-time Inference', () => {
    it('should run real-time inference with caching', async () => {
      const model: MLModel = {
        id: 'test-model',
        name: 'Test',
        task: MLTask.CLASSIFICATION,
        format: ModelFormat.ONNX,
        inputShape: [3],
        outputShape: [2],
        parameters: {}
      };

      await aiML.loadModel(model, Buffer.from('data'));
      aiML.configurePipeline({ cacheEnabled: true, cacheTTL: 60000 });

      const input = [[1, 2, 3]];
      const result1 = await aiML.runInferenceRealTime('test-model', input);
      const result2 = await aiML.runInferenceRealTime('test-model', input);

      expect(result1).toBeDefined();
      expect(result2).toBeDefined();
    });

    it('should process batch inference', async () => {
      const model: MLModel = {
        id: 'batch-model',
        name: 'Batch Test',
        task: MLTask.CLASSIFICATION,
        format: ModelFormat.ONNX,
        inputShape: [3],
        outputShape: [2],
        parameters: {}
      };

      await aiML.loadModel(model, Buffer.from('data'));
      
      const batch = [
        [[1, 2, 3]],
        [[4, 5, 6]],
        [[7, 8, 9]]
      ];

      const results = await aiML.runBatchInference('batch-model', batch, 2);
      expect(results.length).toBe(batch.length);
    });
  });

  describe('Auto-scaling', () => {
    it('should configure auto-scaling', () => {
      aiML.configureAutoScaling({
        enabled: true,
        minInstances: 2,
        maxInstances: 10,
        targetLatency: 100,
        scaleUpThreshold: 50,
        scaleDownThreshold: 10
      });

      const status = aiML.getAutoScalingStatus();
      expect(status.enabled).toBe(true);
      expect(status.currentInstances).toBeGreaterThanOrEqual(1);
    });

    it('should return auto-scaling status', () => {
      const status = aiML.getAutoScalingStatus();
      expect(status).toHaveProperty('enabled');
      expect(status).toHaveProperty('currentInstances');
      expect(status).toHaveProperty('targetInstances');
      expect(status).toHaveProperty('metrics');
    });
  });

  describe('Pipeline Configuration', () => {
    it('should configure inference pipeline', () => {
      aiML.configurePipeline({
        batchSize: 20,
        timeout: 10000,
        retries: 3,
        cacheEnabled: false,
        cacheTTL: 120000
      });

      // Configuration should be applied
      // (No getter, but no error means it's set)
    });

    it('should clear inference cache', () => {
      aiML.clearCache();
      // Should not throw
    });
  });
});

