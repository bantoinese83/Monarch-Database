import { QueryProfile, QueryHint } from './types';
import { logger } from './logger';

/**
 * Query Profiler and Optimization Engine
 * Analyzes query performance and provides optimization hints
 */
export class QueryProfiler {
  private profiles: QueryProfile[] = [];
  private maxProfiles = 1000;

  /**
   * Profile a query execution
   */
  profileQuery(query: any, executionTime: number, documentsExamined: number, documentsReturned: number): QueryProfile {
    const indexesUsed: string[] = this.analyzeIndexUsage(query);
    const optimizationHints: string[] = this.generateOptimizationHints(query, executionTime, documentsExamined, documentsReturned);

    const profile: QueryProfile = {
      query,
      executionTime,
      documentsExamined,
      documentsReturned,
      indexesUsed,
      optimizationHints,
      timestamp: new Date()
    };

    // Keep only recent profiles
    this.profiles.push(profile);
    if (this.profiles.length > this.maxProfiles) {
      this.profiles.shift();
    }

    logger.debug('Query profiled', {
      executionTime,
      documentsExamined,
      documentsReturned,
      indexesUsed: indexesUsed.length,
      hints: optimizationHints.length
    });

    return profile;
  }

  /**
   * Get query optimization hints for a query
   */
  getOptimizationHints(query: any): QueryHint[] {
    const hints: QueryHint[] = [];

    // Analyze query structure
    const queryKeys = Object.keys(query);
    const hasIndexedFields = this.checkForIndexedFields(queryKeys);

    if (queryKeys.length === 0) {
      hints.push({
        strategy: 'scan',
        estimatedCost: 100,
        actualCost: 0
      });
    } else if (hasIndexedFields.fullyIndexed) {
      hints.push({
        strategy: 'index',
        indexName: hasIndexedFields.indexName,
        estimatedCost: 10,
        actualCost: 0
      });
    } else if (hasIndexedFields.partiallyIndexed) {
      hints.push({
        strategy: 'index',
        indexName: hasIndexedFields.indexName,
        estimatedCost: 50,
        actualCost: 0
      });
    } else {
      hints.push({
        strategy: 'scan',
        estimatedCost: 100,
        actualCost: 0
      });
    }

    // Check for inefficient patterns
    if (this.hasRegexOnUnindexedField(query)) {
      hints.push({
        strategy: 'scan',
        estimatedCost: 200,
        actualCost: 0
      });
    }

    if (this.hasLargeInClause(query)) {
      hints.push({
        strategy: 'scan',
        estimatedCost: 150,
        actualCost: 0
      });
    }

    return hints;
  }

  /**
   * Get recent query profiles
   */
  getRecentProfiles(limit: number = 50): QueryProfile[] {
    return this.profiles.slice(-limit);
  }

  /**
   * Get slow queries
   */
  getSlowQueries(thresholdMs: number = 100): QueryProfile[] {
    return this.profiles.filter(profile => profile.executionTime > thresholdMs);
  }

  /**
   * Analyze query patterns and suggest indexes
   */
  suggestIndexes(): Array<{ fields: string[]; reason: string; impact: 'high' | 'medium' | 'low' }> {
    const suggestions: Array<{ fields: string[]; reason: string; impact: 'high' | 'medium' | 'low' }> = [];
    const queryPatterns = this.analyzeQueryPatterns();

    // Suggest indexes for frequently queried fields
    for (const [field, frequency] of Object.entries(queryPatterns)) {
      if (frequency > 10) { // Queried more than 10 times
        suggestions.push({
          fields: [field],
          reason: `Field '${field}' is queried ${frequency} times`,
          impact: 'high'
        });
      }
    }

    // Suggest compound indexes for multi-field queries
    const multiFieldQueries = this.profiles.filter(p =>
      Object.keys(p.query).length > 1 && p.executionTime > 50
    );

    if (multiFieldQueries.length > 5) {
      const commonFields = this.findCommonQueryFields(multiFieldQueries);
      if (commonFields.length > 1) {
        suggestions.push({
          fields: commonFields,
          reason: `Compound index on ${commonFields.join(', ')} would optimize ${multiFieldQueries.length} slow queries`,
          impact: 'high'
        });
      }
    }

    return suggestions;
  }

  /**
   * Clear all profiles
   */
  clearProfiles(): void {
    this.profiles = [];
    logger.info('Query profiles cleared');
  }

  private analyzeIndexUsage(query: any): string[] {
    // This would integrate with the actual indexing system
    // For now, return mock data
    const indexesUsed: string[] = [];

    if (Object.keys(query).length > 0) {
      indexesUsed.push('default_index');
    }

    return indexesUsed;
  }

  private generateOptimizationHints(query: any, executionTime: number, documentsExamined: number, documentsReturned: number): string[] {
    const hints: string[] = [];

    // Analyze query efficiency
    const selectivity = documentsReturned / Math.max(documentsExamined, 1);

    if (selectivity < 0.1 && documentsExamined > 1000) {
      hints.push('Consider adding an index on frequently queried fields');
    }

    if (executionTime > 1000) {
      hints.push('Query is running slow - consider optimizing or adding indexes');
    }

    if (documentsExamined > documentsReturned * 100) {
      hints.push('Query is examining many documents but returning few - index may help');
    }

    // Check for specific inefficient patterns
    if (this.hasRegexOnUnindexedField(query)) {
      hints.push('Regex queries on unindexed fields are expensive');
    }

    if (this.hasLargeInClause(query)) {
      hints.push('Large $in clauses may benefit from different query structure');
    }

    if (this.hasNestedArrayQueries(query)) {
      hints.push('Nested array queries can be expensive - consider restructuring data');
    }

    return hints;
  }

  private checkForIndexedFields(queryKeys: string[]): { fullyIndexed: boolean; partiallyIndexed: boolean; indexName?: string } {
    // Mock implementation - would check actual index catalog
    const indexedFields = ['_id', 'name', 'email', 'status']; // Mock indexed fields

    const indexedQueryKeys = queryKeys.filter(key => indexedFields.includes(key));

    return {
      fullyIndexed: indexedQueryKeys.length === queryKeys.length && queryKeys.length > 0,
      partiallyIndexed: indexedQueryKeys.length > 0,
      indexName: indexedQueryKeys.length > 0 ? `idx_${indexedQueryKeys.join('_')}` : undefined
    };
  }

  private hasRegexOnUnindexedField(query: any): boolean {
    for (const [field, condition] of Object.entries(query)) {
      if (typeof condition === 'object' && condition !== null && '$regex' in condition) {
        // Check if field is indexed - mock implementation
        const indexedFields = ['_id', 'name', 'email'];
        if (!indexedFields.includes(field)) {
          return true;
        }
      }
    }
    return false;
  }

  private hasLargeInClause(query: any): boolean {
    for (const condition of Object.values(query)) {
      if (typeof condition === 'object' && condition !== null && '$in' in condition) {
        const values = condition.$in;
        if (Array.isArray(values) && values.length > 50) {
          return true;
        }
      }
    }
    return false;
  }

  private hasNestedArrayQueries(query: any): boolean {
    // Check for queries on nested arrays like 'tags.0' or 'comments.author'
    const queryString = JSON.stringify(query);
    return /\$\[\]|\.\d+|\.author|\.name|\.id/.test(queryString);
  }

  private analyzeQueryPatterns(): Record<string, number> {
    const patterns: Record<string, number> = {};

    for (const profile of this.profiles) {
      for (const field of Object.keys(profile.query)) {
        patterns[field] = (patterns[field] || 0) + 1;
      }
    }

    return patterns;
  }

  private findCommonQueryFields(profiles: QueryProfile[]): string[] {
    const fieldCounts: Record<string, number> = {};

    for (const profile of profiles) {
      for (const field of Object.keys(profile.query)) {
        fieldCounts[field] = (fieldCounts[field] || 0) + 1;
      }
    }

    // Return fields that appear in more than 50% of queries
    const threshold = profiles.length * 0.5;
    return Object.entries(fieldCounts)
      .filter(([, count]) => count > threshold)
      .map(([field]) => field)
      .sort();
  }
}
