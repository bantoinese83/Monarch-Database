/**
 * AWS Lambda Serverless Adapter for Monarch
 * 
 * Enables Monarch to run in serverless environments like AWS Lambda.
 */

import { Monarch } from '../../src';
import { APIGatewayProxyEvent, APIGatewayProxyResult, Context } from 'aws-lambda';

let dbInstance: Monarch | null = null;

/**
 * Initialize database instance (reused across invocations)
 */
function getDatabase(): Monarch {
  if (!dbInstance) {
    // Use /tmp for persistence in Lambda (ephemeral storage)
    const { FileSystemAdapter } = require('../../src');
    const adapter = new FileSystemAdapter('/tmp/monarch-data');
    dbInstance = new Monarch(adapter);
  }
  return dbInstance;
}

/**
 * Lambda handler for Monarch database operations
 */
export async function handler(
  event: APIGatewayProxyEvent,
  context: Context
): Promise<APIGatewayProxyResult> {
  const db = getDatabase();
  
  try {
    const { method, path, body } = parseEvent(event);
    
    let result: any;
    
    switch (method) {
      case 'GET':
        result = await handleGet(db, path);
        break;
      case 'POST':
        result = await handlePost(db, path, body);
        break;
      case 'PUT':
        result = await handlePut(db, path, body);
        break;
      case 'DELETE':
        result = await handleDelete(db, path);
        break;
      default:
        return createResponse(405, { error: 'Method not allowed' });
    }
    
    return createResponse(200, result);
  } catch (error) {
    console.error('Lambda handler error:', error);
    return createResponse(500, {
      error: 'Internal server error',
      message: (error as Error).message
    });
  }
}

function parseEvent(event: APIGatewayProxyEvent): {
  method: string;
  path: string;
  body: any;
} {
  const method = event.httpMethod;
  const path = event.pathParameters?.proxy || event.path;
  let body = null;
  
  if (event.body) {
    try {
      body = JSON.parse(event.body);
    } catch {
      body = event.body;
    }
  }
  
  return { method, path, body };
}

async function handleGet(db: Monarch, path: string): Promise<any> {
  // Parse path: /collection/:name or /collection/:name/query
  const parts = path.split('/').filter(p => p);
  
  if (parts.length === 2 && parts[0] === 'collection') {
    const collectionName = parts[1];
    const collection = db.getCollection(collectionName);
    if (!collection) {
      throw new Error(`Collection ${collectionName} not found`);
    }
    return collection.find({});
  }
  
  if (parts.length === 1 && parts[0] === 'collections') {
    return { collections: db.listCollections() };
  }
  
  throw new Error('Invalid path');
}

async function handlePost(db: Monarch, path: string, body: any): Promise<any> {
  const parts = path.split('/').filter(p => p);
  
  if (parts.length === 2 && parts[0] === 'collection') {
    const collectionName = parts[1];
    let collection = db.getCollection(collectionName);
    if (!collection) {
      collection = db.addCollection(collectionName);
    }
    
    if (body.documents) {
      return collection.insert(body.documents);
    }
    if (body.document) {
      return collection.insert(body.document);
    }
  }
  
  throw new Error('Invalid path or body');
}

async function handlePut(db: Monarch, path: string, body: any): Promise<any> {
  const parts = path.split('/').filter(p => p);
  
  if (parts.length === 2 && parts[0] === 'collection') {
    const collectionName = parts[1];
    const collection = db.getCollection(collectionName);
    if (!collection) {
      throw new Error(`Collection ${collectionName} not found`);
    }
    
    if (body.query && body.changes) {
      return { updated: collection.update(body.query, body.changes) };
    }
  }
  
  throw new Error('Invalid path or body');
}

async function handleDelete(db: Monarch, path: string): Promise<any> {
  const parts = path.split('/').filter(p => p);
  
  if (parts.length === 2 && parts[0] === 'collection') {
    const collectionName = parts[1];
    const removed = db.removeCollection(collectionName);
    return { removed };
  }
  
  throw new Error('Invalid path');
}

function createResponse(statusCode: number, body: any): APIGatewayProxyResult {
  return {
    statusCode,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*'
    },
    body: JSON.stringify(body)
  };
}

