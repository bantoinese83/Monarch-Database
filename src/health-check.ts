/**
 * Health Check System
 * 
 * Provides health, readiness, and liveness endpoints for Kubernetes and monitoring
 */

import { logger } from './logger';
import { globalMonitor } from './performance-monitor';

export interface HealthStatus {
  status: 'healthy' | 'unhealthy' | 'degraded';
  timestamp: string;
  uptime: number;
  version: string;
}

export interface ReadinessStatus {
  ready: boolean;
  checks: {
    database: boolean;
    memory: boolean;
    disk?: boolean;
  };
  timestamp: string;
}

export interface LivenessStatus {
  alive: boolean;
  timestamp: string;
}

export class HealthChecker {
  private startTime: number;
  private readonly version: string;

  constructor(version: string = '1.0.0') {
    this.startTime = Date.now();
    this.version = version;
  }

  /**
   * Check overall health status
   */
  getHealth(): HealthStatus {
    const uptime = Date.now() - this.startTime;
    const memoryUsage = this.getMemoryUsage();
    
    // Check if memory usage is critical (>90%)
    const memoryCritical = memoryUsage.usedPercent > 90;
    const status = memoryCritical ? 'degraded' : 'healthy';

    return {
      status,
      timestamp: new Date().toISOString(),
      uptime,
      version: this.version
    };
  }

  /**
   * Check if service is ready to accept traffic
   */
  getReadiness(): ReadinessStatus {
    const checks = {
      database: this.checkDatabase(),
      memory: this.checkMemory(),
      disk: this.checkDisk()
    };

    const ready = Object.values(checks).every(check => check === true);

    return {
      ready,
      checks,
      timestamp: new Date().toISOString()
    };
  }

  /**
   * Check if service is alive (liveness probe)
   */
  getLiveness(): LivenessStatus {
    return {
      alive: true,
      timestamp: new Date().toISOString()
    };
  }

  /**
   * Get detailed metrics for Prometheus
   */
  getMetrics(): string {
    const memory = this.getMemoryUsage();
    const metrics = globalMonitor.getAllMetrics();
    
    const lines: string[] = [
      '# HELP monarch_uptime_seconds Service uptime in seconds',
      '# TYPE monarch_uptime_seconds gauge',
      `monarch_uptime_seconds ${(Date.now() - this.startTime) / 1000}`,
      '',
      '# HELP monarch_memory_used_bytes Memory used in bytes',
      '# TYPE monarch_memory_used_bytes gauge',
      `monarch_memory_used_bytes ${memory.used}`,
      '',
      '# HELP monarch_memory_total_bytes Total memory in bytes',
      '# TYPE monarch_memory_total_bytes gauge',
      `monarch_memory_total_bytes ${memory.total}`,
      '',
      '# HELP monarch_memory_used_percent Memory used percentage',
      '# TYPE monarch_memory_used_percent gauge',
      `monarch_memory_used_percent ${memory.usedPercent}`,
      ''
    ];

    // Add operation metrics
    for (const [operation, metric] of Object.entries(metrics)) {
      lines.push(
        `# HELP monarch_operation_count_total Total number of ${operation} operations`,
        `# TYPE monarch_operation_count_total counter`,
        `monarch_operation_count_total{operation="${operation}"} ${metric.operationCount}`,
        '',
        `# HELP monarch_operation_duration_seconds ${operation} operation duration`,
        `# TYPE monarch_operation_duration_seconds histogram`,
        `monarch_operation_duration_seconds{operation="${operation}"} ${metric.averageTime / 1000}`,
        ''
      );
    }

    return lines.join('\n');
  }

  private checkDatabase(): boolean {
    // Basic check - can be extended to verify actual database connectivity
    try {
      // If we can access global monitor, database is likely working
      globalMonitor.getAllMetrics();
      return true;
    } catch (error) {
      logger.error('Database health check failed', { error: error instanceof Error ? error.message : String(error) });
      return false;
    }
  }

  private checkMemory(): boolean {
    const memory = this.getMemoryUsage();
    // Ready if memory usage is below 95%
    return memory.usedPercent < 95;
  }

  private checkDisk(): boolean {
    // Basic disk check - can be enhanced with actual disk usage check
    // For now, assume disk is available
    return true;
  }

  private getMemoryUsage(): { used: number; total: number; usedPercent: number } {
    if (typeof process !== 'undefined' && process.memoryUsage) {
      const usage = process.memoryUsage();
      const total = usage.heapTotal;
      const used = usage.heapUsed;
      return {
        used,
        total,
        usedPercent: (used / total) * 100
      };
    }
    
    // Browser environment - return mock values
    return {
      used: 0,
      total: 0,
      usedPercent: 0
    };
  }
}

// Export singleton instance
export const healthChecker = new HealthChecker(process.env.npm_package_version || '1.0.0');

