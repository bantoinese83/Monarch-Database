import { Document, SchemaDefinition, SchemaValidationResult } from './types';
import { logger } from './logger';

/**
 * Schema Validation Engine for Monarch Database
 * Provides JSON Schema-like validation with custom rules
 */
export class SchemaValidator {
  private schemas = new Map<string, SchemaDefinition>();

  /**
   * Register a schema for a collection
   */
  registerSchema(collectionName: string, schema: SchemaDefinition): void {
    this.schemas.set(collectionName, schema);
    logger.info('Schema registered', { collection: collectionName, fields: Object.keys(schema).length });
  }

  /**
   * Validate a document against its collection schema
   */
  validateDocument(collectionName: string, document: Document): SchemaValidationResult {
    const schema = this.schemas.get(collectionName);
    if (!schema) {
      return { valid: true, errors: [] }; // No schema = no validation
    }

    const errors: Array<{ field: string; value: any; message: string }> = [];

    // Validate all field definitions
    for (const [field, rules] of Object.entries(schema)) {
      const value = this.getNestedValue(document, field);
      const fieldErrors = this.validateField(field, value, rules);
      errors.push(...fieldErrors);
    }

    return {
      valid: errors.length === 0,
      errors
    };
  }

  /**
   * Update schema with evolution support
   */
  evolveSchema(collectionName: string, newSchema: SchemaDefinition, options: {
    allowBreakingChanges?: boolean;
    migrateExisting?: boolean;
  } = {}): boolean {
    const oldSchema = this.schemas.get(collectionName);

    if (!oldSchema) {
      this.registerSchema(collectionName, newSchema);
      return true;
    }

    // Check for breaking changes
    const breakingChanges = this.detectBreakingChanges(oldSchema, newSchema);

    if (breakingChanges.length > 0 && !options.allowBreakingChanges) {
      logger.error('Schema evolution blocked by breaking changes', {
        collection: collectionName,
        breakingChanges
      });
      return false;
    }

    // Apply evolution
    this.schemas.set(collectionName, newSchema);

    logger.info('Schema evolved', {
      collection: collectionName,
      breakingChanges: breakingChanges.length,
      allowed: options.allowBreakingChanges
    });

    return true;
  }

  /**
   * Get schema for a collection
   */
  getSchema(collectionName: string): SchemaDefinition | undefined {
    return this.schemas.get(collectionName);
  }

  /**
   * Remove schema for a collection
   */
  removeSchema(collectionName: string): boolean {
    return this.schemas.delete(collectionName);
  }

  /**
   * Generate schema from sample documents
   */
  generateSchemaFromDocuments(collectionName: string, documents: Document[]): SchemaDefinition {
    const schema: any = {};

    for (const doc of documents) {
      this.inferSchemaFromDocument(doc, schema, '');
    }

    this.schemas.set(collectionName, schema);
    logger.info('Schema generated from documents', {
      collection: collectionName,
      documents: documents.length,
      fields: Object.keys(schema).length
    });

    return schema;
  }

  /**
   * Validate schema definition itself
   */
  validateSchemaDefinition(schema: SchemaDefinition): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    for (const [field, rules] of Object.entries(schema)) {
      // Validate field name
      if (!field || typeof field !== 'string') {
        errors.push(`Invalid field name: ${field}`);
        continue;
      }

      // Validate rules
      if (!rules || typeof rules !== 'object') {
        errors.push(`Invalid rules for field ${field}`);
        continue;
      }

      // Check required properties
      if (rules.type && !this.isValidType(rules.type)) {
        errors.push(`Invalid type for field ${field}: ${rules.type}`);
      }

      // Validate constraints
      if (rules.min !== undefined && typeof rules.min !== 'number') {
        errors.push(`Invalid min constraint for field ${field}`);
      }

      if (rules.max !== undefined && typeof rules.max !== 'number') {
        errors.push(`Invalid max constraint for field ${field}`);
      }

      if (rules.pattern && !(rules.pattern instanceof RegExp)) {
        errors.push(`Invalid pattern for field ${field}`);
      }

      if (rules.custom && typeof rules.custom !== 'function') {
        errors.push(`Invalid custom validator for field ${field}`);
      }
    }

    return { valid: errors.length === 0, errors };
  }

  private validateField(field: string, value: any, rules: any): Array<{ field: string; value: any; message: string }> {
    const errors: Array<{ field: string; value: any; message: string }> = [];

    // Check required
    if (rules.required && (value === undefined || value === null)) {
      errors.push({ field, value, message: `Field '${field}' is required` });
      return errors; // Skip other validations if required field is missing
    }

    // Skip validation if value is undefined/null and field is not required
    if (value === undefined || value === null) {
      return errors;
    }

    // Type validation
    if (rules.type) {
      const actualType = this.getValueType(value);
      const expectedTypes = Array.isArray(rules.type) ? rules.type : [rules.type];

      if (!expectedTypes.some((type: string) => this.matchesType(actualType, type))) {
        errors.push({
          field,
          value,
          message: `Field '${field}' must be of type ${expectedTypes.join(' or ')}, got ${actualType}`
        });
      }
    }

    // Range validations
    if (typeof value === 'number') {
      if (rules.min !== undefined && value < rules.min) {
        errors.push({ field, value, message: `Field '${field}' must be >= ${rules.min}` });
      }
      if (rules.max !== undefined && value > rules.max) {
        errors.push({ field, value, message: `Field '${field}' must be <= ${rules.max}` });
      }
    }

    // String validations
    if (typeof value === 'string') {
      if (rules.min !== undefined && value.length < rules.min) {
        errors.push({ field, value, message: `Field '${field}' length must be >= ${rules.min}` });
      }
      if (rules.max !== undefined && value.length > rules.max) {
        errors.push({ field, value, message: `Field '${field}' length must be <= ${rules.max}` });
      }
      if (rules.pattern && !rules.pattern.test(value)) {
        errors.push({ field, value, message: `Field '${field}' does not match required pattern` });
      }
    }

    // Array validations
    if (Array.isArray(value)) {
      if (rules.min !== undefined && value.length < rules.min) {
        errors.push({ field, value, message: `Field '${field}' must have >= ${rules.min} items` });
      }
      if (rules.max !== undefined && value.length > rules.max) {
        errors.push({ field, value, message: `Field '${field}' must have <= ${rules.max} items` });
      }
    }

    // Enum validation
    if (rules.enum && Array.isArray(rules.enum)) {
      if (!rules.enum.includes(value)) {
        errors.push({ field, value, message: `Field '${field}' must be one of: ${rules.enum.join(', ')}` });
      }
    }

    // Custom validation
    if (rules.custom && typeof rules.custom === 'function') {
      try {
        const result = rules.custom(value);
        if (result !== true) {
          const message = typeof result === 'string' ? result : `Custom validation failed for field '${field}'`;
          errors.push({ field, value, message });
        }
      } catch (error) {
        errors.push({ field, value, message: `Custom validation error for field '${field}': ${(error as Error).message}` });
      }
    }

    return errors;
  }

  private detectBreakingChanges(oldSchema: SchemaDefinition, newSchema: SchemaDefinition): string[] {
    const breakingChanges: string[] = [];

    // Check for removed required fields
    for (const [field, oldRules] of Object.entries(oldSchema)) {
      const newRules = newSchema[field];

      if (oldRules.required && (!newRules || !newRules.required)) {
        breakingChanges.push(`Required field '${field}' was made optional or removed`);
      }

      // Check for type changes
      if (newRules && oldRules.type !== newRules.type) {
        breakingChanges.push(`Type of field '${field}' changed from ${oldRules.type} to ${newRules.type}`);
      }
    }

    return breakingChanges;
  }

  private inferSchemaFromDocument(doc: Document, schema: any, prefix: string): void {
    for (const [key, value] of Object.entries(doc)) {
      const fullPath = prefix ? `${prefix}.${key}` : key;

      if (value === null || value === undefined) continue;

      if (!schema[fullPath]) {
        schema[fullPath] = { type: this.inferType(value) };
      }

      // Handle nested objects
      if (typeof value === 'object' && !Array.isArray(value) && value !== null) {
        this.inferSchemaFromDocument(value, schema, fullPath);
      }

      // Handle arrays
      if (Array.isArray(value) && value.length > 0) {
        const itemType = this.inferType(value[0]);
        if (typeof value[0] === 'object' && !Array.isArray(value[0]) && value[0] !== null) {
          this.inferSchemaFromDocument(value[0], schema, `${fullPath}.$`);
        } else {
          (schema[fullPath] as any).type = [itemType];
        }
      }
    }
  }

  private inferType(value: any): string | string[] {
    if (value === null) return 'null';
    if (Array.isArray(value)) return 'array';
    if (value instanceof Date) return 'date';
    if (value instanceof RegExp) return 'regex';

    const type = typeof value;
    if (type === 'number') {
      return Number.isInteger(value) ? 'integer' : 'number';
    }

    return type;
  }

  private isValidType(type: string | string[]): boolean {
    const validTypes = ['string', 'number', 'integer', 'boolean', 'object', 'array', 'date', 'null', 'regex'];
    if (Array.isArray(type)) {
      return type.every(t => validTypes.includes(t));
    }
    return validTypes.includes(type);
  }

  private matchesType(actualType: string, expectedType: string): boolean {
    // Handle type aliases
    switch (expectedType) {
      case 'int':
      case 'integer':
        return actualType === 'number' && Number.isInteger(actualType as any);
      case 'double':
      case 'float':
        return actualType === 'number';
      case 'bool':
        return actualType === 'boolean';
      default:
        return actualType === expectedType;
    }
  }

  private getValueType(value: any): string {
    if (value === null) return 'null';
    if (Array.isArray(value)) return 'array';
    if (value instanceof Date) return 'date';
    if (value instanceof RegExp) return 'regex';
    return typeof value;
  }

  private getNestedValue(obj: any, path: string): any {
    return path.split('.').reduce((current, key) => current?.[key], obj);
  }
}