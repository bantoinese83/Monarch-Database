import { Document } from './types';
import { logger } from './logger';

/**
 * Redis-Compatible Data Structures Engine for Monarch Database
 * Implements Redis-style commands and data structures
 */
export class RedisEngine {
  private data = new Map<string, any>();

  /**
   * STRING operations
   */
  set(key: string, value: any, options?: { ex?: number; px?: number; nx?: boolean; xx?: boolean }): boolean {
    if (options?.nx && this.data.has(key)) return false;
    if (options?.xx && !this.data.has(key)) return false;

    this.data.set(key, {
      value,
      type: 'string',
      expires: options?.ex ? Date.now() + (options.ex * 1000) : options?.px ? Date.now() + options.px : undefined
    });

    logger.debug('SET', { key, options });
    return true;
  }

  get(key: string): string | null {
    const entry = this.data.get(key);
    if (!entry || this.isExpired(entry)) {
      if (entry && this.isExpired(entry)) this.data.delete(key);
      return null;
    }
    return String(entry.value);
  }

  incr(key: string): number {
    const current = this.get(key);
    const value = (parseInt(current || '0') || 0) + 1;
    this.set(key, value);
    return value;
  }

  decr(key: string): number {
    const current = this.get(key);
    const value = (parseInt(current || '0') || 0) - 1;
    this.set(key, value);
    return value;
  }

  incrby(key: string, increment: number): number {
    const current = this.get(key);
    const value = (parseInt(current || '0') || 0) + increment;
    this.set(key, value);
    return value;
  }

  mset(keyValuePairs: Record<string, any>): 'OK' {
    for (const [key, value] of Object.entries(keyValuePairs)) {
      this.set(key, value);
    }
    return 'OK';
  }

  mget(keys: string[]): (string | null)[] {
    return keys.map(key => this.get(key));
  }

  /**
   * LIST operations
   */
  lpush(key: string, ...values: any[]): number {
    let list = this.getList(key);
    list.unshift(...values);
    this.data.set(key, { value: list, type: 'list' });
    return list.length;
  }

  rpush(key: string, ...values: any[]): number {
    let list = this.getList(key);
    list.push(...values);
    this.data.set(key, { value: list, type: 'list' });
    return list.length;
  }

  lpop(key: string): any {
    const list = this.getList(key);
    if (list.length === 0) return null;
    const value = list.shift();
    this.data.set(key, { value: list, type: 'list' });
    return value;
  }

  rpop(key: string): any {
    const list = this.getList(key);
    if (list.length === 0) return null;
    const value = list.pop();
    this.data.set(key, { value: list, type: 'list' });
    return value;
  }

  lrange(key: string, start: number, end: number): any[] {
    const list = this.getList(key);
    const normalizedEnd = end < 0 ? list.length + end : end;
    return list.slice(start, normalizedEnd + 1);
  }

  lindex(key: string, index: number): any {
    const list = this.getList(key);
    return list[index] || null;
  }

  lset(key: string, index: number, value: any): 'OK' | null {
    const list = this.getList(key);
    if (index < 0 || index >= list.length) return null;
    list[index] = value;
    this.data.set(key, { value: list, type: 'list' });
    return 'OK';
  }

  llen(key: string): number {
    return this.getList(key).length;
  }

  /**
   * SET operations
   */
  sadd(key: string, ...members: any[]): number {
    let set = this.getSet(key);
    let added = 0;
    for (const member of members) {
      if (!set.has(member)) {
        set.add(member);
        added++;
      }
    }
    this.data.set(key, { value: set, type: 'set' });
    return added;
  }

  srem(key: string, ...members: any[]): number {
    const set = this.getSet(key);
    let removed = 0;
    for (const member of members) {
      if (set.delete(member)) removed++;
    }
    this.data.set(key, { value: set, type: 'set' });
    return removed;
  }

  smembers(key: string): any[] {
    return Array.from(this.getSet(key));
  }

  sismember(key: string, member: any): boolean {
    return this.getSet(key).has(member);
  }

  scard(key: string): number {
    return this.getSet(key).size;
  }

  srandmember(key: string, count?: number): any[] {
    const set = this.getSet(key);
    const members = Array.from(set);
    if (!count || count >= members.length) return members;

    const result = [];
    const shuffled = [...members].sort(() => Math.random() - 0.5);
    for (let i = 0; i < count; i++) {
      result.push(shuffled[i]);
    }
    return result;
  }

  /**
   * HASH operations
   */
  hset(key: string, field: string, value: any): number {
    let hash = this.getHash(key);
    const isNew = !hash.has(field);
    hash.set(field, value);
    this.data.set(key, { value: hash, type: 'hash' });
    return isNew ? 1 : 0;
  }

  hget(key: string, field: string): any {
    const hash = this.getHash(key);
    return hash.get(field) || null;
  }

  hgetall(key: string): Record<string, any> {
    const hash = this.getHash(key);
    const result: Record<string, any> = {};
    for (const [field, value] of hash) {
      result[field] = value;
    }
    return result;
  }

  hdel(key: string, ...fields: string[]): number {
    const hash = this.getHash(key);
    let deleted = 0;
    for (const field of fields) {
      if (hash.delete(field)) deleted++;
    }
    this.data.set(key, { value: hash, type: 'hash' });
    return deleted;
  }

  hkeys(key: string): string[] {
    return Array.from(this.getHash(key).keys());
  }

  hvals(key: string): any[] {
    return Array.from(this.getHash(key).values());
  }

  hlen(key: string): number {
    return this.getHash(key).size;
  }

  /**
   * SORTED SET operations
   */
  zadd(key: string, ...scoreMembers: [number, any][]): number {
    let zset = this.getSortedSet(key);
    let added = 0;
    for (const [score, member] of scoreMembers) {
      if (!zset.has(member)) added++;
      zset.set(member, score);
    }
    this.data.set(key, { value: zset, type: 'zset' });
    return added;
  }

  zrange(key: string, start: number, end: number, withScores: boolean = false): any[] {
    const zset = this.getSortedSet(key);
    const sorted = Array.from(zset.entries()).sort((a, b) => a[1] - b[1]);
    const result = sorted.slice(start, end + 1);

    if (withScores) {
      return result.flat();
    }
    return result.map(([member]) => member);
  }

  zrevrange(key: string, start: number, end: number, withScores: boolean = false): any[] {
    const zset = this.getSortedSet(key);
    const sorted = Array.from(zset.entries()).sort((a, b) => b[1] - a[1]);
    const result = sorted.slice(start, end + 1);

    if (withScores) {
      return result.flat();
    }
    return result.map(([member]) => member);
  }

  zscore(key: string, member: any): number | null {
    const zset = this.getSortedSet(key);
    return zset.get(member) || null;
  }

  zrem(key: string, ...members: any[]): number {
    const zset = this.getSortedSet(key);
    let removed = 0;
    for (const member of members) {
      if (zset.delete(member)) removed++;
    }
    this.data.set(key, { value: zset, type: 'zset' });
    return removed;
  }

  /**
   * General operations
   */
  del(...keys: string[]): number {
    let deleted = 0;
    for (const key of keys) {
      if (this.data.delete(key)) deleted++;
    }
    return deleted;
  }

  exists(...keys: string[]): number {
    let count = 0;
    for (const key of keys) {
      const entry = this.data.get(key);
      if (entry && !this.isExpired(entry)) count++;
    }
    return count;
  }

  type(key: string): string {
    const entry = this.data.get(key);
    if (!entry || this.isExpired(entry)) return 'none';
    return entry.type;
  }

  keys(pattern: string): string[] {
    const regex = new RegExp(pattern.replace(/\*/g, '.*'));
    const keys: string[] = [];
    for (const key of this.data.keys()) {
      if (regex.test(key)) {
        const entry = this.data.get(key);
        if (entry && !this.isExpired(entry)) {
          keys.push(key);
        }
      }
    }
    return keys;
  }

  expire(key: string, seconds: number): boolean {
    const entry = this.data.get(key);
    if (!entry) return false;
    entry.expires = Date.now() + (seconds * 1000);
    return true;
  }

  ttl(key: string): number {
    const entry = this.data.get(key);
    if (!entry) return -2; // Key doesn't exist
    if (!entry.expires) return -1; // No expiration
    const remaining = entry.expires - Date.now();
    return remaining > 0 ? Math.ceil(remaining / 1000) : -2;
  }

  dbsize(): number {
    let count = 0;
    for (const [key, entry] of this.data) {
      if (!this.isExpired(entry)) count++;
    }
    return count;
  }

  flushdb(): 'OK' {
    this.data.clear();
    return 'OK';
  }

  private getList(key: string): any[] {
    const entry = this.data.get(key);
    if (!entry || entry.type !== 'list' || this.isExpired(entry)) {
      return [];
    }
    return entry.value;
  }

  private getSet(key: string): Set<any> {
    const entry = this.data.get(key);
    if (!entry || entry.type !== 'set' || this.isExpired(entry)) {
      return new Set();
    }
    return entry.value;
  }

  private getHash(key: string): Map<string, any> {
    const entry = this.data.get(key);
    if (!entry || entry.type !== 'hash' || this.isExpired(entry)) {
      return new Map();
    }
    return entry.value;
  }

  private getSortedSet(key: string): Map<any, number> {
    const entry = this.data.get(key);
    if (!entry || entry.type !== 'zset' || this.isExpired(entry)) {
      return new Map();
    }
    return entry.value;
  }

  private isExpired(entry: any): boolean {
    return entry.expires && entry.expires <= Date.now();
  }
}
