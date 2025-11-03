/**
 * Optimized Data Structures Implementation
 *
 * High-performance implementations using optimal algorithms and data structures:
 * - Doubly-linked lists for O(1) insertions/deletions
 * - Hash-based sets for O(1) membership tests
 * - Skip lists for O(log n) sorted operations
 * - Map-based geospatial indexing
 * - Cosine similarity for vector search
 * - Time-based indexing for time series
 */

import {
  SetEntry, HashEntry, StreamEntry,
  GeospatialEntry, TimeSeriesEntry, VectorEntry, VectorSearchResult,
  ListOperations, SetOperations, HashOperations, SortedSetOperations,
  StreamOperations, GeospatialOperations, TimeSeriesOperations, VectorOperations,
  GraphOperations
} from './types';
import { globalConfig } from './config';
import { ResourceLimitError } from './errors';
import { GraphDatabase } from './graph-database';

/**
 * Doubly-linked list node for O(1) operations
 */
class DoublyLinkedListNode<T> {
  constructor(
    public value: T,
    public prev: DoublyLinkedListNode<T> | null = null,
    public next: DoublyLinkedListNode<T> | null = null,
    public timestamp: number = Date.now()
  ) {}
}

/**
 * Doubly-linked list implementation
 */
class DoublyLinkedList<T> {
  private head: DoublyLinkedListNode<T> | null = null;
  private tail: DoublyLinkedListNode<T> | null = null;
  private size = 0;

  get length(): number {
    return this.size;
  }

  /**
   * Add to front - O(1)
   */
  unshift(value: T): void {
    const node = new DoublyLinkedListNode(value);
    if (!this.head) {
      this.head = this.tail = node;
    } else {
      node.next = this.head;
      this.head.prev = node;
      this.head = node;
    }
    this.size++;
  }

  /**
   * Add to back - O(1)
   */
  push(value: T): void {
    const node = new DoublyLinkedListNode(value);
    if (!this.tail) {
      this.head = this.tail = node;
    } else {
      node.prev = this.tail;
      this.tail.next = node;
      this.tail = node;
    }
    this.size++;
  }

  /**
   * Remove from front - O(1)
   */
  shift(): T | null {
    if (!this.head) return null;

    const value = this.head.value;
    if (this.head === this.tail) {
      this.head = this.tail = null;
    } else {
      this.head = this.head.next!;
      this.head.prev = null;
    }
    this.size--;
    return value;
  }

  /**
   * Remove from back - O(1)
   */
  pop(): T | null {
    if (!this.tail) return null;

    const value = this.tail.value;
    if (this.head === this.tail) {
      this.head = this.tail = null;
    } else {
      this.tail = this.tail.prev!;
      this.tail.next = null;
    }
    this.size--;
    return value;
  }

  /**
   * Get element at index - O(min(index, length-index))
   * Supports negative indices (Redis-style)
   */
  get(index: number): T | null {
    // Handle negative indices
    if (index < 0) {
      index = this.size + index;
    }
    if (index < 0 || index >= this.size) return null;

    let node: DoublyLinkedListNode<T>;
    if (index < this.size / 2) {
      // Start from head
      node = this.head!;
      for (let i = 0; i < index; i++) {
        node = node.next!;
      }
    } else {
      // Start from tail
      node = this.tail!;
      for (let i = this.size - 1; i > index; i--) {
        node = node.prev!;
      }
    }

    return node.value;
  }

  /**
   * Set element at index - O(min(index, length-index))
   * Supports negative indices (Redis-style)
   */
  set(index: number, value: T): boolean {
    // Handle negative indices
    if (index < 0) {
      index = this.size + index;
    }
    if (index < 0 || index >= this.size) return false;

    let node: DoublyLinkedListNode<T>;
    if (index < this.size / 2) {
      // Start from head
      node = this.head!;
      for (let i = 0; i < index; i++) {
        node = node.next!;
      }
    } else {
      // Start from tail
      node = this.tail!;
      for (let i = this.size - 1; i > index; i--) {
        node = node.prev!;
      }
    }

    node.value = value;
    return true;
  }

  /**
   * Remove elements by value - O(n)
   */
  removeByValue(value: T, count: number = 0): number {
    let removed = 0;
    let node = this.head;
    const nodesToRemove: DoublyLinkedListNode<T>[] = [];

    // Collect nodes to remove
    while (node && (count === 0 || removed < Math.abs(count))) {
      if (node.value === value || (typeof node.value === 'object' && JSON.stringify(node.value) === JSON.stringify(value))) {
        nodesToRemove.push(node);
        removed++;
        if (count > 0 && removed >= count) break;
      }
      node = node.next;
    }

    // Remove collected nodes
    for (const nodeToRemove of nodesToRemove) {
      if (nodeToRemove.prev) {
        nodeToRemove.prev.next = nodeToRemove.next;
      } else {
        this.head = nodeToRemove.next;
      }
      if (nodeToRemove.next) {
        nodeToRemove.next.prev = nodeToRemove.prev;
      } else {
        this.tail = nodeToRemove.prev;
      }
      this.size--;
    }

    return removed;
  }

  /**
   * Get range of elements - O(start + count)
   * Supports negative indices (Redis-style)
   */
  range(start: number, count: number): T[] {
    const result: T[] = [];
    
    // Handle negative start index
    if (start < 0) {
      start = this.size + start;
    }
    
    // Clamp start to valid range
    if (start < 0) start = 0;
    if (start >= this.size) return result;
    
    // Handle negative count (means "from start to end")
    if (count < 0) {
      count = this.size - start;
    }
    if (count <= 0) return result;

    let node = this.head;
    for (let i = 0; i < start && node; i++) {
      node = node.next;
    }

    for (let i = 0; i < count && node; i++) {
      result.push(node.value);
      node = node.next;
    }

    return result;
  }

  /**
   * Convert to array - O(n)
   */
  toArray(): T[] {
    const result: T[] = [];
    let node = this.head;
    while (node) {
      result.push(node.value);
      node = node.next;
    }
    return result;
  }

  /**
   * Clear all elements - O(1)
   */
  clear(): void {
    this.head = this.tail = null;
    this.size = 0;
  }
}

/**
 * Skip list node for O(log n) sorted operations
 */
class SkipListNode<T> {
  constructor(
    public value: T,
    public score: number,
    public forward: SkipListNode<T>[] = []
  ) {}
}

/**
 * Skip list implementation for sorted sets
 */
class SkipList<T> {
  private head: SkipListNode<T>;
  private maxLevel = 16;
  private probability = 0.25; // Probability for level increase

  constructor() {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    this.head = new SkipListNode<T>(null as any, -Infinity, new Array(this.maxLevel).fill(null));
  }

  /**
   * Insert element - O(log n)
   */
  insert(value: T, score: number): void {
    const update = new Array(this.maxLevel).fill(null);
    let current = this.head;

    // Find position to insert
    for (let i = this.maxLevel - 1; i >= 0; i--) {
      while (current.forward[i] && current.forward[i].score < score) {
        current = current.forward[i];
      }
      update[i] = current;
    }

    // Generate random level
    const level = this.randomLevel();

    // Create new node
    const newNode = new SkipListNode(value, score, new Array(level).fill(null));

    // Update forward pointers
    for (let i = 0; i < level; i++) {
      newNode.forward[i] = update[i].forward[i];
      update[i].forward[i] = newNode;
    }
  }

  /**
   * Find element by score - O(log n)
   */
  find(score: number): T | null {
    let current = this.head;

    for (let i = this.maxLevel - 1; i >= 0; i--) {
      while (current.forward[i] && current.forward[i].score < score) {
        current = current.forward[i];
      }
    }

    current = current.forward[0];
    return current && current.score === score ? current.value : null;
  }

  /**
   * Get range by score - O(log n + k)
   */
  rangeByScore(min: number, max: number, limit?: number): T[] {
    const result: T[] = [];
    let current = this.head;

    // Find first element >= min
    for (let i = this.maxLevel - 1; i >= 0; i--) {
      while (current.forward[i] && current.forward[i].score < min) {
        current = current.forward[i];
      }
    }
    current = current.forward[0];

    // Collect elements within range
    while (current && current.score <= max) {
      if (current.score >= min) {
        result.push(current.value);
        if (limit && result.length >= limit) break;
      }
      current = current.forward[0];
    }

    return result;
  }

  /**
   * Get all members in sorted order - O(n)
   */
  getAllMembers(): T[] {
    const result: T[] = [];
    let current = this.head.forward[0];
    
    while (current) {
      result.push(current.value);
      current = current.forward[0];
    }
    
    return result;
  }

  /**
   * Remove element by score - O(log n)
   */
  remove(score: number): boolean {
    const update = new Array(this.maxLevel).fill(null);
    let current = this.head;

    // Find node to remove
    for (let i = this.maxLevel - 1; i >= 0; i--) {
      while (current.forward[i] && current.forward[i].score < score) {
        current = current.forward[i];
      }
      update[i] = current;
    }

    current = current.forward[0];

    if (!current || current.score !== score) {
      return false;
    }

    // Remove node by updating forward pointers
    for (let i = 0; i < current.forward.length; i++) {
      update[i].forward[i] = current.forward[i];
    }

    return true;
  }

  private randomLevel(): number {
    let level = 1;
    while (Math.random() < this.probability && level < this.maxLevel) {
      level++;
    }
    return level;
  }
}


/**
 * Optimized Data Structures Implementation
 */
export class OptimizedDataStructures implements
  ListOperations, SetOperations, HashOperations, SortedSetOperations,
  StreamOperations, GeospatialOperations, TimeSeriesOperations, VectorOperations,
  GraphOperations {

  // Optimized storage with efficient data structures
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private lists: Map<string, DoublyLinkedList<any>> = new Map();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private sets: Map<string, Map<any, SetEntry>> = new Map();
  private hashes: Map<string, Map<string, HashEntry>> = new Map();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private sortedSets: Map<string, SkipList<any>> = new Map();
  // Member-to-score mapping for sorted sets
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private sortedSetScores: Map<string, Map<any, number>> = new Map();
  private streams: Map<string, StreamEntry[]> = new Map();
  private geospatial: Map<string, Map<string, GeospatialEntry>> = new Map();
  private timeSeries: Map<string, TimeSeriesEntry[]> = new Map();
  private vectors: Map<string, Map<string, VectorEntry>> = new Map();
  private graphs: Map<string, GraphDatabase> = new Map();

  // List Operations - O(1) operations with doubly-linked lists
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  async lpush(key: string, values: any[]): Promise<number> {
    this.validateKey(key);
    const list = this.lists.get(key) || new DoublyLinkedList();

    for (const value of values.reverse()) {
      list.unshift(value);
    }

    this.lists.set(key, list);
    return list.length;
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  async rpush(key: string, values: any[]): Promise<number> {
    this.validateKey(key);
    const list = this.lists.get(key) || new DoublyLinkedList();

    for (const value of values) {
      list.push(value);
    }

    this.lists.set(key, list);
    return list.length;
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  async lpop(key: string): Promise<any> {
    const list = this.lists.get(key);
    return list ? list.shift() : null;
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  async rpop(key: string): Promise<any> {
    const list = this.lists.get(key);
    return list ? list.pop() : null;
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  async lrange(key: string, start: number, end: number): Promise<any[]> {
    const list = this.lists.get(key);
    if (!list) return [];

    // Handle negative indices (Redis-style)
    if (start < 0) {
      start = list.length + start;
      if (start < 0) start = 0;
    }
    if (end < 0) {
      end = list.length + end;
    }
    
    // Clamp end to valid range
    if (end >= list.length) end = list.length - 1;
    if (start > end) return [];

    const count = end - start + 1;
    return list.range(start, count);
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  async lindex(key: string, index: number): Promise<any> {
    const list = this.lists.get(key);
    if (!list) return null;
    // get() already handles negative indices
    return list.get(index);
  }

  async llen(key: string): Promise<number> {
    const list = this.lists.get(key);
    return list ? list.length : 0;
  }

  async ltrim(key: string, start: number, end: number): Promise<void> {
    const list = this.lists.get(key);
    if (!list) return;

    // Handle negative indices
    if (start < 0) {
      start = list.length + start;
      if (start < 0) start = 0;
    }
    if (end < 0) {
      end = list.length + end;
    }
    if (end >= list.length) end = list.length - 1;
    if (start > end) {
      this.lists.delete(key);
      return;
    }

    const trimmed = list.range(start, end - start + 1);
    const newList = new DoublyLinkedList();

    for (const item of trimmed) {
      newList.push(item);
    }

    this.lists.set(key, newList);
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  async lset(key: string, index: number, value: any): Promise<void> {
    const list = this.lists.get(key);
    if (!list) throw new Error('no such key');
    if (!list.set(index, value)) {
      throw new Error('index out of range');
    }
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  async lrem(key: string, count: number, value: any): Promise<number> {
    const list = this.lists.get(key);
    if (!list) return 0;
    return list.removeByValue(value, count);
  }

  // Set Operations - O(1) operations with hash maps
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  async sadd(key: string, members: any[]): Promise<number> {
    this.validateKey(key);
    const set = this.sets.get(key) || new Map();

    let added = 0;
    const timestamp = Date.now();

    for (const member of members) {
      if (!set.has(member)) {
        set.set(member, { member, timestamp });
        added++;
      }
    }

    this.sets.set(key, set);
    return added;
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  async srem(key: string, members: any[]): Promise<number> {
    const set = this.sets.get(key);
    if (!set) return 0;

    let removed = 0;
    for (const member of members) {
      if (set.delete(member)) {
        removed++;
      }
    }

    return removed;
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  async smembers(key: string): Promise<any[]> {
    const set = this.sets.get(key);
    if (!set) return [];

    return Array.from(set.keys());
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  async sismember(key: string, member: any): Promise<boolean> {
    const set = this.sets.get(key);
    return set ? set.has(member) : false;
  }

  async scard(key: string): Promise<number> {
    const set = this.sets.get(key);
    return set ? set.size : 0;
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  async sdiff(keys: string[]): Promise<any[]> {
    if (keys.length === 0) return [];

    const sets = keys.map(key => this.sets.get(key)).filter(Boolean);
    if (sets.length === 0) return [];

    const firstSet = sets[0];
    const result = new Set(firstSet!.keys());

    // Remove elements present in other sets
    for (let i = 1; i < sets.length; i++) {
      for (const member of sets[i]!.keys()) {
        result.delete(member);
      }
    }

    return Array.from(result);
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  async sinter(keys: string[]): Promise<any[]> {
    if (keys.length === 0) return [];

    const sets = keys.map(key => this.sets.get(key)).filter(Boolean);
    if (sets.length === 0) return [];

    // Start with smallest set for optimization
    const sortedSets = sets.sort((a, b) => a!.size - b!.size);
    const smallest = sortedSets[0]!;
    const result = new Set(smallest.keys());

    // Keep only elements present in all sets
    for (const set of sortedSets.slice(1)) {
      for (const member of result) {
        if (!set!.has(member)) {
          result.delete(member);
        }
      }
    }

    return Array.from(result);
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  async sunion(keys: string[]): Promise<any[]> {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const result = new Set<any>();

    for (const key of keys) {
      const set = this.sets.get(key);
      if (set) {
        for (const member of set.keys()) {
          result.add(member);
        }
      }
    }

    return Array.from(result);
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  async srandmember(key: string, count?: number): Promise<any[]> {
    const set = this.sets.get(key);
    if (!set || set.size === 0) return [];

    const members = Array.from(set.keys());
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const result: any[] = [];

    if (count === undefined) {
      // Return single random member
      return [members[Math.floor(Math.random() * members.length)]];
    }

    // Return multiple random members (with possible duplicates if count > set size)
    for (let i = 0; i < Math.abs(count); i++) {
      result.push(members[Math.floor(Math.random() * members.length)]);
    }

    return result;
  }

  // Hash Operations - O(1) operations with hash maps
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  async hset(key: string, field: string, value: any): Promise<number> {
    this.validateKey(key);
    const hash = this.hashes.get(key) || new Map();

    const isNew = !hash.has(field);
    hash.set(field, { field, value, timestamp: Date.now() });

    this.hashes.set(key, hash);
    return isNew ? 1 : 0;
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  async hget(key: string, field: string): Promise<any> {
    const hash = this.hashes.get(key);
    return hash?.get(field)?.value || null;
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  async hgetall(key: string): Promise<Record<string, any>> {
    const hash = this.hashes.get(key);
    if (!hash) return {};

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const result: Record<string, any> = {};
    for (const [field, entry] of hash) {
      result[field] = entry.value;
    }

    return result;
  }

  async hdel(key: string, fields: string[]): Promise<number> {
    const hash = this.hashes.get(key);
    if (!hash) return 0;

    let deleted = 0;
    for (const field of fields) {
      if (hash.delete(field)) {
        deleted++;
      }
    }

    return deleted;
  }

  async hexists(key: string, field: string): Promise<boolean> {
    const hash = this.hashes.get(key);
    return hash ? hash.has(field) : false;
  }

  async hkeys(key: string): Promise<string[]> {
    const hash = this.hashes.get(key);
    return hash ? Array.from(hash.keys()) : [];
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  async hvals(key: string): Promise<any[]> {
    const hash = this.hashes.get(key);
    if (!hash) return [];

    return Array.from(hash.values()).map(entry => entry.value);
  }

  async hlen(key: string): Promise<number> {
    const hash = this.hashes.get(key);
    return hash ? hash.size : 0;
  }

  async hincrby(key: string, field: string, amount: number): Promise<number> {
    this.validateKey(key);
    const hash = this.hashes.get(key) || new Map();

    const current = hash.get(field)?.value;
    // Parse string numbers, default to 0
    const currentNum = current !== undefined && current !== null
      ? (typeof current === 'number' ? current : parseFloat(String(current)) || 0)
      : 0;
    const newValue = currentNum + amount;

    hash.set(field, { field, value: newValue, timestamp: Date.now() });
    this.hashes.set(key, hash);

    return newValue;
  }

  async hincrbyfloat(key: string, field: string, increment: number): Promise<number> {
    this.validateKey(key);
    const hash = this.hashes.get(key) || new Map();

    const current = hash.get(field)?.value || 0;
    const newValue = (typeof current === 'number' ? current : parseFloat(current.toString()) || 0) + increment;

    hash.set(field, { field, value: newValue, timestamp: Date.now() });
    this.hashes.set(key, hash);

    return newValue;
  }

  // Sorted Set Operations - O(log n) operations with skip lists
  async zadd(key: string, members: Record<string, number>): Promise<number> {
    this.validateKey(key);
    const zset = this.sortedSets.get(key) || new SkipList();
    const scores = this.sortedSetScores.get(key) || new Map();

    let added = 0;
    for (const [member, score] of Object.entries(members)) {
      const oldScore = scores.get(member);
      if (oldScore !== undefined) {
        // Update existing member - remove old, insert new
        zset.remove(oldScore);
      }
      zset.insert(member, score);
      scores.set(member, score);
      added++;
    }

    this.sortedSets.set(key, zset);
    this.sortedSetScores.set(key, scores);
    return added;
  }

  async zrem(key: string, members: string[]): Promise<number> {
    const zset = this.sortedSets.get(key);
    const scores = this.sortedSetScores.get(key);
    if (!zset || !scores) return 0;

    let removed = 0;
    for (const member of members) {
      const score = scores.get(member);
      if (score !== undefined) {
        if (zset.remove(score)) {
          scores.delete(member);
          removed++;
        }
      }
    }

    return removed;
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  async zscore(key: string, member: any): Promise<number | null> {
    const scores = this.sortedSetScores.get(key);
    if (!scores) return null;
    const score = scores.get(member);
    return score !== undefined ? score : null;
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  async zrange(key: string, start: number, end: number, withScores?: boolean): Promise<any[]> {
    const zset = this.sortedSets.get(key);
    if (!zset) return [];

    const allMembers = zset.getAllMembers();
    const len = allMembers.length;
    
    // Handle negative indices
    if (start < 0) start = len + start;
    if (end < 0) end = len + end;
    if (start < 0) start = 0;
    if (end >= len) end = len - 1;
    if (start > end) return [];

    const result: any[] = [];
    const scores = this.sortedSetScores.get(key);
    
    for (let i = start; i <= end; i++) {
      const member = allMembers[i];
      result.push(member);
      if (withScores && scores) {
        result.push(scores.get(member) ?? 0);
      }
    }

    return result;
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  async zrevrange(key: string, start: number, end: number, withScores?: boolean): Promise<any[]> {
    const zset = this.sortedSets.get(key);
    if (!zset) return [];

    const allMembers = zset.getAllMembers().reverse();
    const len = allMembers.length;
    
    // Handle negative indices
    if (start < 0) start = len + start;
    if (end < 0) end = len + end;
    if (start < 0) start = 0;
    if (end >= len) end = len - 1;
    if (start > end) return [];

    const result: any[] = [];
    const scores = this.sortedSetScores.get(key);
    
    for (let i = start; i <= end; i++) {
      const member = allMembers[i];
      result.push(member);
      if (withScores && scores) {
        result.push(scores.get(member) ?? 0);
      }
    }

    return result;
  }

  async zcard(key: string): Promise<number> {
    const scores = this.sortedSetScores.get(key);
    return scores ? scores.size : 0;
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  async zrank(key: string, member: any): Promise<number | null> {
    const scores = this.sortedSetScores.get(key);
    const zset = this.sortedSets.get(key);
    if (!scores || !zset || !scores.has(member)) return null;

    const allMembers = zset.getAllMembers();
    const rank = allMembers.indexOf(member);
    return rank >= 0 ? rank : null;
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  async zrevrank(key: string, member: any): Promise<number | null> {
    const scores = this.sortedSetScores.get(key);
    const zset = this.sortedSets.get(key);
    if (!scores || !zset || !scores.has(member)) return null;

    const allMembers = zset.getAllMembers().reverse();
    const rank = allMembers.indexOf(member);
    return rank >= 0 ? rank : null;
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  async zrangebyscore(key: string, min: number, max: number): Promise<any[]> {
    const zset = this.sortedSets.get(key);
    if (!zset) return [];

    return zset.rangeByScore(min, max);
  }

  async zcount(key: string, min: number, max: number): Promise<number> {
    const zset = this.sortedSets.get(key);
    if (!zset) return 0;

    const results = zset.rangeByScore(min, max);
    return results.length;
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  async zincrby(key: string, increment: number, member: any): Promise<number> {
    this.validateKey(key);
    const scores = this.sortedSetScores.get(key) || new Map();
    const zset = this.sortedSets.get(key) || new SkipList();
    
    const currentScore = scores.get(member) ?? 0;
    const newScore = currentScore + increment;
    
    // Remove old entry if exists
    if (scores.has(member)) {
      zset.remove(currentScore);
    }
    
    // Insert with new score
    zset.insert(member, newScore);
    scores.set(member, newScore);
    
    this.sortedSets.set(key, zset);
    this.sortedSetScores.set(key, scores);
    
    return newScore;
  }

  // Stream Operations - Optimized for time-based operations
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  async xadd(key: string, id: string, fields: Record<string, any>): Promise<string> {
    this.validateKey(key);
    const stream = this.streams.get(key) || [];

    // Generate ID if '*' provided
    if (id === '*') {
      const timestamp = Date.now();
      const sequence = stream.filter(e => {
        const entryTs = parseInt(e.id.split('-')[0] || '0');
        return entryTs === timestamp;
      }).length;
      id = `${timestamp}-${sequence}`;
    }

    const entry: StreamEntry = {
      id,
      fields,
      timestamp: Date.now()
    };

    stream.push(entry);
    // Keep stream sorted by ID (timestamp-sequence)
    stream.sort((a, b) => {
      const [tsA, seqA] = a.id.split('-').map(Number);
      const [tsB, seqB] = b.id.split('-').map(Number);
      if (tsA !== tsB) return tsA - tsB;
      return (seqA || 0) - (seqB || 0);
    });
    
    this.streams.set(key, stream);
    return id;
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  async xrange(key: string, start: string, end: string): Promise<StreamEntry[]> {
    const stream = this.streams.get(key);
    if (!stream) return [];

    // Handle '-' as start (beginning) and '+' as end (end)
    if (start === '-') start = '0-0';
    if (end === '+') {
      const lastEntry = stream[stream.length - 1];
      end = lastEntry ? lastEntry.id : '0-0';
    }

    const [startTs, startSeq] = start.split('-').map(Number);
    const [endTs, endSeq] = end.split('-').map(Number);

    return stream.filter(entry => {
      const [entryTs, entrySeq] = entry.id.split('-').map(Number);
      if (entryTs < startTs || entryTs > endTs) return false;
      if (entryTs === startTs && (entrySeq || 0) < (startSeq || 0)) return false;
      if (entryTs === endTs && (entrySeq || 0) > (endSeq || 0)) return false;
      return true;
    });
  }

  async xlen(_key: string): Promise<number> {
    const stream = this.streams.get(_key);
    return stream ? stream.length : 0;
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars, no-unused-vars, @typescript-eslint/no-explicit-any
  async xread(_streams: Record<string, string>, _count?: number, _block?: number): Promise<Record<string, any[]>> {
    // Simplified - in production would need proper stream reading with blocking
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const result: Record<string, any[]> = {};
    for (const [key] of Object.entries(_streams)) {
      const stream = this.streams.get(key);
      if (stream) {
        // Simplified - return recent entries
        result[key] = stream.slice(-10); // Last 10 entries
      } else {
        result[key] = [];
      }
    }
    return result;
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any, @typescript-eslint/no-unused-vars, no-unused-vars
  async xrevrange(_key: string, _end: string, _start: string, _count?: number): Promise<any[]> {
    return this.xrange(_key, _start, _end); // Simplified
  }

  async xdel(key: string, ids: string[]): Promise<number> {
    const stream = this.streams.get(key);
    if (!stream) return 0;

    const idSet = new Set(ids);
    const initialLength = stream.length;
    
    // Remove entries with matching IDs
    for (let i = stream.length - 1; i >= 0; i--) {
      if (idSet.has(stream[i].id)) {
        stream.splice(i, 1);
      }
    }
    
    this.streams.set(key, stream);
    return initialLength - stream.length;
  }

  async xtrim(key: string, strategy: 'maxlen' | 'minid', threshold: string | number): Promise<number> {
    const stream = this.streams.get(key);
    if (!stream) return 0;

    const initialLength = stream.length;

    if (strategy === 'maxlen') {
      const maxLen = typeof threshold === 'number' ? threshold : parseInt(threshold.toString());
      if (stream.length > maxLen) {
        stream.splice(0, stream.length - maxLen);
      }
    } else if (strategy === 'minid') {
      const minId = threshold.toString();
      const [minTs, minSeq] = minId.split('-').map(Number);
      
      let removeCount = 0;
      for (let i = 0; i < stream.length; i++) {
        const [entryTs, entrySeq] = stream[i].id.split('-').map(Number);
        if (entryTs < minTs || (entryTs === minTs && (entrySeq || 0) < (minSeq || 0))) {
          removeCount++;
        } else {
          break;
        }
      }
      
      if (removeCount > 0) {
        stream.splice(0, removeCount);
      }
    }

    this.streams.set(key, stream);
    return initialLength - stream.length;
  }

  // Geospatial Operations - Would use R-tree in production
  // eslint-disable-next-line @typescript-eslint/no-unused-vars, no-unused-vars
  async geoadd(_key: string, _longitude: number, _latitude: number, _member: string, _name?: string): Promise<number> {
    this.validateKey(_key);
    const geo = this.geospatial.get(_key) || new Map();

    const entry: GeospatialEntry = {
      id: _member,
      longitude: _longitude,
      latitude: _latitude
    };

    geo.set(_member, entry);
    this.geospatial.set(_key, geo);

    return 1;
  }

  async geopos(_key: string, _members: string[]): Promise<Array<{ longitude: number; latitude: number } | null>> {
    const geo = this.geospatial.get(_key);
    if (!geo) return _members.map(() => null);

    return _members.map(member => {
      const entry = geo.get(member);
      return entry ? { longitude: entry.longitude, latitude: entry.latitude } : null;
    });
  }

  async geodist(key: string, member1: string, member2: string, unit: 'm' | 'km' | 'mi' | 'ft' = 'm'): Promise<number | null> {
    const geo = this.geospatial.get(key);
    if (!geo) return null;

    const entry1 = geo.get(member1);
    const entry2 = geo.get(member2);

    if (!entry1 || !entry2) return null;

    const distanceInMeters = this.calculateDistance(entry1.latitude, entry1.longitude, entry2.latitude, entry2.longitude);
    const conversions = { m: 1, km: 0.001, mi: 0.000621371, ft: 3.28084 };
    return distanceInMeters * conversions[unit];
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  async georadius(key: string, longitude: number, latitude: number, radius: number, unit: 'm' | 'km' | 'mi' | 'ft', options?: { withCoord?: boolean; withDist?: boolean; count?: number }): Promise<any[]> {
    const geo = this.geospatial.get(key);
    if (!geo) return [];

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const results: any[] = [];
    const radiusInMeters = this.convertToMeters(radius, unit);

    for (const [member, entry] of geo) {
      const distance = this.calculateDistance(latitude, longitude, entry.latitude, entry.longitude);
      if (distance <= radiusInMeters) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        let result: any = member;
        if (options?.withCoord) {
          result = { member, coordinates: [entry.longitude, entry.latitude] };
        }
        if (options?.withDist) {
          result = { ...result, distance };
        }
        results.push(result);
      }
    }

    // Apply count limit if specified
    if (options?.count) {
      results.splice(options.count);
    }

    return results;
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  async georadiusbymember(key: string, member: string, radius: number, unit: 'm' | 'km' | 'mi' | 'ft', options?: { withCoord?: boolean; withDist?: boolean; count?: number }): Promise<any[]> {
    const geo = this.geospatial.get(key);
    if (!geo) return [];

    const centerEntry = geo.get(member);
    if (!centerEntry) return [];

    return this.georadius(key, centerEntry.longitude, centerEntry.latitude, radius, unit, options);
  }

  async geohash(key: string, members: string[]): Promise<string[]> {
    // Simplified - in production would generate actual geohashes
    return members.map(() => 'geohash_placeholder');
  }

  private convertToMeters(distance: number, unit: 'm' | 'km' | 'mi' | 'ft'): number {
    const conversions = { m: 1, km: 1000, mi: 1609.34, ft: 0.3048 };
    return distance * conversions[unit];
  }

  // Time Series Operations - Optimized for time-based queries
  async tsadd(key: string, timestamp: number, value: number, labels?: Record<string, string>): Promise<void> {
    this.validateKey(key);
    const series = this.timeSeries.get(key) || [];

    const entry: TimeSeriesEntry = {
      timestamp,
      value,
      labels
    };

    series.push(entry);
    // Keep sorted by timestamp for efficient queries
    series.sort((a, b) => a.timestamp - b.timestamp);
    this.timeSeries.set(key, series);

    // Return void as per interface
  }

  async tsget(key: string, timestamp: number): Promise<TimeSeriesEntry | null> {
    const series = this.timeSeries.get(key);
    if (!series || series.length === 0) return null;

    // Binary search since series is sorted by timestamp (O(log n))
    let left = 0;
    let right = series.length - 1;

    while (left <= right) {
      const mid = Math.floor((left + right) / 2);
      const entry = series[mid];

      if (entry.timestamp === timestamp) {
        return entry;
      } else if (entry.timestamp < timestamp) {
        left = mid + 1;
      } else {
        right = mid - 1;
      }
    }

    return null;
  }

  async tsrange(key: string, startTime: number, endTime: number): Promise<TimeSeriesEntry[]> {
    const series = this.timeSeries.get(key);
    if (!series || series.length === 0) return [];

    // Binary search for start position (O(log n) + O(k) where k = result count)
    const startIndex = this.binarySearchStart(series, startTime);
    const endIndex = this.binarySearchEnd(series, endTime);

    if (startIndex === -1 || endIndex === -1 || startIndex > endIndex) {
      return [];
    }

    return series.slice(startIndex, endIndex + 1);
  }

  /**
   * Binary search for the first index where timestamp >= target
   * Time complexity: O(log n)
   */
  private binarySearchStart(series: TimeSeriesEntry[], target: number): number {
    let left = 0;
    let right = series.length - 1;
    let result = -1;

    while (left <= right) {
      const mid = Math.floor((left + right) / 2);
      if (series[mid].timestamp >= target) {
        result = mid;
        right = mid - 1;
      } else {
        left = mid + 1;
      }
    }

    return result;
  }

  /**
   * Binary search for the last index where timestamp <= target
   * Time complexity: O(log n)
   */
  private binarySearchEnd(series: TimeSeriesEntry[], target: number): number {
    let left = 0;
    let right = series.length - 1;
    let result = -1;

    while (left <= right) {
      const mid = Math.floor((left + right) / 2);
      if (series[mid].timestamp <= target) {
        result = mid;
        left = mid + 1;
      } else {
        right = mid - 1;
      }
    }

    return result;
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  async tslast(key: string): Promise<any> {
    const series = this.timeSeries.get(key);
    if (!series || series.length === 0) return null;
    // Return entry with highest timestamp (last chronologically)
    return series[series.length - 1];
  }

  async tscount(key: string): Promise<number> {
    const series = this.timeSeries.get(key);
    return series ? series.length : 0;
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  async tsmin(key: string): Promise<any> {
    const series = this.timeSeries.get(key);
    if (!series || series.length === 0) return null;

    let minEntry = series[0];
    for (const entry of series) {
      if (entry.value < minEntry.value) {
        minEntry = entry;
      }
    }
    return minEntry;
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  async tsmax(key: string): Promise<any> {
    const series = this.timeSeries.get(key);
    if (!series || series.length === 0) return null;

    let maxEntry = series[0];
    for (const entry of series) {
      if (entry.value > maxEntry.value) {
        maxEntry = entry;
      }
    }
    return maxEntry;
  }

  async tsavg(key: string, fromTimestamp?: number, toTimestamp?: number): Promise<number | null> {
    const series = this.timeSeries.get(key);
    if (!series || series.length === 0) return null;

    let entries = series;
    if (fromTimestamp !== undefined || toTimestamp !== undefined) {
      entries = series.filter(entry => {
        const fromCheck = fromTimestamp === undefined || entry.timestamp >= fromTimestamp;
        const toCheck = toTimestamp === undefined || entry.timestamp <= toTimestamp;
        return fromCheck && toCheck;
      });
    }

    if (entries.length === 0) return null;

    const sum = entries.reduce((acc, entry) => acc + entry.value, 0);
    return sum / entries.length;
  }

  async tsrevrange(key: string, fromTimestamp: number, toTimestamp: number): Promise<TimeSeriesEntry[]> {
    // Note: fromTimestamp should be <= toTimestamp, but we reverse the order for reverse range
    const results = await this.tsrange(key, fromTimestamp, toTimestamp);
    return results.reverse();
  }

  // Vector Operations - Using map-based storage with cosine similarity
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  async vadd(key: string, id: string, vector: number[], metadata?: Record<string, any>): Promise<void> {
    this.validateKey(key);
    const vectors = this.vectors.get(key) || new Map<string, VectorEntry>();

    const entry: VectorEntry = { id, vector, metadata };
    vectors.set(id, entry);
    this.vectors.set(key, vectors);
  }

  async vget(key: string, id: string): Promise<VectorEntry | null> {
    const vectors = this.vectors.get(key);
    if (!vectors) return null;

    return vectors.get(id) || null;
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars, no-unused-vars
  async vsearch(key: string, queryVector: number[], topK?: number, includeMetadata?: boolean): Promise<VectorSearchResult[]> {
    const vectors = this.vectors.get(key);
    if (!vectors) return [];

    const k = topK || 10;
    const vectorCount = vectors.size;
    
    // Optimize: Use heap for top-k instead of full sort (O(n log k) vs O(n log n))
    if (vectorCount > k * 2) {
      return this.topKVectorSearch(vectors, queryVector, k, includeMetadata);
    }

    // For small datasets, full sort is faster
    const results: VectorSearchResult[] = [];
    results.length = vectorCount; // Pre-allocate

    let index = 0;
    for (const [id, entry] of vectors) {
      const score = this.cosineSimilarity(queryVector, entry.vector);
      results[index++] = {
        id,
        score,
        metadata: includeMetadata ? entry.metadata : undefined
      };
    }

    // Sort by score (descending) and return top K
    results.sort((a, b) => b.score - a.score);
    return results.slice(0, k);
  }

  /**
   * Top-K vector search using min-heap (optimized for large datasets)
   * Time complexity: O(n log k) instead of O(n log n)
   */
  private topKVectorSearch(
    vectors: Map<string, VectorEntry>,
    queryVector: number[],
    k: number,
    includeMetadata?: boolean
  ): VectorSearchResult[] {
    // Min-heap to keep top K results
    const heap: VectorSearchResult[] = [];

    const addToHeap = (result: VectorSearchResult): void => {
      if (heap.length < k) {
        heap.push(result);
        // Bubble up
        let i = heap.length - 1;
        while (i > 0) {
          const parent = Math.floor((i - 1) / 2);
          if (heap[parent].score <= heap[i].score) break;
          [heap[parent], heap[i]] = [heap[i], heap[parent]];
          i = parent;
        }
      } else if (result.score > heap[0].score) {
        // Replace minimum
        heap[0] = result;
        // Bubble down
        let i = 0;
        while (true) {
          const left = 2 * i + 1;
          const right = 2 * i + 2;
          let smallest = i;

          if (left < heap.length && heap[left].score < heap[smallest].score) {
            smallest = left;
          }
          if (right < heap.length && heap[right].score < heap[smallest].score) {
            smallest = right;
          }

          if (smallest === i) break;
          [heap[i], heap[smallest]] = [heap[smallest], heap[i]];
          i = smallest;
        }
      }
    };

    // Process all vectors
    for (const [id, entry] of vectors) {
      const score = this.cosineSimilarity(queryVector, entry.vector);
      addToHeap({
        id,
        score,
        metadata: includeMetadata ? entry.metadata : undefined
      });
    }

    // Extract and sort results (heap is min-heap, so reverse sort)
    return heap.sort((a, b) => b.score - a.score);
  }

  async vdel(key: string, ids: string[]): Promise<number> {
    const vectors = this.vectors.get(key);
    if (!vectors) return 0;

    let deleted = 0;
    for (const id of ids) {
      if (vectors.delete(id)) {
        deleted++;
      }
    }

    return deleted;
  }

  async vcount(key: string): Promise<number> {
    const vectors = this.vectors.get(key);
    return vectors ? vectors.size : 0;
  }

  // Graph Operations
  async gcreateNode(graphKey: string, label?: string, properties?: Record<string, any>): Promise<string> {
    this.validateKey(graphKey);
    let graph = this.graphs.get(graphKey);
    if (!graph) {
      graph = new GraphDatabase();
      this.graphs.set(graphKey, graph);
    }
    return graph.createNode(label, properties || {});
  }

  async ggetNode(graphKey: string, nodeId: string): Promise<any | null> {
    this.validateKey(graphKey);
    const graph = this.graphs.get(graphKey);
    if (!graph) {
      return null;
    }
    return graph.getNode(nodeId) || null;
  }

  async gupdateNode(graphKey: string, nodeId: string, properties: Record<string, any>): Promise<boolean> {
    this.validateKey(graphKey);
    const graph = this.graphs.get(graphKey);
    if (!graph) {
      return false;
    }
    return graph.updateNode(nodeId, properties);
  }

  async gdeleteNode(graphKey: string, nodeId: string): Promise<boolean> {
    this.validateKey(graphKey);
    const graph = this.graphs.get(graphKey);
    if (!graph) {
      return false;
    }
    return graph.deleteNode(nodeId);
  }

  async gcreateEdge(
    graphKey: string,
    from: string,
    to: string,
    type?: string,
    properties?: Record<string, any>
  ): Promise<string> {
    this.validateKey(graphKey);
    const graph = this.graphs.get(graphKey);
    if (!graph) {
      throw new Error(`Graph '${graphKey}' not found. Create nodes first to initialize the graph.`);
    }
    return graph.createEdge(from, to, type, properties || {});
  }

  async ggetEdge(graphKey: string, edgeId: string): Promise<any | null> {
    this.validateKey(graphKey);
    const graph = this.graphs.get(graphKey);
    if (!graph) {
      return null;
    }
    return graph.getEdge(edgeId) || null;
  }

  async gupdateEdge(graphKey: string, edgeId: string, properties: Record<string, any>): Promise<boolean> {
    this.validateKey(graphKey);
    const graph = this.graphs.get(graphKey);
    if (!graph) {
      return false;
    }
    return graph.updateEdge(edgeId, properties);
  }

  async gdeleteEdge(graphKey: string, edgeId: string): Promise<boolean> {
    this.validateKey(graphKey);
    const graph = this.graphs.get(graphKey);
    if (!graph) {
      return false;
    }
    return graph.deleteEdge(edgeId);
  }

  async ggetNeighbors(
    graphKey: string,
    nodeId: string,
    direction: 'outgoing' | 'incoming' | 'both' = 'both'
  ): Promise<any[]> {
    this.validateKey(graphKey);
    const graph = this.graphs.get(graphKey);
    if (!graph) {
      return [];
    }
    return graph.getNeighbors(nodeId, direction);
  }

  async gtraverse(graphKey: string, startNodeId: string, options?: any): Promise<any> {
    this.validateKey(graphKey);
    const graph = this.graphs.get(graphKey);
    if (!graph) {
      throw new Error(`Graph '${graphKey}' not found. Create nodes first to initialize the graph.`);
    }
    return graph.traverse(startNodeId, options);
  }

  async gfindByLabel(graphKey: string, label: string): Promise<any[]> {
    this.validateKey(graphKey);
    const graph = this.graphs.get(graphKey);
    if (!graph) {
      return [];
    }
    return graph.findByLabel(label);
  }

  async gfindByProperty(graphKey: string, field: string, value: any): Promise<any[]> {
    this.validateKey(graphKey);
    const graph = this.graphs.get(graphKey);
    if (!graph) {
      return [];
    }
    return graph.findByProperty(field, value);
  }

  async ggetStats(graphKey: string): Promise<any> {
    this.validateKey(graphKey);
    const graph = this.graphs.get(graphKey);
    if (!graph) {
      return {
        nodeCount: 0,
        edgeCount: 0,
        labels: 0,
        edgeTypes: 0,
        averageDegree: 0
      };
    }
    return graph.getStats();
  }

  // Utility methods
  private validateKey(key: string): void {
    if (!key || typeof key !== 'string') {
      throw new Error('Key must be a non-empty string');
    }

    if (key.length > globalConfig.getLimits().maxFieldNameLength) {
      throw new ResourceLimitError(
        'Key too long',
        'key',
        globalConfig.getLimits().maxFieldNameLength,
        key.length
      );
    }
  }

  private cosineSimilarity(vecA: number[], vecB: number[]): number {
    if (vecA.length !== vecB.length) return 0;

    let dotProduct = 0;
    let normA = 0;
    let normB = 0;

    for (let i = 0; i < vecA.length; i++) {
      dotProduct += vecA[i] * vecB[i];
      normA += vecA[i] * vecA[i];
      normB += vecB[i] * vecB[i];
    }

    if (normA === 0 || normB === 0) return 0;

    return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
  }

  private calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
    const R = 6371e3; // Earth's radius in meters
    const φ1 = lat1 * Math.PI / 180;
    const φ2 = lat2 * Math.PI / 180;
    const Δφ = (lat2 - lat1) * Math.PI / 180;
    const Δλ = (lon2 - lon1) * Math.PI / 180;

    const a = Math.sin(Δφ/2) * Math.sin(Δφ/2) +
              Math.cos(φ1) * Math.cos(φ2) *
              Math.sin(Δλ/2) * Math.sin(Δλ/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));

    return R * c;
  }
}
