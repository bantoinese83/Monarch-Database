import { promises as fs } from 'fs';
import path from 'path';

// Conditional crypto import for Node.js/browser compatibility
let createHash: any;
try {
  createHash = require('crypto').createHash;
} catch (e) {
  // Browser environment - crypto not available
  createHash = null;
}
import { DurabilityManager, DurabilityOptions, DurabilityLevel, WALEntry } from './types';
import { logger } from './logger';

export class DurabilityManagerImpl implements DurabilityManager {
  private options: DurabilityOptions = {
    level: 'medium',
    syncInterval: 5000, // 5 seconds
    maxWALSize: 100 * 1024 * 1024, // 100MB
    snapshotInterval: 300000, // 5 minutes
    compressionEnabled: true,
    encryptionEnabled: false
  };

  private walFile: string;
  private snapshotDir: string;
  private syncTimer?: NodeJS.Timeout;
  private snapshotTimer?: NodeJS.Timeout;
  private currentWALSize = 0;
  private lastSync = 0;
  private snapshots: string[] = [];

  constructor(baseDir: string = './data') {
    this.walFile = path.join(baseDir, 'wal.log');
    this.snapshotDir = path.join(baseDir, 'snapshots');

    // Ensure directories exist
    this.ensureDirectories();
  }

  private async ensureDirectories(): Promise<void> {
    try {
      await fs.mkdir(path.dirname(this.walFile), { recursive: true });
      await fs.mkdir(this.snapshotDir, { recursive: true });
    } catch (error) {
      logger.warn('Failed to create durability directories', {}, error as Error);
    }
  }

  async configure(options: Partial<DurabilityOptions>): Promise<void> {
    // Validate durability level
    const validLevels: DurabilityLevel[] = ['none', 'low', 'medium', 'high', 'maximum'];
    if (options.level && !validLevels.includes(options.level)) {
      throw new Error(`Invalid durability level: ${options.level}`);
    }
    
    // Validate intervals
    if (options.syncInterval !== undefined && options.syncInterval < 100) {
      throw new Error('Sync interval must be at least 100ms');
    }
    if (options.snapshotInterval !== undefined && options.snapshotInterval < 1000) {
      throw new Error('Snapshot interval must be at least 1000ms');
    }
    
    this.options = { ...this.options, ...options };
    
    // Re-ensure directories after configuration change
    await this.ensureDirectories();

    // Stop existing timers
    if (this.syncTimer) clearInterval(this.syncTimer);
    if (this.snapshotTimer) clearInterval(this.snapshotTimer);

    // Start new timers based on durability level
    this.setupTimers();

    logger.info('Durability configured', { level: this.options.level });
  }

  private setupTimers(): void {
    const { level, syncInterval, snapshotInterval } = this.options;

    // Configure sync interval based on durability level
    const actualSyncInterval = level === 'maximum' ? 1000 :
                              level === 'high' ? syncInterval :
                              level === 'medium' ? syncInterval * 2 :
                              level === 'low' ? syncInterval * 5 : 0;

    if (actualSyncInterval > 0) {
      this.syncTimer = setInterval(() => this.forceSync(), actualSyncInterval);
    }

    // Configure snapshot interval
    if (level !== 'none') {
      this.snapshotTimer = setInterval(() => this.createSnapshot(), snapshotInterval);
    }
  }

  async writeWAL(entry: WALEntry): Promise<void> {
    if (this.options.level === 'none') return;

    const entryStr = JSON.stringify({
      ...entry,
      checksum: this.calculateChecksum(entry)
    }) + '\n';

    const entrySize = Buffer.byteLength(entryStr, 'utf8');

    // Check if we need to rotate WAL
    if (this.currentWALSize + entrySize > this.options.maxWALSize) {
      await this.rotateWAL();
    }

    try {
      await fs.appendFile(this.walFile, entryStr);
      this.currentWALSize += entrySize;

      // Force sync based on durability level
      if (this.shouldForceSync(entry.operation)) {
        await this.forceSync();
      }
    } catch (error) {
      logger.error('Failed to write WAL entry', {}, error as Error);
      throw new Error('WAL write failed');
    }
  }

  private shouldForceSync(operation: string): boolean {
    const { level } = this.options;

    // Force sync for critical operations based on durability level
    const criticalOps = ['drop', 'delete', 'update'];

    if (level === 'maximum') return true;
    if (level === 'high') return criticalOps.includes(operation.toLowerCase());
    if (level === 'medium') return operation.toLowerCase() === 'drop';

    return false;
  }

  private async forceSync(): Promise<void> {
    try {
      // Force filesystem sync (if supported)
      if (typeof (fs as any).fsync === 'function') {
        await (fs as any).fsync(this.walFile);
      }
      this.lastSync = Date.now();
    } catch (error) {
      logger.warn('Failed to force sync', {}, error as Error);
    }
  }

  private async rotateWAL(): Promise<void> {
    const timestamp = Date.now();
    const rotatedFile = `${this.walFile}.${timestamp}`;

    try {
      await fs.rename(this.walFile, rotatedFile);
      this.currentWALSize = 0;

      // Archive old WAL files (keep last 10)
      await this.cleanupOldWALs();
    } catch (error) {
      logger.error('Failed to rotate WAL', {}, error as Error);
    }
  }

  private async cleanupOldWALs(): Promise<void> {
    try {
      const files = await fs.readdir(path.dirname(this.walFile));
      const walFiles = files
        .filter(f => f.startsWith(path.basename(this.walFile) + '.'))
        .sort()
        .reverse(); // Most recent first

      // Keep only last 10 WAL files
      for (let i = 10; i < walFiles.length; i++) {
        await fs.unlink(path.join(path.dirname(this.walFile), walFiles[i]));
      }
    } catch (error) {
      logger.warn('Failed to cleanup old WAL files', {}, error as Error);
    }
  }

  async createSnapshot(): Promise<string> {
    // Ensure snapshot directory exists
    try {
      await fs.mkdir(this.snapshotDir, { recursive: true });
    } catch (error) {
      logger.error('Failed to create snapshot directory', {}, error as Error);
      throw error;
    }

    const snapshotId = `snapshot_${Date.now()}`;
    const snapshotPath = path.join(this.snapshotDir, `${snapshotId}.json`);

    try {
      // This would normally get the current database state
      // For now, we'll create a placeholder snapshot
      const snapshotData = {
        id: snapshotId,
        timestamp: Date.now(),
        collections: {},
        walPosition: this.currentWALSize,
        version: '1.0.0'
      };

      const data = this.options.compressionEnabled ?
        this.compressData(snapshotData) : snapshotData;

      await fs.writeFile(snapshotPath, JSON.stringify(data));

      this.snapshots.push(snapshotId);

      // Keep only last 10 snapshots
      await this.cleanupOldSnapshots();

      logger.info('Created snapshot', { snapshotId });
      return snapshotId;

    } catch (error) {
      logger.error('Failed to create snapshot', {}, error as Error);
      throw new Error('Snapshot creation failed');
    }
  }

  private async cleanupOldSnapshots(): Promise<void> {
    if (this.snapshots.length <= 10) return;

    const toDelete = this.snapshots.splice(0, this.snapshots.length - 10);

    for (const snapshotId of toDelete) {
      try {
        const snapshotPath = path.join(this.snapshotDir, `${snapshotId}.json`);
        await fs.unlink(snapshotPath);
      } catch (error) {
        logger.warn('Failed to delete old snapshot', { snapshotId }, error as Error);
      }
    }
  }

  async recoverFromWAL(): Promise<void> {
    logger.info('Starting WAL recovery');

    try {
      // Read current WAL file
      const walContent = await fs.readFile(this.walFile, 'utf8');
      const entries = walContent.trim().split('\n').filter(line => line);

      let recoveredEntries = 0;
      let skippedEntries = 0;

      for (const line of entries) {
        try {
          const entry: WALEntry = JSON.parse(line);

          // Verify checksum
          if (this.calculateChecksum(entry) !== entry.checksum) {
            logger.warn('Checksum mismatch for WAL entry', { entryId: entry.id });
            skippedEntries++;
            continue;
          }

          // Apply entry (this would normally update the database)
          logger.debug('Recovered operation', {
            operation: entry.operation,
            collection: entry.collection || 'system'
          });
          recoveredEntries++;

        } catch (error) {
          logger.warn('Failed to parse WAL entry', {}, error as Error);
          skippedEntries++;
        }
      }

      logger.info('WAL recovery completed', {
        recovered: recoveredEntries,
        skipped: skippedEntries
      });

    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
        logger.info('No WAL file found, starting fresh');
        return;
      }
      logger.error('WAL recovery failed', {}, error as Error);
      throw new Error('WAL recovery failed');
    }
  }

  async getStats(): Promise<{ walSize: number; snapshots: number; lastSync: number }> {
    try {
      const walStats = await fs.stat(this.walFile).catch(() => ({ size: 0 }));
      const snapshotFiles = await fs.readdir(this.snapshotDir).catch(() => []);

      return {
        walSize: walStats.size,
        snapshots: snapshotFiles.length,
        lastSync: this.lastSync
      };
    } catch (error) {
      logger.warn('Failed to get durability stats', {}, error as Error);
      return { walSize: 0, snapshots: 0, lastSync: 0 };
    }
  }

  private calculateChecksum(entry: WALEntry): string {
    const data = JSON.stringify({
      id: entry.id,
      timestamp: entry.timestamp,
      operation: entry.operation,
      collection: entry.collection,
      data: entry.data
    });

    if (!createHash) {
      // Browser fallback - simple hash
      let hash = 0;
      for (let i = 0; i < data.length; i++) {
        hash = ((hash << 5) - hash + data.charCodeAt(i)) & 0xffffffff;
      }
      return Math.abs(hash).toString(16).substring(0, 16);
    }

    return createHash('sha256').update(data).digest('hex').substring(0, 16);
  }

  private compressData(data: any): any {
    // Simple compression - in production, use proper compression like gzip
    // For demo purposes, return data as-is with compression flag
    return {
      ...data,
      _compressed: true,
      _originalSize: JSON.stringify(data).length
    };
  }

  // Cleanup method
  async close(): Promise<void> {
    if (this.syncTimer) clearInterval(this.syncTimer);
    if (this.snapshotTimer) clearInterval(this.snapshotTimer);

    // Force final sync
    if (this.options.level !== 'none') {
      await this.forceSync();
    }
  }
}
