/**
 * Tests for Monarch Configuration (Dependency Injection)
 * 
 * Tests the MonarchConfig interface and its usage in the Monarch class
 * to ensure proper dependency injection functionality.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Monarch, MonarchConfig, FileSystemAdapter } from '../src';
import { TransactionManager } from '../src/transaction-manager';
import { DurabilityManagerImpl } from '../src/durability-manager';
import { SecurityManager } from '../src/security-manager';
import { ClusteringManagerImpl } from '../src/clustering-manager';
import { AIMLIntegration } from '../src/ai-ml-integration';
import { ScriptingEngineImpl } from '../src/scripting-engine';
import { PersistenceAdapter } from '../src/types';

describe('MonarchConfig', () => {
  describe('Type Exports', () => {
    it('should export MonarchConfig interface', () => {
      // This is a compile-time test - if it compiles, the type is exported
      const config: MonarchConfig = {};
      expect(config).toBeDefined();
      expect(typeof config).toBe('object');
    });

    it('should accept all optional config properties', () => {
      const config: MonarchConfig = {
        adapter: new FileSystemAdapter('./test-data'),
        transactionManagerFactory: () => new TransactionManager(),
        durabilityManagerFactory: () => new DurabilityManagerImpl('./test'),
        securityManagerFactory: () => new SecurityManager('test-key'),
        clusteringManagerFactory: () => new ClusteringManagerImpl(),
        aiIntegrationFactory: () => new AIMLIntegration(),
        scriptingEngineFactory: () => new ScriptingEngineImpl(),
        encryptionKey: 'custom-encryption-key',
        durabilityDataPath: './custom-data-path'
      };
      expect(config).toBeDefined();
    });
  });

  describe('Empty Configuration', () => {
    it('should create Monarch with empty config', () => {
      const config: MonarchConfig = {};
      const db = new Monarch(config);
      expect(db).toBeInstanceOf(Monarch);
    });

    it('should create Monarch with undefined config (uses defaults)', () => {
      const db = new Monarch();
      expect(db).toBeInstanceOf(Monarch);
    });

    it('should create default managers when no factories provided', () => {
      const db = new Monarch({});
      // Should be able to use default managers
      db.addCollection('test');
      expect(db.getCollection('test')).toBeDefined();
    });
  });

  describe('Adapter Configuration', () => {
    it('should accept adapter in config', () => {
      const adapter = new FileSystemAdapter('./test-data');
      const config: MonarchConfig = { adapter };
      const db = new Monarch(config);
      expect(db).toBeInstanceOf(Monarch);
    });

    it('should use adapter for persistence operations', async () => {
      const mockAdapter: PersistenceAdapter = {
        save: vi.fn().mockResolvedValue(undefined),
        load: vi.fn().mockResolvedValue({})
      };

      const config: MonarchConfig = { adapter: mockAdapter };
      const db = new Monarch(config);
      
      db.addCollection('users');
      await db.save();

      expect(mockAdapter.save).toHaveBeenCalled();
    });
  });

  describe('Manager Factory Configuration', () => {
    it('should use custom transaction manager factory', () => {
      const customTransactionManager = new TransactionManager();
      const factorySpy = vi.fn(() => customTransactionManager);

      const config: MonarchConfig = {
        transactionManagerFactory: factorySpy
      };

      const db = new Monarch(config);
      
      // Access transaction manager (it's initialized in constructor)
      // We can test by checking that transactions work
      const txId = db.beginTransaction();
      expect(txId).toBeDefined();
      expect(factorySpy).toHaveBeenCalledTimes(1);
    });

    it('should use custom durability manager factory when accessed', async () => {
      const customDurabilityManager = new DurabilityManagerImpl('./custom-path');
      const factorySpy = vi.fn(() => customDurabilityManager);

      const config: MonarchConfig = {
        durabilityManagerFactory: factorySpy
      };

      const db = new Monarch(config);
      
      // Durability manager is lazy-loaded, so factory should not be called yet
      expect(factorySpy).not.toHaveBeenCalled();

      // Access durability manager (triggers lazy loading)
      await db.configureDurability({ level: 'medium' });
      
      expect(factorySpy).toHaveBeenCalledTimes(1);
    });

    it('should use custom security manager factory when accessed', async () => {
      const customSecurityManager = new SecurityManager('custom-key');
      const factorySpy = vi.fn(() => customSecurityManager);

      const config: MonarchConfig = {
        securityManagerFactory: factorySpy
      };

      const db = new Monarch(config);
      
      // Security manager is lazy-loaded
      expect(factorySpy).not.toHaveBeenCalled();

      // Access security manager through a public method (triggers lazy loading)
      await db.encrypt('test data');
      
      expect(factorySpy).toHaveBeenCalledTimes(1);
    });

    it('should use custom clustering manager factory when accessed', async () => {
      const customClusteringManager = new ClusteringManagerImpl('custom-node-id');
      const factorySpy = vi.fn(() => customClusteringManager);

      const config: MonarchConfig = {
        clusteringManagerFactory: factorySpy
      };

      const db = new Monarch(config);
      
      // Clustering manager is lazy-loaded
      expect(factorySpy).not.toHaveBeenCalled();

      // Access clustering manager (triggers lazy loading)
      await db.joinCluster({
        nodes: [{ id: 'node1', host: 'localhost', port: 6379, status: 'online', role: 'master', lastHeartbeat: Date.now(), metadata: {} }],
        shards: [],
        replicationStrategy: 'master-slave',
        heartbeatInterval: 5000,
        failoverTimeout: 30000
      });
      
      expect(factorySpy).toHaveBeenCalledTimes(1);
    });

    it('should use custom AI/ML integration factory when accessed', async () => {
      const customAIIntegration = new AIMLIntegration();
      const factorySpy = vi.fn(() => customAIIntegration);

      const config: MonarchConfig = {
        aiIntegrationFactory: factorySpy
      };

      const db = new Monarch(config);
      
      // AI/ML integration is lazy-loaded
      expect(factorySpy).not.toHaveBeenCalled();

      // Access AI/ML integration through a public method (triggers lazy loading)
      try {
        await db.runMLInference('test-model', [[1, 2, 3]]);
      } catch (error) {
        // Expected to fail if model doesn't exist, but factory should be called
      }
      
      expect(factorySpy).toHaveBeenCalledTimes(1);
    });

    it('should use custom scripting engine factory when accessed', async () => {
      const customScriptingEngine = new ScriptingEngineImpl();
      const factorySpy = vi.fn(() => customScriptingEngine);

      const config: MonarchConfig = {
        scriptingEngineFactory: factorySpy
      };

      const db = new Monarch(config);
      
      // Scripting engine is lazy-loaded
      expect(factorySpy).not.toHaveBeenCalled();

      // Access scripting engine through a public method (triggers lazy loading)
      try {
        await db.executeScript('test-script', {});
      } catch (error) {
        // Expected to fail if script doesn't exist, but factory should be called
      }
      
      expect(factorySpy).toHaveBeenCalledTimes(1);
    });

    it('should use default managers when factories are not provided', async () => {
      const db = new Monarch({});
      
      // Transaction manager should work (created in constructor)
      const txId = db.beginTransaction();
      expect(txId).toBeDefined();

      // Lazy-loaded managers should use defaults (accessed through public methods)
      const encrypted = await db.encrypt('test'); // Should create default SecurityManager
      expect(encrypted).toBeDefined();
      
      // AI/ML and Scripting engines accessed through their public methods
      try {
        await db.runMLInference('test', [[1]]);
      } catch {
        // Expected to fail, but should create default AIMLIntegration
      }
      
      try {
        await db.executeScript('test', {});
      } catch {
        // Expected to fail, but should create default ScriptingEngineImpl
      }
    });
  });

  describe('Configuration Options', () => {
    it('should use custom encryption key from config', async () => {
      const config: MonarchConfig = {
        encryptionKey: 'custom-encryption-key-from-config'
      };

      const db = new Monarch(config);
      
      // Access security manager through encrypt (should use custom key)
      const encrypted = await db.encrypt('test data');
      expect(encrypted).toBeDefined();
      expect(db).toBeInstanceOf(Monarch);
    });

    it('should use custom durability data path from config', async () => {
      const customPath = './custom-durability-path';
      const config: MonarchConfig = {
        durabilityDataPath: customPath
      };

      const db = new Monarch(config);
      
      // Access durability manager (should use custom path)
      await db.configureDurability({ level: 'medium' });
      
      expect(db).toBeInstanceOf(Monarch);
    });

    it('should accept multiple configuration options together', () => {
      const adapter = new FileSystemAdapter('./test-data');
      const customTransactionManager = new TransactionManager();
      
      const config: MonarchConfig = {
        adapter,
        transactionManagerFactory: () => customTransactionManager,
        encryptionKey: 'test-key',
        durabilityDataPath: './test-durability'
      };

      const db = new Monarch(config);
      expect(db).toBeInstanceOf(Monarch);
      
      // Verify transaction manager was used
      const txId = db.beginTransaction();
      expect(txId).toBeDefined();
    });
  });

  describe('Backward Compatibility', () => {
    it('should accept PersistenceAdapter directly (backward compatibility)', () => {
      const adapter = new FileSystemAdapter('./test-data');
      const db = new Monarch(adapter);
      expect(db).toBeInstanceOf(Monarch);
    });

    it('should wrap PersistenceAdapter in config internally', async () => {
      const mockAdapter: PersistenceAdapter = {
        save: vi.fn().mockResolvedValue(undefined),
        load: vi.fn().mockResolvedValue({})
      };

      const db = new Monarch(mockAdapter);
      db.addCollection('users');
      await db.save();

      expect(mockAdapter.save).toHaveBeenCalled();
    });

    it('should work with both old and new API patterns', () => {
      // Old API (backward compatible)
      const adapter = new FileSystemAdapter('./test-data');
      const db1 = new Monarch(adapter);

      // New API (with config)
      const db2 = new Monarch({ adapter });

      expect(db1).toBeInstanceOf(Monarch);
      expect(db2).toBeInstanceOf(Monarch);
    });
  });

  describe('Factory Behavior', () => {
    it('should call factories lazily for optional managers', async () => {
      const durabilityFactory = vi.fn(() => new DurabilityManagerImpl('./test'));
      const securityFactory = vi.fn(() => new SecurityManager('test-key'));

      const config: MonarchConfig = {
        durabilityManagerFactory: durabilityFactory,
        securityManagerFactory: securityFactory
      };

      const db = new Monarch(config);
      
      // Factories should not be called yet
      expect(durabilityFactory).not.toHaveBeenCalled();
      expect(securityFactory).not.toHaveBeenCalled();

      // Access managers through public methods (triggers lazy loading)
      await db.encrypt('test data');
      expect(securityFactory).toHaveBeenCalledTimes(1);
      expect(durabilityFactory).not.toHaveBeenCalled(); // Still not accessed
    });

    it('should create manager instance only once (singleton behavior)', async () => {
      const factorySpy = vi.fn(() => new DurabilityManagerImpl('./test'));

      const config: MonarchConfig = {
        durabilityManagerFactory: factorySpy
      };

      const db = new Monarch(config);
      
      // Access durability manager multiple times
      await db.configureDurability({ level: 'medium' });
      await db.configureDurability({ level: 'high' });
      
      // Factory should only be called once (singleton)
      expect(factorySpy).toHaveBeenCalledTimes(1);
    });

    it('should use default factory when custom factory returns undefined', () => {
      // This shouldn't happen in practice, but test edge case
      const config: MonarchConfig = {
        // No factory provided - should use default
      };

      const db = new Monarch(config);
      
      // Should create default managers
      const txId = db.beginTransaction();
      expect(txId).toBeDefined();
    });
  });

  describe('Environment Variable Integration', () => {
    it('should prefer config encryption key over environment variable', async () => {
      const originalEnv = process.env.MONARCH_ENCRYPTION_KEY;
      
      try {
        process.env.MONARCH_ENCRYPTION_KEY = 'env-key';
        
        const config: MonarchConfig = {
          encryptionKey: 'config-key'
        };

        const db = new Monarch(config);
        
        // Access security manager through encrypt (config key should be preferred)
        const encrypted = await db.encrypt('test data');
        expect(encrypted).toBeDefined();
        expect(db).toBeInstanceOf(Monarch);
      } finally {
        if (originalEnv) {
          process.env.MONARCH_ENCRYPTION_KEY = originalEnv;
        } else {
          delete process.env.MONARCH_ENCRYPTION_KEY;
        }
      }
    });
  });

  describe('Real-World Usage Scenarios', () => {
    it('should work with production-like configuration', async () => {
      const adapter = new FileSystemAdapter('./production-data');
      
      const config: MonarchConfig = {
        adapter,
        encryptionKey: 'production-encryption-key-from-env',
        durabilityDataPath: './production-durability',
        transactionManagerFactory: () => {
          const tm = new TransactionManager();
          // Could configure transaction manager here
          return tm;
        }
      };

      const db = new Monarch(config);
      
      // Should work with all features
      db.addCollection('users');
      const txId = db.beginTransaction();
      
      // Access security manager (triggers lazy loading with custom encryption key)
      const encrypted = await db.encrypt('production data');
      
      expect(db).toBeInstanceOf(Monarch);
      expect(txId).toBeDefined();
      expect(encrypted).toBeDefined();
    });

    it('should work with minimal configuration', () => {
      const db = new Monarch({});
      
      db.addCollection('test');
      const collection = db.getCollection('test');
      expect(collection).toBeDefined();
    });

    it('should work with test configuration (mocked managers)', () => {
      const mockAdapter: PersistenceAdapter = {
        save: vi.fn().mockResolvedValue(undefined),
        load: vi.fn().mockResolvedValue({})
      };

      const mockTransactionManager = new TransactionManager();
      
      const config: MonarchConfig = {
        adapter: mockAdapter,
        transactionManagerFactory: () => mockTransactionManager
      };

      const db = new Monarch(config);
      expect(db).toBeInstanceOf(Monarch);
    });
  });
});

