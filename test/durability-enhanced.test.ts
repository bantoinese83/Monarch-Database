/**
 * Tests for Enhanced Durability Manager
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { EnhancedDurabilityManager } from '../src/durability-enhanced';
import { DurabilityOptions } from '../src/types';
import { ValidationError } from '../src/errors';
import { promises as fs } from 'fs';
import path from 'path';
import { tmpdir } from 'os';

describe('EnhancedDurabilityManager', () => {
  let durabilityManager: EnhancedDurabilityManager;
  let testDir: string;

  beforeEach(async () => {
    testDir = path.join(tmpdir(), `monarch-test-${Date.now()}`);
    durabilityManager = new EnhancedDurabilityManager(testDir);
    await durabilityManager.configure({ level: 'medium' });
  });

  afterEach(async () => {
    try {
      await durabilityManager.close();
      await fs.rmdir(testDir, { recursive: true });
    } catch {
      // Ignore cleanup errors
    }
  });

  describe('Checkpointing', () => {
    it('should create a checkpoint', async () => {
      const checkpointId = await durabilityManager.createCheckpoint(false);
      expect(checkpointId).toBeDefined();
      
      const stats = await durabilityManager.getEnhancedStats();
      expect(stats.checkpoints).toBeGreaterThan(0);
    });

    it('should create checkpoint with fsync', async () => {
      const checkpointId = await durabilityManager.createCheckpoint(true);
      expect(checkpointId).toBeDefined();
    });
  });

  describe('Isolation Levels', () => {
    it('should set and get isolation level', () => {
      durabilityManager.setIsolationLevel('serializable');
      expect(durabilityManager.getIsolationLevel()).toBe('serializable');
      
      durabilityManager.setIsolationLevel('read-committed');
      expect(durabilityManager.getIsolationLevel()).toBe('read-committed');
    });
  });

  describe('Consistency Options', () => {
    it('should set and get consistency options', () => {
      const options = {
        mode: 'strong' as const,
        readConcern: 'majority' as const,
        writeConcern: 'majority' as const
      };
      
      durabilityManager.setConsistencyOptions(options);
      const retrieved = durabilityManager.getConsistencyOptions();
      
      expect(retrieved.mode).toBe('strong');
      expect(retrieved.readConcern).toBe('majority');
      expect(retrieved.writeConcern).toBe('majority');
    });
  });

  describe('WAL with Guarantees', () => {
    it('should write WAL with write concern', async () => {
      const entry = {
        id: 'test-1',
        timestamp: Date.now(),
        operation: 'insert',
        data: { test: 'data' },
        checksum: 'test'
      };
      
      await durabilityManager.writeWALWithGuarantees(entry, 'majority');
      // Should not throw
    });
  });

  describe('Enhanced Statistics', () => {
    it('should return enhanced statistics', async () => {
      const stats = await durabilityManager.getEnhancedStats();
      
      expect(stats).toHaveProperty('walSize');
      expect(stats).toHaveProperty('snapshots');
      expect(stats).toHaveProperty('checkpoints');
      expect(stats).toHaveProperty('isolationLevel');
      expect(stats).toHaveProperty('consistencyMode');
    });
  });
});

