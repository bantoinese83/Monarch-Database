/**
 * Observability and Operations Automation
 * 
 * Comprehensive monitoring, metrics, tracing, and automation.
 */

import { logger } from './logger';

/**
 * Metric types
 */
export type MetricType = 'counter' | 'gauge' | 'histogram' | 'summary';

/**
 * Metric definition
 */
export interface MetricDefinition {
  name: string;
  type: MetricType;
  labels?: Record<string, string>;
  help?: string;
}

/**
 * Metric value
 */
export interface MetricValue {
  name: string;
  labels: Record<string, string>;
  value: number;
  timestamp: number;
}

/**
 * Trace span
 */
export interface TraceSpan {
  id: string;
  traceId: string;
  parentId?: string;
  operation: string;
  startTime: number;
  endTime?: number;
  duration?: number;
  tags?: Record<string, string>;
  logs?: Array<{ timestamp: number; fields: Record<string, any> }>;
}

/**
 * Alert configuration
 */
export interface AlertConfig {
  name: string;
  condition: string; // e.g., "cpu_usage > 80"
  severity: 'critical' | 'warning' | 'info';
  actions: string[]; // Action URLs or handlers
  cooldown: number; // ms
}

/**
 * Observability Manager
 */
export class ObservabilityManager {
  private metrics: Map<string, MetricValue[]> = new Map();
  private traces: Map<string, TraceSpan[]> = new Map();
  private alerts: Map<string, AlertConfig> = new Map();
  private alertState: Map<string, { lastTriggered: number; active: boolean }> = new Map();
  
  // Metric aggregation
  private metricAggregates: Map<string, {
    sum: number;
    count: number;
    min: number;
    max: number;
    lastUpdated: number;
  }> = new Map();

  /**
   * Record a metric
   */
  recordMetric(metric: MetricDefinition, value: number, labels: Record<string, string> = {}): void {
    const metricValue: MetricValue = {
      name: metric.name,
      labels: { ...metric.labels, ...labels },
      value,
      timestamp: Date.now()
    };

    if (!this.metrics.has(metric.name)) {
      this.metrics.set(metric.name, []);
    }

    const values = this.metrics.get(metric.name)!;
    values.push(metricValue);

    // Keep only last 1000 values per metric
    if (values.length > 1000) {
      values.shift();
    }

    // Update aggregates
    this.updateAggregates(metric.name, value);
  }

  /**
   * Start a trace span
   */
  startSpan(operation: string, traceId?: string, parentId?: string): TraceSpan {
    const spanId = `span_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const finalTraceId = traceId || `trace_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    const span: TraceSpan = {
      id: spanId,
      traceId: finalTraceId,
      parentId,
      operation,
      startTime: Date.now(),
      tags: {}
    };

    if (!this.traces.has(finalTraceId)) {
      this.traces.set(finalTraceId, []);
    }

    this.traces.get(finalTraceId)!.push(span);

    return span;
  }

  /**
   * End a trace span
   */
  endSpan(span: TraceSpan): void {
    span.endTime = Date.now();
    span.duration = span.endTime - span.startTime;
  }

  /**
   * Add tag to span
   */
  addSpanTag(span: TraceSpan, key: string, value: string): void {
    if (!span.tags) {
      span.tags = {};
    }
    span.tags[key] = value;
  }

  /**
   * Configure alert
   */
  configureAlert(config: AlertConfig): void {
    this.alerts.set(config.name, config);
    this.alertState.set(config.name, {
      lastTriggered: 0,
      active: false
    });
  }

  /**
   * Check alerts based on current metrics
   */
  checkAlerts(): void {
    for (const [alertName, alert] of this.alerts) {
      const state = this.alertState.get(alertName)!;
      const now = Date.now();

      // Check cooldown
      if (now - state.lastTriggered < alert.cooldown && state.active) {
        continue;
      }

      // Evaluate condition (simplified - real implementation would parse and evaluate)
      const shouldTrigger = this.evaluateAlertCondition(alert.condition);

      if (shouldTrigger && !state.active) {
        this.triggerAlert(alert);
        state.active = true;
        state.lastTriggered = now;
      } else if (!shouldTrigger && state.active) {
        state.active = false;
      }
    }
  }

  /**
   * Get metrics in Prometheus format
   */
  getPrometheusMetrics(): string {
    const lines: string[] = [];

    for (const [metricName, values] of this.metrics) {
      // Get latest value for each label combination
      const latestByLabels = new Map<string, MetricValue>();

      for (const value of values.slice(-100)) { // Last 100 values
        const labelStr = JSON.stringify(value.labels);
        if (!latestByLabels.has(labelStr) || latestByLabels.get(labelStr)!.timestamp < value.timestamp) {
          latestByLabels.set(labelStr, value);
        }
      }

      for (const value of latestByLabels.values()) {
        const labelsStr = Object.entries(value.labels)
          .map(([k, v]) => `${k}="${v}"`)
          .join(',');

        lines.push(`${metricName}{${labelsStr}} ${value.value} ${value.timestamp}`);
      }
    }

    return lines.join('\n');
  }

  /**
   * Get trace by ID
   */
  getTrace(traceId: string): TraceSpan[] | undefined {
    return this.traces.get(traceId);
  }

  /**
   * Get all traces
   */
  getAllTraces(): Map<string, TraceSpan[]> {
    return new Map(this.traces);
  }

  /**
   * Get metric aggregates
   */
  getMetricAggregates(metricName: string): {
    sum: number;
    count: number;
    min: number;
    max: number;
    average: number;
  } | null {
    const agg = this.metricAggregates.get(metricName);
    if (!agg) {
      return null;
    }

    return {
      ...agg,
      average: agg.count > 0 ? agg.sum / agg.count : 0
    };
  }

  /**
   * Export metrics for external systems
   */
  exportMetrics(format: 'prometheus' | 'json' = 'prometheus'): string | object {
    if (format === 'prometheus') {
      return this.getPrometheusMetrics();
    }

    const result: Record<string, MetricValue[]> = {};
    for (const [name, values] of this.metrics) {
      result[name] = values.slice(-100); // Last 100 values
    }
    return result;
  }

  // Private helper methods

  private updateAggregates(metricName: string, value: number): void {
    if (!this.metricAggregates.has(metricName)) {
      this.metricAggregates.set(metricName, {
        sum: 0,
        count: 0,
        min: Infinity,
        max: -Infinity,
        lastUpdated: Date.now()
      });
    }

    const agg = this.metricAggregates.get(metricName)!;
    agg.sum += value;
    agg.count++;
    agg.min = Math.min(agg.min, value);
    agg.max = Math.max(agg.max, value);
    agg.lastUpdated = Date.now();
  }

  private evaluateAlertCondition(condition: string): boolean {
    // Simplified condition evaluation
    // Real implementation would parse the condition and evaluate against metrics
    
    // Example: "cpu_usage > 80"
    const match = condition.match(/(\w+)\s*(>|<|>=|<=|==)\s*(\d+)/);
    if (!match) {
      return false;
    }

    const [, metricName, operator, threshold] = match;
    const agg = this.getMetricAggregates(metricName);
    
    if (!agg) {
      return false;
    }

    const value = agg.average;
    const thresholdNum = parseFloat(threshold);

    switch (operator) {
      case '>':
        return value > thresholdNum;
      case '<':
        return value < thresholdNum;
      case '>=':
        return value >= thresholdNum;
      case '<=':
        return value <= thresholdNum;
      case '==':
        return Math.abs(value - thresholdNum) < 0.001;
      default:
        return false;
    }
  }

  private triggerAlert(alert: AlertConfig): void {
    logger.warn('Alert triggered', {
      name: alert.name,
      severity: alert.severity,
      condition: alert.condition
    });

    // In production, this would call alert actions
    for (const action of alert.actions) {
      // Would make HTTP call or invoke handler
      logger.info('Executing alert action', { alert: alert.name, action });
    }
  }
}

// Global observability instance
export const observability = new ObservabilityManager();

