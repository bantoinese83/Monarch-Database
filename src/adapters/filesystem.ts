import { promises as fs } from 'fs';
import { BaseAdapter } from './base';
import path from 'path';

export class FileSystemAdapter extends BaseAdapter {
  constructor(private filePath: string) {
    super();
    this.validateFilePath(filePath);
  }

  private validateFilePath(filePath: string): void {
    if (!filePath || typeof filePath !== 'string') {
      throw new Error('File path must be a non-empty string');
    }

    if (filePath.length > 4096) {
      // Max path length
      throw new Error('File path too long (max 4096 characters)');
    }

    // Check for dangerous characters
    if (filePath.includes('..') || filePath.includes('\0')) {
      throw new Error('Invalid characters in file path');
    }

    // Check if directory exists (but don't create it)
    const dir = path.dirname(filePath);
    try {
      const stats = require('fs').statSync(dir);
      if (!stats.isDirectory()) {
        throw new Error('Parent directory does not exist or is not a directory');
      }
    } catch (error) {
      const nodeError = error as NodeJS.ErrnoException;
      if (nodeError.code !== 'ENOENT') {
        throw new Error(`Cannot access directory: ${nodeError.message || String(error)}`);
      }
      throw new Error('Parent directory does not exist');
    }
  }

  async save(data: any): Promise<void> {
    try {
      // Validate data before saving
      if (data === null || data === undefined) {
        throw new Error('Cannot save null or undefined data');
      }

      const jsonData = JSON.stringify(data, null, 2);

      // Check file size before writing
      const dataSize = Buffer.byteLength(jsonData, 'utf8');
      if (dataSize > 100 * 1024 * 1024) {
        // 100MB limit
        throw new Error(`Data too large to save (${dataSize} bytes, max 100MB)`);
      }

      await fs.writeFile(this.filePath, jsonData, 'utf-8');
    } catch (error) {
      if (error instanceof Error && error.message.includes('Data too large')) {
        throw error; // Re-throw our size validation error
      }
      throw new Error(
        `Failed to save database to file: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  async load(): Promise<any> {
    try {
      const stats = await fs.stat(this.filePath);

      // Check file size before reading
      if (stats.size > 100 * 1024 * 1024) {
        // 100MB limit
        throw new Error(`Database file too large (${stats.size} bytes, max 100MB)`);
      }

      const data = await fs.readFile(this.filePath, 'utf-8');

      // Parse and validate JSON
      const parsed = JSON.parse(data);

      // Basic structure validation
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
        return parsed;
      } else {
        throw new Error('Invalid database file format');
      }
    } catch (error) {
      const nodeError = error as NodeJS.ErrnoException;

      // If file doesn't exist, return empty data
      if (nodeError.code === 'ENOENT') {
        return {};
      }

      // Handle JSON parsing errors
      if (error instanceof SyntaxError) {
        throw new Error(`Database file contains invalid JSON: ${error.message}`);
      }

      // Handle permission errors
      if (nodeError.code === 'EACCES' || nodeError.code === 'EPERM') {
        throw new Error(`Permission denied accessing database file: ${this.filePath}`);
      }

      throw new Error(
        `Failed to load database from file: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }
}
