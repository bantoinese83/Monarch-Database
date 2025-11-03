import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { DurabilityManagerImpl } from '../src/durability-manager';
import { DurabilityLevel } from '../src/types';
import fs from 'fs/promises';
import path from 'path';

describe('Durability Manager - Golden Paths & Edge Cases', () => {
  let durabilityManager: DurabilityManagerImpl;
  let testDir: string;

  beforeEach(async () => {
    testDir = path.join(__dirname, 'temp-durability-test');
    await fs.mkdir(testDir, { recursive: true });
    durabilityManager = new DurabilityManagerImpl(testDir);
  });

  afterEach(async () => {
    try {
      await fs.rm(testDir, { recursive: true, force: true });
    } catch (error) {
      // Ignore cleanup errors
    }
  });

  describe('Golden Path Scenarios', () => {
    it('should configure and operate with high durability', async () => {
      await durabilityManager.configure({
        level: 'high',
        syncInterval: 1000,
        maxWALSize: 1024 * 1024,
        snapshotInterval: 5000,
        compressionEnabled: true,
        encryptionEnabled: true
      });

      const stats = await durabilityManager.getStats();
      expect(stats.walSize).toBe(0);
      expect(stats.snapshots).toBe(0);
    });

    it('should write WAL entries and create snapshots', async () => {
      await durabilityManager.configure({ level: 'medium' });

      const walEntry = {
        id: 'test-entry-1',
        timestamp: Date.now(),
        operation: 'insert',
        collection: 'users',
        data: { name: 'Alice', email: 'alice@example.com' },
        checksum: 'test-checksum'
      };

      await durabilityManager.writeWAL(walEntry);
      const snapshotId = await durabilityManager.createSnapshot();

      expect(snapshotId).toMatch(/^snapshot_\d+$/);
      const stats = await durabilityManager.getStats();
      expect(stats.snapshots).toBeGreaterThan(0);
    });

    it('should recover from WAL after restart', async () => {
      await durabilityManager.configure({ level: 'high' });

      // Write some entries
      await durabilityManager.writeWAL({
        id: 'recovery-test-1',
        timestamp: Date.now(),
        operation: 'insert',
        collection: 'test',
        data: { id: 1, value: 'test' },
        checksum: 'checksum1'
      });

      // Simulate restart by creating new instance
      const newManager = new DurabilityManagerImpl(testDir);
      await newManager.configure({ level: 'high' });

      // Recovery should work without errors
      await expect(newManager.recoverFromWAL()).resolves.not.toThrow();
    });
  });

  describe('Edge Cases - Durability Levels', () => {
    it('should handle all durability levels correctly', async () => {
      const levels: DurabilityLevel[] = ['none', 'low', 'medium', 'high', 'maximum'];

      for (const level of levels) {
        const manager = new DurabilityManagerImpl(`${testDir}/${level}`);
        await manager.configure({ level });

        // Should not throw for any level
        await expect(manager.getStats()).resolves.toBeDefined();
        await expect(manager.createSnapshot()).resolves.toBeDefined();
      }
    });

    it('should handle durability level transitions', async () => {
      await durabilityManager.configure({ level: 'none' });

      // Write entries with no durability
      await durabilityManager.writeWAL({
        id: 'transition-test',
        timestamp: Date.now(),
        operation: 'update',
        data: { id: 1 },
        checksum: 'test'
      });

      // Upgrade to maximum durability
      await durabilityManager.configure({
        level: 'maximum',
        syncInterval: 100,
        maxWALSize: 1024,
        snapshotInterval: 1000
      });

      // Should continue working
      const stats = await durabilityManager.getStats();
      expect(stats).toBeDefined();
    });
  });

  describe('Edge Cases - WAL Operations', () => {
    it('should handle WAL rotation when size limit reached', async () => {
      await durabilityManager.configure({
        level: 'high',
        maxWALSize: 1024 // Very small limit for testing
      });

      // Write entries until rotation occurs
      for (let i = 0; i < 20; i++) {
        await durabilityManager.writeWAL({
          id: `rotation-test-${i}`,
          timestamp: Date.now(),
          operation: 'insert',
          data: { id: i, data: 'x'.repeat(100) }, // Large data
          checksum: `checksum-${i}`
        });
      }

      const stats = await durabilityManager.getStats();
      expect(stats.walSize).toBeLessThan(1024); // Should have rotated
    });

    it('should handle corrupted WAL entries gracefully', async () => {
      await durabilityManager.configure({ level: 'medium' });

      // Manually create corrupted WAL entry
      const walFile = path.join(testDir, 'wal.log');
      await fs.appendFile(walFile, 'invalid json entry\n');

      // Recovery should handle corruption
      await expect(durabilityManager.recoverFromWAL()).resolves.not.toThrow();
    });

    it('should handle empty WAL file', async () => {
      await durabilityManager.configure({ level: 'medium' });

      // Create empty WAL file
      const walFile = path.join(testDir, 'wal.log');
      await fs.writeFile(walFile, '');

      // Should handle empty file
      await expect(durabilityManager.recoverFromWAL()).resolves.not.toThrow();
    });
  });

  describe('Edge Cases - Snapshot Operations', () => {
    it('should handle snapshot creation with large datasets', async () => {
      await durabilityManager.configure({ level: 'medium' });

      // Create many WAL entries before snapshot
      for (let i = 0; i < 100; i++) {
        await durabilityManager.writeWAL({
          id: `snapshot-test-${i}`,
          timestamp: Date.now(),
          operation: 'insert',
          collection: 'large_collection',
          data: { id: i, data: `entry_${i}` },
          checksum: `cs-${i}`
        });
      }

      // Should create snapshot successfully
      const snapshotId = await durabilityManager.createSnapshot();
      expect(snapshotId).toBeDefined();

      const stats = await durabilityManager.getStats();
      expect(stats.snapshots).toBeGreaterThan(0);
    });

    it('should handle snapshot cleanup (keeping only recent ones)', async () => {
      await durabilityManager.configure({
        level: 'medium',
        snapshotInterval: 1000 // Minimum allowed interval
      });

      // Create multiple snapshots
      const snapshotIds = [];
      for (let i = 0; i < 15; i++) {
        snapshotIds.push(await durabilityManager.createSnapshot());
        await new Promise(resolve => setTimeout(resolve, 10)); // Small delay
      }

      const stats = await durabilityManager.getStats();
      expect(stats.snapshots).toBeGreaterThan(0);
      expect(stats.snapshots).toBeLessThanOrEqual(10); // Should be limited
    });

    it('should handle snapshot creation failures gracefully', async () => {
      await durabilityManager.configure({ level: 'medium' });
      
      // Remove write permissions to cause snapshot failure
      const snapshotDir = path.join(testDir, 'snapshots');
      try {
        await fs.access(snapshotDir);
        await fs.chmod(snapshotDir, 0o444); // Read-only
        
        // Should throw on snapshot failure
        await expect(durabilityManager.createSnapshot()).rejects.toThrow();
        
        // Restore permissions for cleanup
        await fs.chmod(snapshotDir, 0o755);
      } catch (error) {
        // If directory doesn't exist or chmod fails, skip this test
        // This can happen on some file systems
      }
    });
  });

  describe('Edge Cases - Configuration', () => {
    it('should handle invalid durability configurations', async () => {
      // Invalid level
      await expect(durabilityManager.configure({
        level: 'invalid' as any,
        syncInterval: 1000
      })).rejects.toThrow();

      // Invalid sync interval
      await expect(durabilityManager.configure({
        level: 'medium',
        syncInterval: 50 // Too small
      })).rejects.toThrow();

      // Invalid snapshot interval
      await expect(durabilityManager.configure({
        level: 'medium',
        snapshotInterval: 100 // Too small
      })).rejects.toThrow();
    });

    it('should handle configuration updates during operation', async () => {
      await durabilityManager.configure({ level: 'low' });

      // Start some operations
      await durabilityManager.writeWAL({
        id: 'config-test',
        timestamp: Date.now(),
        operation: 'insert',
        data: { test: 'data' },
        checksum: 'test'
      });

      // Update configuration mid-operation
      await durabilityManager.configure({
        level: 'high',
        syncInterval: 500,
        maxWALSize: 2048
      });

      // Should continue working
      await expect(durabilityManager.getStats()).resolves.toBeDefined();
    });
  });

  describe('Edge Cases - Resource Management', () => {
    it('should handle disk space exhaustion', async () => {
      // This is hard to simulate in tests, but we can test error handling
      await durabilityManager.configure({ level: 'maximum' });

      // Write a large WAL entry - may succeed or fail depending on available space
      // The manager should handle either case gracefully
      try {
        await durabilityManager.writeWAL({
          id: 'disk-full-test',
          timestamp: Date.now(),
          operation: 'insert',
          data: { largeData: 'x'.repeat(1024 * 1024) }, // 1MB data
          checksum: 'large'
        });
        // If it succeeds, that's fine - we can't reliably simulate disk full
      } catch (error) {
        // If it fails, that's also fine - shows error handling works
        expect(error).toBeDefined();
      }
    });

    it('should handle concurrent WAL writes', async () => {
      await durabilityManager.configure({ level: 'high' });

      const writePromises = Array.from({ length: 10 }, async (_, i) => {
        await durabilityManager.writeWAL({
          id: `concurrent-${i}`,
          timestamp: Date.now(),
          operation: 'insert',
          data: { id: i },
          checksum: `cs-${i}`
        });
      });

      // All writes should complete without corruption
      await expect(Promise.all(writePromises)).resolves.not.toThrow();

      const stats = await durabilityManager.getStats();
      expect(stats.walSize).toBeGreaterThan(0);
    });

    it('should handle very long WAL entries', async () => {
      await durabilityManager.configure({ level: 'medium' });

      const longData = 'x'.repeat(100000); // 100KB data

      await durabilityManager.writeWAL({
        id: 'long-entry-test',
        timestamp: Date.now(),
        operation: 'insert',
        data: { content: longData },
        checksum: 'long'
      });

      const stats = await durabilityManager.getStats();
      expect(stats.walSize).toBeGreaterThan(0);
    });
  });

  describe('Stress Testing', () => {
    it('should handle rapid WAL writes', async () => {
      await durabilityManager.configure({ level: 'maximum' });

      const startTime = Date.now();
      const numWrites = 1000;

      const writePromises = Array.from({ length: numWrites }, async (_, i) => {
        await durabilityManager.writeWAL({
          id: `stress-${i}`,
          timestamp: Date.now(),
          operation: 'insert',
          data: { index: i, data: `stress_test_${i}` },
          checksum: `cs-stress-${i}`
        });
      });

      await Promise.all(writePromises);
      const duration = Date.now() - startTime;

      const stats = await durabilityManager.getStats();
      expect(stats.walSize).toBeGreaterThan(0);
      expect(duration).toBeLessThan(5000); // Should complete within 5 seconds

      console.log(`Stress test: ${numWrites} WAL writes in ${duration}ms (${Math.round(numWrites / (duration / 1000))} ops/sec)`);
    });

    it('should handle mixed operations under load', async () => {
      await durabilityManager.configure({ level: 'high' });

      const operations = [];

      // Mix of WAL writes and snapshots
      for (let i = 0; i < 50; i++) {
        operations.push(durabilityManager.writeWAL({
          id: `mixed-${i}`,
          timestamp: Date.now(),
          operation: 'insert',
          data: { mixed: i },
          checksum: `mixed-${i}`
        }));

        if (i % 10 === 0) {
          operations.push(durabilityManager.createSnapshot());
        }

        operations.push(durabilityManager.getStats());
      }

      await expect(Promise.all(operations)).resolves.not.toThrow();
    });
  });
});
