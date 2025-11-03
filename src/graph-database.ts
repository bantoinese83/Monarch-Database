/**
 * Graph Database Implementation
 * 
 * High-performance graph database with nodes, edges, and relationships.
 * Supports property graphs, graph traversal, and pattern matching.
 */

import { ValidationError, ResourceLimitError } from './errors';
import { LIMITS, ERROR_MESSAGES } from './constants';
import { logger } from './logger';

/**
 * Graph node with properties
 */
export interface GraphNode {
  id: string;
  label?: string;
  properties: Record<string, any>;
  createdAt: number;
  updatedAt: number;
}

/**
 * Graph edge/relationship
 */
export interface GraphEdge {
  id: string;
  from: string; // Source node ID
  to: string; // Target node ID
  type?: string; // Relationship type
  properties: Record<string, any>;
  createdAt: number;
  updatedAt: number;
}

/**
 * Graph traversal options
 */
export interface TraversalOptions {
  direction?: 'outgoing' | 'incoming' | 'both';
  edgeTypes?: string[];
  maxDepth?: number;
  maxNodes?: number;
  filter?: (node: GraphNode) => boolean;
}

/**
 * Graph query result
 */
export interface GraphQueryResult {
  nodes: GraphNode[];
  edges: GraphEdge[];
  path?: GraphNode[];
}

/**
 * Pattern matching query
 */
export interface GraphPattern {
  nodes: Array<{
    alias?: string;
    label?: string;
    properties?: Record<string, any>;
  }>;
  edges: Array<{
    from: string;
    to: string;
    type?: string;
    properties?: Record<string, any>;
    direction?: 'outgoing' | 'incoming' | 'both';
  }>;
}

/**
 * High-performance Graph Database
 */
export class GraphDatabase {
  private nodes: Map<string, GraphNode> = new Map();
  private edges: Map<string, GraphEdge> = new Map();
  
  // Indexes for fast lookups
  private nodeLabelIndex: Map<string, Set<string>> = new Map(); // label -> Set<nodeId>
  private edgeTypeIndex: Map<string, Set<string>> = new Map(); // type -> Set<edgeId>
  private adjacencyList: Map<string, Map<string, Set<string>>> = new Map(); // nodeId -> {direction -> Set<edgeId>}
  private reverseAdjacencyList: Map<string, Map<string, Set<string>>> = new Map(); // nodeId -> {direction -> Set<edgeId>}
  
  // Property indexes for fast queries
  private propertyIndexes: Map<string, Map<string, Set<string>>> = new Map(); // field -> value -> Set<nodeId|edgeId>

  /**
   * Create a node
   */
  createNode(label?: string, properties: Record<string, any> = {}): string {
    const id = `node_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    const node: GraphNode = {
      id,
      label,
      properties,
      createdAt: Date.now(),
      updatedAt: Date.now()
    };

    this.nodes.set(id, node);
    
    // Update indexes
    if (label) {
      if (!this.nodeLabelIndex.has(label)) {
        this.nodeLabelIndex.set(label, new Set());
      }
      this.nodeLabelIndex.get(label)!.add(id);
    }

    // Index properties
    this.indexNodeProperties(node);

    logger.info('Graph node created', { nodeId: id, label });
    return id;
  }

  /**
   * Get a node by ID
   */
  getNode(nodeId: string): GraphNode | undefined {
    return this.nodes.get(nodeId);
  }

  /**
   * Update node properties
   */
  updateNode(nodeId: string, properties: Record<string, any>): boolean {
    const node = this.nodes.get(nodeId);
    if (!node) {
      return false;
    }

    // Remove old property indexes
    this.removeNodePropertyIndexes(node);

    // Update properties
    Object.assign(node.properties, properties);
    node.updatedAt = Date.now();

    // Re-index properties
    this.indexNodeProperties(node);

    logger.info('Graph node updated', { nodeId });
    return true;
  }

  /**
   * Delete a node and all connected edges
   */
  deleteNode(nodeId: string): boolean {
    const node = this.nodes.get(nodeId);
    if (!node) {
      return false;
    }

    // Remove all connected edges
    const connectedEdges = this.getConnectedEdges(nodeId);
    for (const edge of connectedEdges) {
      this.deleteEdge(edge.id);
    }

    // Remove from indexes
    if (node.label) {
      this.nodeLabelIndex.get(node.label)?.delete(nodeId);
    }
    this.removeNodePropertyIndexes(node);

    // Remove from adjacency lists
    this.adjacencyList.delete(nodeId);
    this.reverseAdjacencyList.delete(nodeId);

    this.nodes.delete(nodeId);
    logger.info('Graph node deleted', { nodeId });
    return true;
  }

  /**
   * Create an edge/relationship
   */
  createEdge(
    from: string,
    to: string,
    type?: string,
    properties: Record<string, any> = {}
  ): string {
    // Validate nodes exist
    if (!this.nodes.has(from)) {
      throw new ValidationError(`Source node not found: ${from}`, 'nodeId', from);
    }
    if (!this.nodes.has(to)) {
      throw new ValidationError(`Target node not found: ${to}`, 'nodeId', to);
    }

    const id = `edge_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    const edge: GraphEdge = {
      id,
      from,
      to,
      type,
      properties,
      createdAt: Date.now(),
      updatedAt: Date.now()
    };

    this.edges.set(id, edge);

    // Update adjacency lists
    if (!this.adjacencyList.has(from)) {
      this.adjacencyList.set(from, new Map());
    }
    if (!this.adjacencyList.get(from)!.has('outgoing')) {
      this.adjacencyList.get(from)!.set('outgoing', new Set());
    }
    this.adjacencyList.get(from)!.get('outgoing')!.add(id);

    if (!this.reverseAdjacencyList.has(to)) {
      this.reverseAdjacencyList.set(to, new Map());
    }
    if (!this.reverseAdjacencyList.get(to)!.has('incoming')) {
      this.reverseAdjacencyList.get(to)!.set('incoming', new Set());
    }
    this.reverseAdjacencyList.get(to)!.get('incoming')!.add(id);

    // Update indexes
    if (type) {
      if (!this.edgeTypeIndex.has(type)) {
        this.edgeTypeIndex.set(type, new Set());
      }
      this.edgeTypeIndex.get(type)!.add(id);
    }

    // Index properties
    this.indexEdgeProperties(edge);

    logger.info('Graph edge created', { edgeId: id, from, to, type });
    return id;
  }

  /**
   * Get an edge by ID
   */
  getEdge(edgeId: string): GraphEdge | undefined {
    return this.edges.get(edgeId);
  }

  /**
   * Update edge properties
   */
  updateEdge(edgeId: string, properties: Record<string, any>): boolean {
    const edge = this.edges.get(edgeId);
    if (!edge) {
      return false;
    }

    // Remove old property indexes
    this.removeEdgePropertyIndexes(edge);

    // Update properties
    Object.assign(edge.properties, properties);
    edge.updatedAt = Date.now();

    // Re-index properties
    this.indexEdgeProperties(edge);

    logger.info('Graph edge updated', { edgeId });
    return true;
  }

  /**
   * Delete an edge
   */
  deleteEdge(edgeId: string): boolean {
    const edge = this.edges.get(edgeId);
    if (!edge) {
      return false;
    }

    // Remove from adjacency lists
    this.adjacencyList.get(edge.from)?.get('outgoing')?.delete(edgeId);
    this.reverseAdjacencyList.get(edge.to)?.get('incoming')?.delete(edgeId);

    // Remove from indexes
    if (edge.type) {
      this.edgeTypeIndex.get(edge.type)?.delete(edgeId);
    }
    this.removeEdgePropertyIndexes(edge);

    this.edges.delete(edgeId);
    logger.info('Graph edge deleted', { edgeId });
    return true;
  }

  /**
   * Get all edges connected to a node
   */
  getConnectedEdges(nodeId: string, direction: 'outgoing' | 'incoming' | 'both' = 'both'): GraphEdge[] {
    const edgeIds = new Set<string>();

    if (direction === 'outgoing' || direction === 'both') {
      const outgoing = this.adjacencyList.get(nodeId)?.get('outgoing');
      if (outgoing) {
        outgoing.forEach(id => edgeIds.add(id));
      }
    }

    if (direction === 'incoming' || direction === 'both') {
      const incoming = this.reverseAdjacencyList.get(nodeId)?.get('incoming');
      if (incoming) {
        incoming.forEach(id => edgeIds.add(id));
      }
    }

    return Array.from(edgeIds).map(id => this.edges.get(id)!).filter(Boolean);
  }

  /**
   * Get neighbors of a node
   */
  getNeighbors(nodeId: string, direction: 'outgoing' | 'incoming' | 'both' = 'both'): GraphNode[] {
    const edges = this.getConnectedEdges(nodeId, direction);
    const neighborIds = new Set<string>();

    for (const edge of edges) {
      if (direction === 'outgoing' || direction === 'both') {
        if (edge.from === nodeId) {
          neighborIds.add(edge.to);
        }
      }
      if (direction === 'incoming' || direction === 'both') {
        if (edge.to === nodeId) {
          neighborIds.add(edge.from);
        }
      }
    }

    return Array.from(neighborIds).map(id => this.nodes.get(id)!).filter(Boolean);
  }

  /**
   * Traverse graph from a starting node
   */
  traverse(startNodeId: string, options: TraversalOptions = {}): GraphQueryResult {
    const {
      direction = 'outgoing',
      edgeTypes,
      maxDepth = 10,
      maxNodes = 1000,
      filter
    } = options;

    const visited = new Set<string>();
    const resultNodes = new Map<string, GraphNode>();
    const resultEdges = new Set<string>();
    const path: GraphNode[] = [];

    const traverseRecursive = (nodeId: string, depth: number): void => {
      if (depth > maxDepth || visited.size >= maxNodes) {
        return;
      }

      const node = this.nodes.get(nodeId);
      if (!node) return;

      if (visited.has(nodeId)) return;
      visited.add(nodeId);

      // Apply filter if provided
      if (filter && !filter(node)) {
        return;
      }

      resultNodes.set(nodeId, node);
      if (depth === 0) {
        path.push(node);
      }

      // Get connected edges
      const edges = this.getConnectedEdges(nodeId, direction);
      for (const edge of edges) {
        // Filter by edge type if specified
        if (edgeTypes && edge.type && !edgeTypes.includes(edge.type)) {
          continue;
        }

        resultEdges.add(edge.id);

        // Traverse to neighbor
        const neighborId = direction === 'incoming' ? edge.from : edge.to;
        if (!visited.has(neighborId)) {
          traverseRecursive(neighborId, depth + 1);
          if (path.length < maxNodes) {
            const neighbor = this.nodes.get(neighborId);
            if (neighbor) path.push(neighbor);
          }
        }
      }
    };

    traverseRecursive(startNodeId, 0);

    return {
      nodes: Array.from(resultNodes.values()),
      edges: Array.from(resultEdges).map(id => this.edges.get(id)!).filter(Boolean),
      path: path.slice(0, maxNodes)
    };
  }

  /**
   * Pattern matching query
   */
  matchPattern(pattern: GraphPattern): GraphQueryResult[] {
    const results: GraphQueryResult[] = [];

    // Simple pattern matching implementation
    // For complex patterns, this would use a graph query engine
    
    if (pattern.nodes.length === 0) {
      return results;
    }

    // Find matching starting nodes
    const startNodePattern = pattern.nodes[0];
    const startingNodes = this.findNodesByPattern(startNodePattern);

    for (const startNode of startingNodes) {
      const result = this.matchPatternFromNode(startNode, pattern);
      if (result.nodes.length > 0) {
        results.push(result);
      }
    }

    return results;
  }

  /**
   * Find nodes by label
   */
  findByLabel(label: string): GraphNode[] {
    const nodeIds = this.nodeLabelIndex.get(label);
    if (!nodeIds) {
      return [];
    }
    return Array.from(nodeIds).map(id => this.nodes.get(id)!).filter(Boolean);
  }

  /**
   * Find nodes by property
   */
  findByProperty(field: string, value: any): GraphNode[] {
    const nodeIds = this.propertyIndexes.get(`node.${field}`)?.get(String(value));
    if (!nodeIds) {
      return [];
    }
    return Array.from(nodeIds).map(id => this.nodes.get(id)!).filter(Boolean);
  }

  /**
   * Find edges by type
   */
  findEdgesByType(type: string): GraphEdge[] {
    const edgeIds = this.edgeTypeIndex.get(type);
    if (!edgeIds) {
      return [];
    }
    return Array.from(edgeIds).map(id => this.edges.get(id)!).filter(Boolean);
  }

  /**
   * Get graph statistics
   */
  getStats(): {
    nodeCount: number;
    edgeCount: number;
    labels: number;
    edgeTypes: number;
    averageDegree: number;
  } {
    let totalDegree = 0;
    for (const nodeId of this.nodes.keys()) {
      const edges = this.getConnectedEdges(nodeId);
      totalDegree += edges.length;
    }

    return {
      nodeCount: this.nodes.size,
      edgeCount: this.edges.size,
      labels: this.nodeLabelIndex.size,
      edgeTypes: this.edgeTypeIndex.size,
      averageDegree: this.nodes.size > 0 ? totalDegree / this.nodes.size : 0
    };
  }

  /**
   * Clear all graph data
   */
  clear(): void {
    this.nodes.clear();
    this.edges.clear();
    this.nodeLabelIndex.clear();
    this.edgeTypeIndex.clear();
    this.adjacencyList.clear();
    this.reverseAdjacencyList.clear();
    this.propertyIndexes.clear();
  }

  // Private helper methods

  private findNodesByPattern(pattern: {
    alias?: string;
    label?: string;
    properties?: Record<string, any>;
  }): GraphNode[] {
    let candidates: GraphNode[] = [];

    if (pattern.label) {
      candidates = this.findByLabel(pattern.label);
    } else {
      candidates = Array.from(this.nodes.values());
    }

    if (pattern.properties) {
      candidates = candidates.filter(node => {
        for (const [key, value] of Object.entries(pattern.properties!)) {
          if (node.properties[key] !== value) {
            return false;
          }
        }
        return true;
      });
    }

    return candidates;
  }

  private matchPatternFromNode(startNode: GraphNode, pattern: GraphPattern): GraphQueryResult {
    const resultNodes = new Map<string, GraphNode>();
    const resultEdges = new Set<string>();

    resultNodes.set(startNode.id, startNode);

    // Simple implementation - match first edge pattern
    if (pattern.edges.length > 0) {
      const edgePattern = pattern.edges[0];
      const edges = this.getConnectedEdges(
        startNode.id,
        edgePattern.direction || 'outgoing'
      );

      for (const edge of edges) {
        if (edgePattern.type && edge.type !== edgePattern.type) {
          continue;
        }

        if (edgePattern.properties) {
          let matches = true;
          for (const [key, value] of Object.entries(edgePattern.properties)) {
            if (edge.properties[key] !== value) {
              matches = false;
              break;
            }
          }
          if (!matches) continue;
        }

        resultEdges.add(edge.id);
        const targetNode = this.nodes.get(edgePattern.to || edge.to);
        if (targetNode) {
          resultNodes.set(targetNode.id, targetNode);
        }
      }
    }

    return {
      nodes: Array.from(resultNodes.values()),
      edges: Array.from(resultEdges).map(id => this.edges.get(id)!).filter(Boolean)
    };
  }

  private indexNodeProperties(node: GraphNode): void {
    for (const [key, value] of Object.entries(node.properties)) {
      const indexKey = `node.${key}`;
      if (!this.propertyIndexes.has(indexKey)) {
        this.propertyIndexes.set(indexKey, new Map());
      }
      const index = this.propertyIndexes.get(indexKey)!;
      const valueKey = String(value);
      if (!index.has(valueKey)) {
        index.set(valueKey, new Set());
      }
      index.get(valueKey)!.add(node.id);
    }
  }

  private removeNodePropertyIndexes(node: GraphNode): void {
    for (const [key, value] of Object.entries(node.properties)) {
      const indexKey = `node.${key}`;
      const index = this.propertyIndexes.get(indexKey);
      if (index) {
        const valueKey = String(value);
        index.get(valueKey)?.delete(node.id);
      }
    }
  }

  private indexEdgeProperties(edge: GraphEdge): void {
    for (const [key, value] of Object.entries(edge.properties)) {
      const indexKey = `edge.${key}`;
      if (!this.propertyIndexes.has(indexKey)) {
        this.propertyIndexes.set(indexKey, new Map());
      }
      const index = this.propertyIndexes.get(indexKey)!;
      const valueKey = String(value);
      if (!index.has(valueKey)) {
        index.set(valueKey, new Set());
      }
      index.get(valueKey)!.add(edge.id);
    }
  }

  private removeEdgePropertyIndexes(edge: GraphEdge): void {
    for (const [key, value] of Object.entries(edge.properties)) {
      const indexKey = `edge.${key}`;
      const index = this.propertyIndexes.get(indexKey);
      if (index) {
        const valueKey = String(value);
        index.get(valueKey)?.delete(edge.id);
      }
    }
  }
}

