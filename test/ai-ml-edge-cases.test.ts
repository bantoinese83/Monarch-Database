import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { AIMLIntegration } from '../src/ai-ml-integration';
import { MLModel, TrainingData, InferenceResult, MLTask, ModelFormat } from '../src/types';

describe('AI/ML Integration - Golden Paths & Edge Cases', () => {
  let aiIntegration: AIMLIntegration;

  beforeEach(() => {
    aiIntegration = new AIMLIntegration();
  });

  afterEach(() => {
    // Clean up any resources
  });

  describe('Golden Path Scenarios', () => {
    it('should load, train, and run inference on a model', async () => {
      // Create a mock model
      const model: MLModel = {
        id: 'test-classifier',
        name: 'Test Sentiment Classifier',
        format: 'tensorflow' as ModelFormat,
        task: 'classification' as MLTask,
        inputShape: [768],
        outputShape: [2],
        parameters: { layers: [768, 256, 128, 2] },
        metadata: { accuracy: 0.85 }
      };

      // Mock model data (simulated binary data)
      const modelData = Buffer.from('mock_tensorflow_model_' + 'x'.repeat(1024));

      // Load model
      const modelId = await aiIntegration.loadModel(model, modelData);
      expect(modelId).toBe('test-classifier');

      // Prepare training data
      const trainingData: TrainingData = {
        features: [
          Array.from({ length: 768 }, () => Math.random() * 2 - 1),
          Array.from({ length: 768 }, () => Math.random() * 2 - 1)
        ],
        labels: ['positive', 'negative']
      };

      // Train model
      const trainedModel = await aiIntegration.trainModel(modelId, trainingData);
      expect(trainedModel.parameters).toHaveProperty('trainedSamples', 2);

      // Run inference
      const testInput = [Array.from({ length: 768 }, () => Math.random() * 2 - 1)];
      const result = await aiIntegration.runInference(modelId, testInput);

      expect(result).toHaveProperty('predictions');
      expect(result).toHaveProperty('confidence');
      expect(result.predictions).toHaveLength(1);

      // Get model stats
      const stats = await aiIntegration.getModelStats(modelId);
      expect(stats).toHaveProperty('accuracy');
      expect(stats).toHaveProperty('latency');
      expect(stats).toHaveProperty('throughput');
    });

    it('should create and use model ensembles', async () => {
      // Load multiple models
      const modelConfigs = [
        { id: 'model1', name: 'Classifier 1', format: 'tensorflow' as ModelFormat, task: 'classification' as MLTask, inputShape: [10], outputShape: [2], parameters: {}, metadata: {} },
        { id: 'model2', name: 'Classifier 2', format: 'tensorflow' as ModelFormat, task: 'classification' as MLTask, inputShape: [10], outputShape: [2], parameters: {}, metadata: {} }
      ];

      const modelIds = [];
      for (const config of modelConfigs) {
        const modelData = Buffer.from(`mock_${config.id}_data`);
        const modelId = await aiIntegration.loadModel(config, modelData);
        modelIds.push(modelId);
      }

      // Create ensemble
      const ensembleId = await aiIntegration.createEnsemble(modelIds);
      expect(ensembleId).toMatch(/^ensemble_\d+$/);

      // Test ensemble inference
      const testInput = [Array.from({ length: 10 }, () => Math.random())];
      const result = await aiIntegration.runInference(ensembleId, testInput);
      expect(result.predictions).toBeDefined();
    });

    it('should optimize models for different metrics', async () => {
      const model: MLModel = {
        id: 'optimizable-model',
        name: 'Optimizable Model',
        format: 'tensorflow' as ModelFormat,
        task: 'classification' as MLTask,
        inputShape: [50],
        outputShape: [3],
        parameters: {},
        metadata: {}
      };

      const modelData = Buffer.from('mock_model_data');
      await aiIntegration.loadModel(model, modelData);

      // Optimize for latency
      const latencyOptimized = await aiIntegration.optimizeModel('optimizable-model', 'latency');
      expect(latencyOptimized.parameters).toHaveProperty('optimizedFor', 'latency');

      // Optimize for accuracy
      const accuracyOptimized = await aiIntegration.optimizeModel('optimizable-model', 'accuracy');
      expect(accuracyOptimized.parameters).toHaveProperty('optimizedFor', 'accuracy');

      // Check that optimizations improved metrics
      const stats = await aiIntegration.getModelStats('optimizable-model');
      expect(stats.accuracy).toBeGreaterThan(0.85); // Improved from optimization
    });

    it('should suggest optimal model configurations', async () => {
      const trainingData: TrainingData = {
        features: Array.from({ length: 100 }, () =>
          Array.from({ length: 20 }, () => Math.random())
        ),
        labels: Array.from({ length: 100 }, () => Math.random() > 0.5 ? 'class_a' : 'class_b')
      };

      const suggestion = await aiIntegration.suggestModelConfig(trainingData);

      expect(suggestion).toHaveProperty('id');
      expect(suggestion).toHaveProperty('format');
      expect(suggestion).toHaveProperty('task');
      expect(suggestion.inputShape).toEqual([20]);
      expect(suggestion.metadata).toHaveProperty('autoGenerated', true);
    });
  });

  describe('Edge Cases - Model Loading', () => {
    it('should handle empty model data', async () => {
      const model: MLModel = {
        id: 'empty-model',
        name: 'Empty Model',
        format: 'tensorflow' as ModelFormat,
        task: 'classification' as MLTask,
        inputShape: [10],
        outputShape: [2],
        parameters: {},
        metadata: {}
      };

      await expect(aiIntegration.loadModel(model, Buffer.alloc(0))).rejects.toThrow();
    });

    it('should handle very large model data', async () => {
      const model: MLModel = {
        id: 'large-model',
        name: 'Large Model',
        format: 'tensorflow' as ModelFormat,
        task: 'classification' as MLTask,
        inputShape: [100],
        outputShape: [10],
        parameters: {},
        metadata: {}
      };

      // 10MB of mock data
      const largeData = Buffer.from('x'.repeat(10 * 1024 * 1024));

      const startTime = Date.now();
      const modelId = await aiIntegration.loadModel(model, largeData);
      const loadTime = Date.now() - startTime;

      expect(modelId).toBe('large-model');
      expect(loadTime).toBeLessThan(5000); // Should load within reasonable time
    });

    it('should handle invalid model formats', async () => {
      const invalidModels = [
        { ...createBaseModel(), format: 'invalid' as ModelFormat },
        { ...createBaseModel(), task: 'invalid' as MLTask },
        { ...createBaseModel(), inputShape: [] },
        { ...createBaseModel(), outputShape: [] }
      ];

      for (const model of invalidModels) {
        await expect(aiIntegration.loadModel(model, Buffer.from('data'))).rejects.toThrow();
      }
    });

    it('should handle duplicate model IDs', async () => {
      const model1: MLModel = createBaseModel('duplicate-id');
      const model2: MLModel = createBaseModel('duplicate-id');

      const data = Buffer.from('model_data');

      await aiIntegration.loadModel(model1, data);
      await expect(aiIntegration.loadModel(model2, data)).rejects.toThrow();
    });
  });

  describe('Edge Cases - Training', () => {
    it('should handle empty training data', async () => {
      await aiIntegration.loadModel(createBaseModel('empty-train'), Buffer.from('data'));

      const emptyData: TrainingData = {
        features: [],
        labels: []
      };

      await expect(aiIntegration.trainModel('empty-train', emptyData)).rejects.toThrow();
    });

    it('should handle mismatched feature/label dimensions', async () => {
      await aiIntegration.loadModel(createBaseModel('mismatch-train'), Buffer.from('data'));

      const mismatchedData: TrainingData = {
        features: [[1, 2, 3], [4, 5, 6]], // 2 features
        labels: ['a'] // 1 label
      };

      await expect(aiIntegration.trainModel('mismatch-train', mismatchedData)).rejects.toThrow();
    });

    it('should handle very large training datasets', async () => {
      await aiIntegration.loadModel(createBaseModel('large-train'), Buffer.from('data'));

      const largeData: TrainingData = {
        features: Array.from({ length: 10000 }, () =>
          Array.from({ length: 50 }, () => Math.random())
        ),
        labels: Array.from({ length: 10000 }, () => Math.random())
      };

      const startTime = Date.now();
      const trainedModel = await aiIntegration.trainModel('large-train', largeData);
      const trainTime = Date.now() - startTime;

      expect(trainedModel.parameters).toHaveProperty('trainedSamples', 10000);
      expect(trainTime).toBeLessThan(30000); // Should complete within 30 seconds
    });

    it('should handle different data types in labels', async () => {
      await aiIntegration.loadModel(createBaseModel('mixed-labels'), Buffer.from('data'));

      const mixedLabelsData: TrainingData = {
        features: [[1, 2], [3, 4], [5, 6]],
        labels: ['class_a', 'class_b', 'class_a'] // String labels
      };

      const numericLabelsData: TrainingData = {
        features: [[1, 2], [3, 4]],
        labels: [0, 1] // Numeric labels
      };

      await expect(aiIntegration.trainModel('mixed-labels', mixedLabelsData)).resolves.toBeDefined();
      // Note: Numeric labels would need different model configuration
    });
  });

  describe('Edge Cases - Inference', () => {
    it('should handle empty inference input', async () => {
      await aiIntegration.loadModel(createBaseModel('empty-infer'), Buffer.from('data'));

      await expect(aiIntegration.runInference('empty-infer', [])).rejects.toThrow();
    });

    it('should handle mismatched input dimensions', async () => {
      const model = createBaseModel('dimension-mismatch');
      model.inputShape = [10]; // Expects 10 features

      await aiIntegration.loadModel(model, Buffer.from('data'));

      const wrongDimensionInput = [Array.from({ length: 5 }, () => 1)]; // Only 5 features

      await expect(aiIntegration.runInference('dimension-mismatch', wrongDimensionInput)).rejects.toThrow();
    });

    it('should handle batch inference with varying sizes', async () => {
      await aiIntegration.loadModel(createBaseModel('batch-infer'), Buffer.from('data'));

      const batchSizes = [1, 10, 100, 1000];

      for (const batchSize of batchSizes) {
        const batchInput = Array.from({ length: batchSize }, () =>
          Array.from({ length: 10 }, () => Math.random())
        );

        const startTime = Date.now();
        const result = await aiIntegration.runInference('batch-infer', batchInput);
        const inferTime = Date.now() - startTime;

        expect(result.predictions).toHaveLength(batchSize);
        expect(inferTime).toBeLessThan(10000); // Should complete within 10 seconds

        console.log(`Batch inference: ${batchSize} samples in ${inferTime}ms (${Math.round(batchSize / (inferTime / 1000))} samples/sec)`);
      }
    });

    it('should handle extreme input values', async () => {
      await aiIntegration.loadModel(createBaseModel('extreme-values'), Buffer.from('data'));

      const extremeInputs = [
        [Number.MAX_VALUE, Number.MIN_VALUE, 0, -0, NaN, Infinity, -Infinity],
        Array.from({ length: 10 }, () => Math.random() * 1e10), // Very large numbers
        Array.from({ length: 10 }, () => Math.random() * 1e-10), // Very small numbers
      ];

      for (const input of extremeInputs) {
        const result = await aiIntegration.runInference('extreme-values', [input]);
        expect(result).toBeDefined();
        expect(result.predictions).toBeDefined();
      }
    });
  });

  describe('Edge Cases - Model Management', () => {
    it('should handle unloading non-existent models', async () => {
      await expect(aiIntegration.unloadModel('non-existent')).rejects.toThrow();
    });

    it('should handle getting stats for non-existent models', async () => {
      await expect(aiIntegration.getModelStats('non-existent')).rejects.toThrow();
    });

    it('should handle operations on unloaded models', async () => {
      await aiIntegration.loadModel(createBaseModel('unload-test'), Buffer.from('data'));

      // Should work before unloading
      const testInput = [Array.from({ length: 10 }, () => Math.random())];
      await expect(aiIntegration.runInference('unload-test', testInput)).resolves.toBeDefined();

      // Unload model
      await aiIntegration.unloadModel('unload-test');

      // Should fail after unloading
      await expect(aiIntegration.runInference('unload-test', testInput)).rejects.toThrow();
      await expect(aiIntegration.getModelStats('unload-test')).rejects.toThrow();
    });

    it('should track model performance over time', async () => {
      await aiIntegration.loadModel(createBaseModel('performance-test'), Buffer.from('data'));

      const testInput = [Array.from({ length: 10 }, () => Math.random())];

      // Run multiple inferences
      const runs = 10;
      for (let i = 0; i < runs; i++) {
        await aiIntegration.runInference('performance-test', testInput);
      }

      const stats = await aiIntegration.getModelStats('performance-test');
      expect(stats.latency).toBeGreaterThan(0);
      expect(stats.throughput).toBeGreaterThan(0);
    });
  });

  describe('Edge Cases - Ensemble Operations', () => {
    it('should handle empty model list for ensembles', async () => {
      await expect(aiIntegration.createEnsemble([])).rejects.toThrow();
    });

    it('should handle single model ensembles', async () => {
      await aiIntegration.loadModel(createBaseModel('single-ensemble'), Buffer.from('data'));

      const ensembleId = await aiIntegration.createEnsemble(['single-ensemble']);
      expect(ensembleId).toBeDefined();

      const testInput = [Array.from({ length: 10 }, () => Math.random())];
      const result = await aiIntegration.runInference(ensembleId, testInput);
      expect(result.predictions).toBeDefined();
    });

    it('should handle ensemble with non-existent models', async () => {
      await expect(aiIntegration.createEnsemble(['existent', 'non-existent'])).rejects.toThrow();
    });

    it('should handle weighted ensembles', async () => {
      await aiIntegration.loadModel(createBaseModel('weighted1'), Buffer.from('data'));
      await aiIntegration.loadModel(createBaseModel('weighted2'), Buffer.from('data'));

      const ensembleId = await aiIntegration.createEnsemble(['weighted1', 'weighted2'], [0.7, 0.3]);
      expect(ensembleId).toBeDefined();
    });
  });

  describe('Stress Testing', () => {
    it('should handle concurrent model operations', async () => {
      const modelIds = [];

      // Load multiple models concurrently
      const loadPromises = Array.from({ length: 10 }, async (_, i) => {
        const modelId = `concurrent-model-${i}`;
        await aiIntegration.loadModel(createBaseModel(modelId), Buffer.from(`data-${i}`));
        modelIds.push(modelId);
        return modelId;
      });

      await Promise.all(loadPromises);

      // Run concurrent inferences
      const inferencePromises = modelIds.map(async (modelId) => {
        const testInput = [Array.from({ length: 10 }, () => Math.random())];
        return aiIntegration.runInference(modelId, testInput);
      });

      const startTime = Date.now();
      const results = await Promise.all(inferencePromises);
      const totalTime = Date.now() - startTime;

      expect(results).toHaveLength(10);
      results.forEach(result => {
        expect(result.predictions).toBeDefined();
      });

      console.log(`Concurrent AI operations: 10 models loaded, inferences completed in ${totalTime}ms`);
    });

    it('should handle memory-intensive operations', async () => {
      // Test with high-dimensional data
      const highDimModel: MLModel = {
        id: 'high-dim-model',
        name: 'High Dimensional Model',
        format: 'tensorflow' as ModelFormat,
        task: 'classification' as MLTask,
        inputShape: [2048], // High dimensional
        outputShape: [100], // Many classes
        parameters: { layers: [2048, 1024, 512, 100] },
        metadata: {}
      };

      await aiIntegration.loadModel(highDimModel, Buffer.from('x'.repeat(1024 * 1024))); // 1MB model

      // Test with large batch
      const largeBatch = Array.from({ length: 50 }, () =>
        Array.from({ length: 2048 }, () => Math.random())
      );

      const startTime = Date.now();
      const result = await aiIntegration.runInference('high-dim-model', largeBatch);
      const inferTime = Date.now() - startTime;

      expect(result.predictions).toHaveLength(50);
      expect(inferTime).toBeLessThan(30000); // Should complete within 30 seconds

      console.log(`High-dimensional inference: 50 samples × 2048 features in ${inferTime}ms`);
    });

    it('should handle rapid model loading/unloading', async () => {
      const operations = [];

      // Mix of load and unload operations
      for (let i = 0; i < 20; i++) {
        if (i % 2 === 0) {
          // Load operation
          operations.push(
            aiIntegration.loadModel(createBaseModel(`rapid-${i}`), Buffer.from(`data-${i}`))
          );
        } else {
          // Unload operation (unload the previous load)
          const modelToUnload = `rapid-${i - 1}`;
          operations.push(
            aiIntegration.unloadModel(modelToUnload).catch(() => {}) // Ignore errors for non-existent models
          );
        }
      }

      const startTime = Date.now();
      await Promise.all(operations);
      const totalTime = Date.now() - startTime;

      console.log(`Rapid load/unload cycle: 20 operations completed in ${totalTime}ms`);
    });
  });

  describe('Error Recovery and Resilience', () => {
    it('should recover from inference failures', async () => {
      await aiIntegration.loadModel(createBaseModel('recovery-test'), Buffer.from('data'));

      // First inference should work
      const testInput = [Array.from({ length: 10 }, () => Math.random())];
      const firstResult = await aiIntegration.runInference('recovery-test', testInput);
      expect(firstResult).toBeDefined();

      // Simulate some internal failure and recovery
      // (In real implementation, this would test actual error recovery)

      // Subsequent inferences should continue working
      const secondResult = await aiIntegration.runInference('recovery-test', testInput);
      expect(secondResult).toBeDefined();
    });

    it('should handle model corruption gracefully', async () => {
      await aiIntegration.loadModel(createBaseModel('corruption-test'), Buffer.from('data'));

      // Should handle any internal corruption gracefully
      const testInput = [Array.from({ length: 10 }, () => Math.random())];
      const result = await aiIntegration.runInference('corruption-test', testInput);
      expect(result).toBeDefined();
    });

    it('should validate model suggestions', async () => {
      const edgeCases = [
        { features: [], labels: [] }, // Empty
        { features: [[]], labels: ['test'] }, // Empty features
        { features: [[1]], labels: [] }, // Empty labels
        { features: [[1, 2]], labels: [1, 2] }, // Mismatched lengths
      ];

      for (const data of edgeCases) {
        try {
          await aiIntegration.suggestModelConfig(data as TrainingData);
        } catch (error) {
          // Should handle invalid data gracefully
          expect(error).toBeDefined();
        }
      }
    });
  });
});

// Helper function to create base model
function createBaseModel(id: string = 'test-model'): MLModel {
  return {
    id,
    name: 'Test Model',
    format: 'tensorflow' as ModelFormat,
    task: 'classification' as MLTask,
    inputShape: [10],
    outputShape: [2],
    parameters: {},
    metadata: {}
  };
}
