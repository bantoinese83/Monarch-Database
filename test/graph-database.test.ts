/**
 * Tests for Graph Database
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { GraphDatabase } from '../src/graph-database';

describe('GraphDatabase', () => {
  let graph: GraphDatabase;

  beforeEach(() => {
    graph = new GraphDatabase();
  });

  describe('Node Operations', () => {
    it('should create a node', () => {
      const nodeId = graph.createNode('Person', { name: 'Alice', age: 30 });
      expect(nodeId).toBeDefined();
      
      const node = graph.getNode(nodeId);
      expect(node).toBeDefined();
      expect(node?.label).toBe('Person');
      expect(node?.properties.name).toBe('Alice');
      expect(node?.properties.age).toBe(30);
    });

    it('should update node properties', () => {
      const nodeId = graph.createNode('Person', { name: 'Alice' });
      const updated = graph.updateNode(nodeId, { age: 31 });
      
      expect(updated).toBe(true);
      const node = graph.getNode(nodeId);
      expect(node?.properties.age).toBe(31);
    });

    it('should delete a node', () => {
      const nodeId = graph.createNode('Person', { name: 'Alice' });
      const deleted = graph.deleteNode(nodeId);
      
      expect(deleted).toBe(true);
      expect(graph.getNode(nodeId)).toBeUndefined();
    });

    it('should delete connected edges when deleting node', () => {
      const node1 = graph.createNode('Person');
      const node2 = graph.createNode('Person');
      const edgeId = graph.createEdge(node1, node2, 'KNOWS');
      
      graph.deleteNode(node1);
      
      expect(graph.getEdge(edgeId)).toBeUndefined();
    });
  });

  describe('Edge Operations', () => {
    it('should create an edge', () => {
      const node1 = graph.createNode('Person');
      const node2 = graph.createNode('Person');
      const edgeId = graph.createEdge(node1, node2, 'KNOWS', { since: 2020 });
      
      expect(edgeId).toBeDefined();
      const edge = graph.getEdge(edgeId);
      expect(edge).toBeDefined();
      expect(edge?.type).toBe('KNOWS');
      expect(edge?.from).toBe(node1);
      expect(edge?.to).toBe(node2);
    });

    it('should throw error when creating edge with non-existent nodes', () => {
      expect(() => {
        graph.createEdge('nonexistent1', 'nonexistent2');
      }).toThrow();
    });

    it('should update edge properties', () => {
      const node1 = graph.createNode('Person');
      const node2 = graph.createNode('Person');
      const edgeId = graph.createEdge(node1, node2, 'KNOWS');
      
      const updated = graph.updateEdge(edgeId, { weight: 0.8 });
      expect(updated).toBe(true);
      
      const edge = graph.getEdge(edgeId);
      expect(edge?.properties.weight).toBe(0.8);
    });

    it('should delete an edge', () => {
      const node1 = graph.createNode('Person');
      const node2 = graph.createNode('Person');
      const edgeId = graph.createEdge(node1, node2, 'KNOWS');
      
      const deleted = graph.deleteEdge(edgeId);
      expect(deleted).toBe(true);
      expect(graph.getEdge(edgeId)).toBeUndefined();
    });
  });

  describe('Graph Queries', () => {
    it('should get neighbors of a node', () => {
      const node1 = graph.createNode('Person', { name: 'Alice' });
      const node2 = graph.createNode('Person', { name: 'Bob' });
      const node3 = graph.createNode('Person', { name: 'Charlie' });
      
      graph.createEdge(node1, node2, 'KNOWS');
      graph.createEdge(node1, node3, 'KNOWS');
      
      const neighbors = graph.getNeighbors(node1);
      expect(neighbors.length).toBe(2);
      expect(neighbors.map(n => n.properties.name)).toContain('Bob');
      expect(neighbors.map(n => n.properties.name)).toContain('Charlie');
    });

    it('should find nodes by label', () => {
      graph.createNode('Person', { name: 'Alice' });
      graph.createNode('Person', { name: 'Bob' });
      graph.createNode('Company', { name: 'Acme' });
      
      const people = graph.findByLabel('Person');
      expect(people.length).toBe(2);
    });

    it('should find nodes by property', () => {
      graph.createNode('Person', { name: 'Alice', city: 'NYC' });
      graph.createNode('Person', { name: 'Bob', city: 'NYC' });
      graph.createNode('Person', { name: 'Charlie', city: 'LA' });
      
      const nycPeople = graph.findByProperty('city', 'NYC');
      expect(nycPeople.length).toBe(2);
    });

    it('should traverse graph', () => {
      const node1 = graph.createNode('Person');
      const node2 = graph.createNode('Person');
      const node3 = graph.createNode('Person');
      
      graph.createEdge(node1, node2, 'KNOWS');
      graph.createEdge(node2, node3, 'KNOWS');
      
      const result = graph.traverse(node1, { maxDepth: 2 });
      expect(result.nodes.length).toBeGreaterThan(0);
    });

    it('should get graph statistics', () => {
      graph.createNode('Person');
      graph.createNode('Person');
      const node3 = graph.createNode('Person');
      graph.createEdge(node3, node3, 'SELF'); // Self-reference
      
      const stats = graph.getStats();
      expect(stats.nodeCount).toBe(3);
      expect(stats.edgeCount).toBe(1);
      expect(stats.labels).toBe(1);
    });
  });
});

