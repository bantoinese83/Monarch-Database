import { describe, it, expect, beforeEach, vi } from 'vitest';
import { PerformanceMonitor } from '../src/performance-monitor';
import { logger } from '../src/logger';

describe('PerformanceMonitor', () => {
  let monitor: PerformanceMonitor;

  beforeEach(() => {
    monitor = new PerformanceMonitor();
  });

  it('should start and end timing an operation', () => {
    monitor.start('test-operation');
    monitor.end('test-operation');

    const metrics = monitor.getMetrics('test-operation');
    expect(metrics).toBeDefined();
    expect(metrics!.operationCount).toBe(1);
    expect(metrics!.totalTime).toBeGreaterThan(0);
    expect(metrics!.averageTime).toBe(metrics!.totalTime);
  });

  it('should handle multiple operations with the same name', () => {
    monitor.start('operation');
    monitor.end('operation');

    monitor.start('operation');
    monitor.end('operation');

    const metrics = monitor.getMetrics('operation');
    expect(metrics!.operationCount).toBe(2);
    expect(metrics!.averageTime).toBe(metrics!.totalTime / 2);
  });

  it('should calculate min and max times correctly', () => {
    // First operation (fast)
    monitor.start('operation');
    setTimeout(() => monitor.end('operation'), 10);

    // Second operation (slower)
    setTimeout(() => {
      monitor.start('operation');
      setTimeout(() => monitor.end('operation'), 20);
    }, 15);

    // Wait for operations to complete
    return new Promise(resolve => {
      setTimeout(() => {
        const metrics = monitor.getMetrics('operation');
        expect(metrics!.operationCount).toBe(2);
        expect(metrics!.minTime).toBeLessThan(metrics!.maxTime);
        expect(metrics!.lastOperationTime).toBeGreaterThan(0);
        resolve(void 0);
      }, 50);
    });
  });

  it('should return undefined for non-existent operation', () => {
    const metrics = monitor.getMetrics('non-existent');
    expect(metrics).toBeUndefined();
  });

  it('should warn when ending an operation that was not started', () => {
    const loggerWarnSpy = vi.spyOn(logger, 'warn').mockImplementation(() => {});

    monitor.end('not-started');

    expect(loggerWarnSpy).toHaveBeenCalledWith(
      'Performance monitor: operation was not started',
      { operation: 'not-started' },
      undefined
    );

    loggerWarnSpy.mockRestore();
  });

  it('should reset all metrics', () => {
    monitor.start('operation1');
    monitor.end('operation1');

    monitor.start('operation2');
    monitor.end('operation2');

    expect(monitor.getAllMetrics().size).toBe(2);

    monitor.reset();

    expect(monitor.getAllMetrics().size).toBe(0);
  });

  it('should generate performance report', () => {
    monitor.start('test-op');
    monitor.end('test-op');

    const report = monitor.getReport();

    expect(report).toContain('Performance Report:');
    expect(report).toContain('==================');
    expect(report).toContain('test-op:');
    expect(report).toContain('Count: 1');
    expect(report).toContain('Total:');
    expect(report).toContain('Average:');
  });

  it('should handle multiple different operations', () => {
    monitor.start('op1');
    monitor.end('op1');

    monitor.start('op2');
    monitor.end('op2');

    monitor.start('op1'); // Second op1
    monitor.end('op1');

    const allMetrics = monitor.getAllMetrics();
    expect(allMetrics.size).toBe(2);
    expect(allMetrics.get('op1')!.operationCount).toBe(2);
    expect(allMetrics.get('op2')!.operationCount).toBe(1);
  });

  it('should calculate average time correctly', () => {
    // Mock performance.now to return controlled values
    let mockTime = 1000;
    const originalNow = performance.now;
    performance.now = vi.fn(() => {
      mockTime += 10; // Each call advances by 10ms
      return mockTime;
    });

    try {
      monitor.start('test');
      monitor.end('test');

      const metrics = monitor.getMetrics('test');
      expect(metrics!.totalTime).toBe(10);
      expect(metrics!.averageTime).toBe(10);
    } finally {
      performance.now = originalNow;
    }
  });
});
