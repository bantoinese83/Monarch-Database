import { Document, AggregationPipeline, AggregationStage, AggregationResult, GroupStage, LookupStage } from './types';
import { logger } from './logger';

/**
 * Aggregation Engine for Monarch Database
 * Implements MongoDB-style aggregation pipelines
 */
export class AggregationEngine {
  /**
   * Execute an aggregation pipeline on a collection of documents
   */
  static async execute(
    documents: Document[],
    pipeline: AggregationPipeline
  ): Promise<AggregationResult> {
    const startTime = performance.now();
    let result = [...documents];
    let stagesExecuted = 0;
    let documentsProcessed = documents.length;

    try {
      for (const stage of pipeline.stages) {
        result = this.executeStage(result, stage);
        stagesExecuted++;
        documentsProcessed = Math.max(documentsProcessed, result.length);
      }

      const executionTime = performance.now() - startTime;

      logger.info('Aggregation pipeline executed', {
        stagesExecuted,
        inputDocuments: documents.length,
        outputDocuments: result.length,
        executionTime: `${executionTime.toFixed(2)}ms`
      });

      return {
        documents: result,
        executionTime,
        stagesExecuted,
        documentsProcessed
      };
    } catch (error) {
      const executionTime = performance.now() - startTime;
      logger.error('Aggregation pipeline failed', { error: (error as Error).message, stagesExecuted });
      throw error;
    }
  }

  private static executeStage(documents: Document[], stage: AggregationStage): Document[] {
    if ('$match' in stage) {
      return this.executeMatchStage(documents, stage.$match);
    }
    if ('$group' in stage) {
      return this.executeGroupStage(documents, stage.$group);
    }
    if ('$sort' in stage) {
      return this.executeSortStage(documents, stage.$sort);
    }
    if ('$limit' in stage) {
      return this.executeLimitStage(documents, stage.$limit);
    }
    if ('$skip' in stage) {
      return this.executeSkipStage(documents, stage.$skip);
    }
    if ('$project' in stage) {
      return this.executeProjectStage(documents, stage.$project);
    }
    if ('$unwind' in stage) {
      return this.executeUnwindStage(documents, stage.$unwind);
    }
    if ('$addFields' in stage) {
      return this.executeAddFieldsStage(documents, stage.$addFields);
    }
    if ('$replaceRoot' in stage) {
      return this.executeReplaceRootStage(documents, stage.$replaceRoot);
    }

    throw new Error(`Unsupported aggregation stage: ${Object.keys(stage)[0]}`);
  }

  private static executeMatchStage(documents: Document[], query: any): Document[] {
    // Simple filtering - in a real implementation, this would use the query engine
    return documents.filter(doc => this.matchesQuery(doc, query));
  }

  private static executeGroupStage(documents: Document[], group: GroupStage): Document[] {
    const groups = new Map<string, any>();

    for (const doc of documents) {
      const groupKey = this.evaluateExpression(doc, group._id);
      const key = JSON.stringify(groupKey);

      if (!groups.has(key)) {
        const groupDoc: any = { _id: groupKey };
        // Initialize accumulators
        for (const [field, accumulator] of Object.entries(group)) {
          if (field !== '_id') {
            groupDoc[field] = this.initializeAccumulator(accumulator);
          }
        }
        groups.set(key, groupDoc);
      }

      const groupDoc = groups.get(key)!;

      // Apply accumulators
      for (const [field, accumulator] of Object.entries(group)) {
        if (field !== '_id') {
          this.applyAccumulator(groupDoc, field, accumulator, doc);
        }
      }
    }

    return Array.from(groups.values());
  }

  private static executeSortStage(documents: Document[], sortSpec: Record<string, 1 | -1>): Document[] {
    return [...documents].sort((a, b) => {
      for (const [field, direction] of Object.entries(sortSpec)) {
        const aVal = this.getNestedValue(a, field);
        const bVal = this.getNestedValue(b, field);

        let cmp = 0;
        if (aVal < bVal) cmp = -1;
        else if (aVal > bVal) cmp = 1;

        if (cmp !== 0) {
          return direction === 1 ? cmp : -cmp;
        }
      }
      return 0;
    });
  }

  private static executeLimitStage(documents: Document[], limit: number): Document[] {
    return documents.slice(0, limit);
  }

  private static executeSkipStage(documents: Document[], skip: number): Document[] {
    return documents.slice(skip);
  }

  private static executeProjectStage(documents: Document[], projection: Record<string, any>): Document[] {
    return documents.map(doc => {
      const projected: any = {};

      for (const [field, spec] of Object.entries(projection)) {
        if (spec === 1 || spec === true) {
          projected[field] = this.getNestedValue(doc, field);
        } else if (spec === 0 || spec === false) {
          // Exclude field - handled by only including specified fields
        } else if (typeof spec === 'object') {
          projected[field] = this.evaluateExpression(doc, spec);
        }
      }

      return projected;
    });
  }

  private static executeUnwindStage(documents: Document[], unwindSpec: string | { path: string; preserveNullAndEmptyArrays?: boolean }): Document[] {
    const path = typeof unwindSpec === 'string' ? unwindSpec : unwindSpec.path;
    const preserveNullAndEmptyArrays = typeof unwindSpec === 'object' ? unwindSpec.preserveNullAndEmptyArrays : false;

    const result: Document[] = [];

    for (const doc of documents) {
      const array = this.getNestedValue(doc, path.substring(1)); // Remove leading $

      if (!Array.isArray(array)) {
        if (preserveNullAndEmptyArrays) {
          result.push({ ...doc });
        }
        continue;
      }

      if (array.length === 0) {
        if (preserveNullAndEmptyArrays) {
          result.push({ ...doc });
        }
        continue;
      }

      for (const item of array) {
        const unwoundDoc = { ...doc };
        this.setNestedValue(unwoundDoc, path.substring(1), item);
        result.push(unwoundDoc);
      }
    }

    return result;
  }

  private static executeAddFieldsStage(documents: Document[], fields: Record<string, any>): Document[] {
    return documents.map(doc => {
      const newDoc = { ...doc };
      for (const [field, expression] of Object.entries(fields)) {
        this.setNestedValue(newDoc, field, this.evaluateExpression(doc, expression));
      }
      return newDoc;
    });
  }

  private static executeReplaceRootStage(documents: Document[], replaceSpec: { newRoot: any }): Document[] {
    return documents.map(doc => this.evaluateExpression(doc, replaceSpec.newRoot));
  }

  // Helper methods
  private static matchesQuery(doc: Document, query: any): boolean {
    // Simple query matching - in a real implementation, this would be more sophisticated
    for (const [field, condition] of Object.entries(query)) {
      const value = this.getNestedValue(doc, field);
      if (typeof condition === 'object' && condition !== null) {
        for (const [operator, operand] of Object.entries(condition)) {
          switch (operator) {
            case '$eq':
              if (value !== operand) return false;
              break;
            case '$ne':
              if (value === operand) return false;
              break;
            case '$gt':
              if (!(value > operand)) return false;
              break;
            case '$gte':
              if (!(value >= operand)) return false;
              break;
            case '$lt':
              if (!(value < operand)) return false;
              break;
            case '$lte':
              if (!(value <= operand)) return false;
              break;
            default:
              // For now, assume exact match
              if (value !== condition) return false;
          }
        }
      } else {
        if (value !== condition) return false;
      }
    }
    return true;
  }

  private static evaluateExpression(doc: Document, expression: any): any {
    if (typeof expression === 'string' && expression.startsWith('$')) {
      return this.getNestedValue(doc, expression.substring(1));
    }
    if (typeof expression === 'object' && expression !== null) {
      const result: any = {};
      for (const [key, value] of Object.entries(expression)) {
        result[key] = this.evaluateExpression(doc, value);
      }
      return result;
    }
    return expression;
  }

  private static initializeAccumulator(accumulator: any): any {
    if (typeof accumulator === 'string') {
      switch (accumulator) {
        case '$sum': return 0;
        case '$count': return 0;
        case '$avg': return { sum: 0, count: 0 };
        case '$min': return Infinity;
        case '$max': return -Infinity;
        case '$first': return null;
        case '$last': return null;
        case '$push': return [];
        case '$addToSet': return new Set();
      }
    }
    if (typeof accumulator === 'object' && accumulator !== null) {
      // Handle accumulator objects like { $sum: '$field' }
      for (const [op, field] of Object.entries(accumulator)) {
        return this.initializeAccumulator(op);
      }
    }
    return accumulator;
  }

  private static applyAccumulator(groupDoc: any, field: string, accumulator: any, doc: Document): void {
    const value = typeof accumulator === 'string' && accumulator.startsWith('$')
      ? this.getNestedValue(doc, accumulator.substring(1))
      : accumulator;

    switch (accumulator) {
      case '$sum':
        groupDoc[field] += value || 0;
        break;
      case '$count':
        groupDoc[field]++;
        break;
      case '$avg':
        groupDoc[field].sum += value || 0;
        groupDoc[field].count++;
        break;
      case '$min':
        groupDoc[field] = Math.min(groupDoc[field], value);
        break;
      case '$max':
        groupDoc[field] = Math.max(groupDoc[field], value);
        break;
      case '$first':
        if (groupDoc[field] === null) groupDoc[field] = value;
        break;
      case '$last':
        groupDoc[field] = value;
        break;
      case '$push':
        groupDoc[field].push(value);
        break;
      case '$addToSet':
        groupDoc[field].add(value);
        break;
    }
  }

  private static getNestedValue(obj: any, path: string): any {
    return path.split('.').reduce((current, key) => current?.[key], obj);
  }

  private static setNestedValue(obj: any, path: string, value: any): void {
    const keys = path.split('.');
    const lastKey = keys.pop()!;
    const target = keys.reduce((current, key) => {
      if (!(key in current) || typeof current[key] !== 'object' || current[key] === null) {
        current[key] = {};
      }
      return current[key];
    }, obj);
    target[lastKey] = value;
  }
}
