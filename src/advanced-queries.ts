import { Document } from './types';
import { logger } from './logger';

/**
 * Advanced Query Operators Engine
 * Implements MongoDB-style query operators
 */
export class AdvancedQueryEngine {
  /**
   * Execute query with advanced operators
   */
  static executeAdvancedQuery(documents: Document[], query: any): Document[] {
    return documents.filter(doc => this.matchesAdvancedQuery(doc, query));
  }

  private static matchesAdvancedQuery(doc: Document, query: any): boolean {
    for (const [field, condition] of Object.entries(query)) {
      if (!this.evaluateCondition(doc, field, condition)) {
        return false;
      }
    }
    return true;
  }

  private static evaluateCondition(doc: Document, field: string, condition: any): boolean {
    const value = this.getNestedValue(doc, field);

    if (typeof condition === 'object' && condition !== null) {
      // Handle operator conditions
      for (const [operator, operand] of Object.entries(condition)) {
        if (!this.evaluateOperator(value, operator, operand)) {
          return false;
        }
      }
    } else {
      // Direct equality match
      return this.deepEqual(value, condition);
    }

    return true;
  }

  private static evaluateOperator(value: any, operator: string, operand: any): boolean {
    switch (operator) {
      case '$eq':
        return this.deepEqual(value, operand);

      case '$ne':
        return !this.deepEqual(value, operand);

      case '$gt':
        return value > operand;

      case '$gte':
        return value >= operand;

      case '$lt':
        return value < operand;

      case '$lte':
        return value <= operand;

      case '$in':
        if (!Array.isArray(operand)) return false;
        return operand.some(item => this.deepEqual(value, item));

      case '$nin':
        if (!Array.isArray(operand)) return false;
        return !operand.some(item => this.deepEqual(value, item));

      case '$exists':
        return (value !== undefined) === operand;

      case '$type':
        return this.checkType(value, operand);

      case '$regex':
        if (!(operand instanceof RegExp)) return false;
        return operand.test(String(value));

      case '$size':
        if (!Array.isArray(value)) return false;
        return value.length === operand;

      case '$all':
        if (!Array.isArray(value) || !Array.isArray(operand)) return false;
        return operand.every(item => value.some(v => this.deepEqual(v, item)));

      case '$elemMatch':
        if (!Array.isArray(value)) return false;
        return value.some(item => this.matchesAdvancedQuery(item, operand));

      case '$and':
        if (!Array.isArray(operand)) return false;
        return operand.every(cond => this.matchesAdvancedQuery(value, cond));

      case '$or':
        if (!Array.isArray(operand)) return false;
        return operand.some(cond => this.matchesAdvancedQuery(value, cond));

      case '$not':
        return !this.evaluateCondition(value, '$not', operand);

      case '$nor':
        if (!Array.isArray(operand)) return false;
        return !operand.some(cond => this.matchesAdvancedQuery(value, cond));

      case '$mod':
        if (!Array.isArray(operand) || operand.length !== 2) return false;
        const [divisor, remainder] = operand;
        return Number(value) % divisor === remainder;

      case '$where':
        if (typeof operand === 'string') {
          try {
            // Create a function from the string with 'this' bound to the document
            const func = new Function('return ' + operand);
            return func.call(doc);
          } catch (error) {
            logger.warn('$where evaluation failed', { error: (error as Error).message });
            return false;
          }
        } else if (typeof operand === 'function') {
          try {
            return operand.call(doc);
          } catch (error) {
            logger.warn('$where function failed', { error: (error as Error).message });
            return false;
          }
        }
        return false;

      case '$text':
        // Simplified text search - in production would integrate with full-text search
        if (typeof operand === 'object' && operand.$search) {
          const searchTerm = operand.$search.toLowerCase();
          const fieldValue = String(value).toLowerCase();
          return fieldValue.includes(searchTerm);
        }
        return false;

      case '$bitsAllSet':
        if (typeof value !== 'number' || !Array.isArray(operand)) return false;
        return operand.every(bit => (value & (1 << bit)) !== 0);

      case '$bitsAllClear':
        if (typeof value !== 'number' || !Array.isArray(operand)) return false;
        return operand.every(bit => (value & (1 << bit)) === 0);

      case '$bitsAnySet':
        if (typeof value !== 'number' || !Array.isArray(operand)) return false;
        return operand.some(bit => (value & (1 << bit)) !== 0);

      case '$bitsAnyClear':
        if (typeof value !== 'number' || !Array.isArray(operand)) return false;
        return operand.some(bit => (value & (1 << bit)) === 0);

      case '$jsonSchema':
        // Simplified JSON Schema validation - in production would use a full validator
        if (typeof operand === 'object' && operand.properties) {
          for (const [prop, schema] of Object.entries(operand.properties)) {
            const propValue = (doc as any)[prop];
            if (schema.required && (propValue === undefined || propValue === null)) {
              return false;
            }
            if (schema.type && typeof propValue !== schema.type) {
              return false;
            }
          }
          return true;
        }
        return false;

      case '$expr':
        // Expression evaluation - simplified version
        try {
          return this.evaluateExpression(doc, operand);
        } catch (error) {
          logger.warn('$expr evaluation failed', { error: (error as Error).message });
          return false;
        }

      default:
        logger.warn('Unknown query operator', { operator });
        return false;
    }
  }

  private static checkType(value: any, expectedType: string | string[]): boolean {
    const actualType = this.getValueType(value);

    if (Array.isArray(expectedType)) {
      return expectedType.includes(actualType);
    }

    return actualType === expectedType;
  }

  private static getValueType(value: any): string {
    if (value === null) return 'null';
    if (Array.isArray(value)) return 'array';
    if (value instanceof Date) return 'date';
    if (value instanceof RegExp) return 'regex';

    const type = typeof value;
    switch (type) {
      case 'number':
        return Number.isInteger(value) ? 'int' : 'double';
      case 'string':
        return 'string';
      case 'boolean':
        return 'bool';
      case 'object':
        return 'object';
      default:
        return type;
    }
  }

  private static deepEqual(a: any, b: any): boolean {
    if (a === b) return true;

    if (a == null || b == null) return a === b;

    if (Array.isArray(a) && Array.isArray(b)) {
      if (a.length !== b.length) return false;
      for (let i = 0; i < a.length; i++) {
        if (!this.deepEqual(a[i], b[i])) return false;
      }
      return true;
    }

    if (typeof a === 'object' && typeof b === 'object') {
      const keysA = Object.keys(a);
      const keysB = Object.keys(b);

      if (keysA.length !== keysB.length) return false;

      for (const key of keysA) {
        if (!(key in b)) return false;
        if (!this.deepEqual(a[key], b[key])) return false;
      }

      return true;
    }

    return false;
  }

  private static evaluateExpression(doc: Document, expression: any): any {
    if (typeof expression === 'string' && expression.startsWith('$')) {
      return this.getNestedValue(doc, expression.substring(1));
    }

    if (typeof expression === 'object' && expression !== null) {
      // Handle expression operators
      if (expression.$eq) return this.evaluateExpression(doc, expression.$eq);
      if (expression.$ne) return !this.deepEqual(this.evaluateExpression(doc, expression.$ne), true);
      if (expression.$gt) return this.evaluateExpression(doc, expression.$gt[0]) > this.evaluateExpression(doc, expression.$gt[1]);
      if (expression.$gte) return this.evaluateExpression(doc, expression.$gte[0]) >= this.evaluateExpression(doc, expression.$gte[1]);
      if (expression.$lt) return this.evaluateExpression(doc, expression.$lt[0]) < this.evaluateExpression(doc, expression.$lt[1]);
      if (expression.$lte) return this.evaluateExpression(doc, expression.$lte[0]) <= this.evaluateExpression(doc, expression.$lte[1]);
      if (expression.$add) return expression.$add.reduce((sum: number, expr: any) => sum + this.evaluateExpression(doc, expr), 0);
      if (expression.$subtract) return this.evaluateExpression(doc, expression.$subtract[0]) - this.evaluateExpression(doc, expression.$subtract[1]);
      if (expression.$multiply) return expression.$multiply.reduce((product: number, expr: any) => product * this.evaluateExpression(doc, expr), 1);
      if (expression.$divide) return this.evaluateExpression(doc, expression.$divide[0]) / this.evaluateExpression(doc, expression.$divide[1]);
      if (expression.$mod) return this.evaluateExpression(doc, expression.$mod[0]) % this.evaluateExpression(doc, expression.$mod[1]);
      if (expression.$cond) {
        const [condition, trueExpr, falseExpr] = expression.$cond;
        return this.evaluateExpression(doc, condition) ? this.evaluateExpression(doc, trueExpr) : this.evaluateExpression(doc, falseExpr);
      }
    }

    return expression;
  }

  private static getNestedValue(obj: any, path: string): any {
    if (!path) return obj;

    const parts = path.split('.');
    let current = obj;

    for (const part of parts) {
      if (current == null) return undefined;

      // Handle array indexing
      if (Array.isArray(current) && /^\d+$/.test(part)) {
        const index = parseInt(part, 10);
        current = current[index];
      } else if (typeof current === 'object') {
        current = current[part];
      } else {
        return undefined;
      }
    }

    return current;
  }
}

/**
 * Query Builder for fluent query construction
 */
export class QueryBuilder {
  private conditions: any = {};

  /**
   * Add equality condition
   */
  where(field: string, value: any): this {
    this.conditions[field] = value;
    return this;
  }

  /**
   * Add greater than condition
   */
  gt(field: string, value: any): this {
    this.conditions[field] = { ...this.conditions[field], $gt: value };
    return this;
  }

  /**
   * Add greater than or equal condition
   */
  gte(field: string, value: any): this {
    this.conditions[field] = { ...this.conditions[field], $gte: value };
    return this;
  }

  /**
   * Add less than condition
   */
  lt(field: string, value: any): this {
    this.conditions[field] = { ...this.conditions[field], $lt: value };
    return this;
  }

  /**
   * Add less than or equal condition
   */
  lte(field: string, value: any): this {
    this.conditions[field] = { ...this.conditions[field], $lte: value };
    return this;
  }

  /**
   * Add in condition
   */
  in(field: string, values: any[]): this {
    this.conditions[field] = { ...this.conditions[field], $in: values };
    return this;
  }

  /**
   * Add not in condition
   */
  nin(field: string, values: any[]): this {
    this.conditions[field] = { ...this.conditions[field], $nin: values };
    return this;
  }

  /**
   * Add regex condition
   */
  regex(field: string, pattern: RegExp): this {
    this.conditions[field] = { ...this.conditions[field], $regex: pattern };
    return this;
  }

  /**
   * Add exists condition
   */
  exists(field: string, exists: boolean = true): this {
    this.conditions[field] = { ...this.conditions[field], $exists: exists };
    return this;
  }

  /**
   * Add type condition
   */
  type(field: string, type: string): this {
    this.conditions[field] = { ...this.conditions[field], $type: type };
    return this;
  }

  /**
   * Add AND condition
   */
  and(conditions: any[]): this {
    this.conditions.$and = conditions;
    return this;
  }

  /**
   * Add OR condition
   */
  or(conditions: any[]): this {
    this.conditions.$or = conditions;
    return this;
  }

  /**
   * Add NOT condition
   */
  not(condition: any): this {
    this.conditions.$not = condition;
    return this;
  }

  /**
   * Build the final query object
   */
  build(): any {
    return { ...this.conditions };
  }

  /**
   * Reset the builder
   */
  reset(): this {
    this.conditions = {};
    return this;
  }
}
