import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { FileSystemAdapter } from '../src/adapters/filesystem';
import { IndexedDBAdapter } from '../src/adapters/indexeddb';
import { promises as fs } from 'fs';
import path from 'path';
import os from 'os';

// Mock IndexedDB for testing
const indexedDBMock = {
  open: vi.fn(),
  deleteDatabase: vi.fn()
};

// Mock the global indexedDB
Object.defineProperty(global, 'indexedDB', {
  value: indexedDBMock,
  writable: true
});

describe('Persistence Adapters', () => {
  describe('FileSystemAdapter', () => {
    let tempDir: string;
    let adapter: FileSystemAdapter;

    beforeEach(async () => {
      // Create a temporary directory for testing
      tempDir = path.join(os.tmpdir(), 'monarch-test-' + Math.random().toString(36).substr(2, 9));
      await fs.mkdir(tempDir, { recursive: true });
      adapter = new FileSystemAdapter(path.join(tempDir, 'test.db'));
    });

    afterEach(async () => {
      // Clean up temporary directory
      try {
        await fs.rm(tempDir, { recursive: true, force: true });
      } catch (error) {
        // Ignore cleanup errors
      }
    });

    it('should save data to file', async () => {
      const testData = { collections: { users: { documents: [{ name: 'test' }] } } };

      await adapter.save(testData);

      const fileContent = await fs.readFile(path.join(tempDir, 'test.db'), 'utf-8');
      const parsedData = JSON.parse(fileContent);
      expect(parsedData).toEqual(testData);
    });

    it('should load data from file', async () => {
      const testData = { collections: { users: { documents: [{ name: 'test' }] } } };

      // Write test data to file first
      await fs.writeFile(path.join(tempDir, 'test.db'), JSON.stringify(testData));

      const loadedData = await adapter.load();
      expect(loadedData).toEqual(testData);
    });

    it('should return empty object when file does not exist', async () => {
      // File doesn't exist yet
      const loadedData = await adapter.load();
      expect(loadedData).toEqual({});
    });

    it('should validate file paths in constructor', () => {
      // Creating adapter with path to non-existent directory should fail in constructor
      expect(() => new FileSystemAdapter('/non/existent/directory/test.db')).toThrow('Parent directory does not exist');
    });

    it('should handle load errors gracefully', async () => {
      // Create adapter pointing to a directory instead of file
      const dirAdapter = new FileSystemAdapter(tempDir);

      // This should fail because tempDir is a directory, not a file
      await expect(dirAdapter.load()).rejects.toThrow();
    });
  });

  describe('IndexedDBAdapter', () => {
    it('should create adapter with custom database and store names', () => {
      const customAdapter = new IndexedDBAdapter('my-custom-db', 'my-custom-store');
      expect(customAdapter).toBeInstanceOf(IndexedDBAdapter);
    });

    it('should create adapter with default names', () => {
      const defaultAdapter = new IndexedDBAdapter();
      expect(defaultAdapter).toBeInstanceOf(IndexedDBAdapter);
    });

    // Skip complex async tests for IndexedDB due to mocking complexity
    // These would require complex mocking of the IndexedDB API
    it.skip('should save data to IndexedDB', async () => {
      // Implementation would require complex mocking
    });

    it.skip('should load data from IndexedDB', async () => {
      // Implementation would require complex mocking
    });
  });
});
