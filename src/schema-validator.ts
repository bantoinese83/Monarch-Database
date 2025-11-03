import { SchemaDefinition, SchemaProperty, Document } from './types';

export class SchemaValidator {
  private ajv: any = null;

  constructor() {
    // Try to use ajv if available, otherwise use basic validation
    try {
      this.ajv = new (require('ajv'))();
    } catch {
      // ajv not available, will use basic validation
      this.ajv = null;
    }
  }

  /**
   * Validate a document against a schema
   */
  validate(document: Document, schema: SchemaDefinition): { valid: boolean; errors?: string[] } {
    if (this.ajv) {
      return this.validateWithAjv(document, schema);
    } else {
      return this.validateBasic(document, schema);
    }
  }

  /**
   * Validate using AJV (if available)
   */
  private validateWithAjv(document: Document, schema: SchemaDefinition): { valid: boolean; errors?: string[] } {
    try {
      const validate = this.ajv.compile(schema);
      const valid = validate(document);

      if (valid) {
        return { valid: true };
      } else {
        return {
          valid: false,
          errors: validate.errors.map((error: any) => `${error.instancePath} ${error.message}`)
        };
      }
    } catch (error) {
      return {
        valid: false,
        errors: [`Schema compilation error: ${error instanceof Error ? error.message : String(error)}`]
      };
    }
  }

  /**
   * Basic validation without AJV
   */
  private validateBasic(document: Document, schema: SchemaDefinition): { valid: boolean; errors?: string[] } {
    const errors: string[] = [];

    // Check if document is an object
    if (!document || typeof document !== 'object' || Array.isArray(document)) {
      errors.push('Document must be an object');
      return { valid: false, errors };
    }

    // Validate required properties
    if (schema.required) {
      for (const requiredProp of schema.required) {
        if (!(requiredProp in document)) {
          errors.push(`Missing required property: ${requiredProp}`);
        }
      }
    }

    // Validate properties
    if (schema.properties) {
      for (const [propName, propSchema] of Object.entries(schema.properties)) {
        if (propName in document) {
          const propErrors = this.validateProperty(document[propName], propSchema, propName);
          errors.push(...propErrors);
        }
      }
    }

    // Check additional properties
    if (schema.additionalProperties === false && schema.properties) {
      const allowedProps = new Set(Object.keys(schema.properties));
      for (const propName of Object.keys(document)) {
        if (propName !== '_id' && !allowedProps.has(propName)) {
          errors.push(`Additional property not allowed: ${propName}`);
        }
      }
    }

    return {
      valid: errors.length === 0,
      errors: errors.length > 0 ? errors : undefined
    };
  }

  /**
   * Validate a single property
   */
  private validateProperty(value: any, schema: SchemaProperty, path: string): string[] {
    const errors: string[] = [];

    // Type validation
    if (schema.type) {
      const types = Array.isArray(schema.type) ? schema.type : [schema.type];
      const valueType = this.getValueType(value);

      if (!types.includes(valueType)) {
        errors.push(`${path} must be of type ${types.join(' or ')}, got ${valueType}`);
      }
    }

    // String validations
    if (typeof value === 'string') {
      if (schema.minLength !== undefined && value.length < schema.minLength) {
        errors.push(`${path} must be at least ${schema.minLength} characters long`);
      }
      if (schema.maxLength !== undefined && value.length > schema.maxLength) {
        errors.push(`${path} must be at most ${schema.maxLength} characters long`);
      }
      if (schema.pattern && !new RegExp(schema.pattern).test(value)) {
        errors.push(`${path} must match pattern ${schema.pattern}`);
      }
    }

    // Number validations
    if (typeof value === 'number') {
      if (schema.minimum !== undefined && value < schema.minimum) {
        errors.push(`${path} must be at least ${schema.minimum}`);
      }
      if (schema.maximum !== undefined && value > schema.maximum) {
        errors.push(`${path} must be at most ${schema.maximum}`);
      }
    }

    // Array validations
    if (Array.isArray(value) && schema.items) {
      for (let i = 0; i < value.length; i++) {
        const itemErrors = this.validateProperty(value[i], schema.items, `${path}[${i}]`);
        errors.push(...itemErrors);
      }
    }

    // Object validations
    if (value && typeof value === 'object' && !Array.isArray(value) && schema.properties) {
      const objErrors = this.validateBasic(value, {
        type: 'object',
        properties: schema.properties,
        required: schema.required,
        additionalProperties: schema.additionalProperties
      });
      if (objErrors.errors) {
        errors.push(...objErrors.errors.map(err => `${path}.${err}`));
      }
    }

    // Enum validation
    if (schema.enum && !schema.enum.includes(value)) {
      errors.push(`${path} must be one of: ${schema.enum.join(', ')}`);
    }

    return errors;
  }

  /**
   * Get the JSON schema type of a value
   */
  private getValueType(value: any): string {
    if (value === null) return 'null';
    if (Array.isArray(value)) return 'array';
    return typeof value;
  }

  /**
   * Compile a schema for repeated use (if using AJV)
   */
  compile(schema: SchemaDefinition): (document: Document) => { valid: boolean; errors?: string[] } {
    if (this.ajv) {
      const validate = this.ajv.compile(schema);
      return (document: Document) => {
        const valid = validate(document);
        return valid ? { valid: true } : {
          valid: false,
          errors: validate.errors.map((error: any) => `${error.instancePath} ${error.message}`)
        };
      };
    } else {
      return (document: Document) => this.validateBasic(document, schema);
    }
  }
}
