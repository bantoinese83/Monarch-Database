import { describe, it, expect, beforeEach } from 'vitest';
import { OptimizedDataStructures as DataStructures } from '../src/optimized-data-structures';

describe('DataStructures', () => {
  let ds: DataStructures;

  beforeEach(() => {
    ds = new DataStructures();
  });

  describe('List Operations', () => {
    it('should push and pop elements from left', async () => {
      await ds.lpush('mylist', ['world']);
      await ds.lpush('mylist', ['hello']);
      expect(await ds.lpop('mylist')).toBe('hello');
      expect(await ds.lpop('mylist')).toBe('world');
    });

    it('should push and pop elements from right', async () => {
      await ds.rpush('mylist', ['hello']);
      await ds.rpush('mylist', ['world']);
      expect(await ds.rpop('mylist')).toBe('world');
      expect(await ds.rpop('mylist')).toBe('hello');
    });

    it('should get range of elements', async () => {
      await ds.rpush('mylist', ['a', 'b', 'c', 'd', 'e']);
      expect(await ds.lrange('mylist', 0, 2)).toEqual(['a', 'b', 'c']);
      expect(await ds.lrange('mylist', -2, -1)).toEqual(['d', 'e']);
    });

    it('should get length of list', async () => {
      await ds.rpush('mylist', ['a', 'b', 'c']);
      expect(await ds.llen('mylist')).toBe(3);
    });

    it('should trim list', async () => {
      await ds.rpush('mylist', ['a', 'b', 'c', 'd', 'e']);
      await ds.ltrim('mylist', 1, 3);
      expect(await ds.lrange('mylist', 0, -1)).toEqual(['b', 'c', 'd']);
    });

    it('should get element by index', async () => {
      await ds.rpush('mylist', ['a', 'b', 'c']);
      expect(await ds.lindex('mylist', 1)).toBe('b');
      expect(await ds.lindex('mylist', -1)).toBe('c');
    });

    it('should set element by index', async () => {
      await ds.rpush('mylist', ['a', 'b', 'c']);
      await ds.lset('mylist', 1, 'x');
      expect(await ds.lindex('mylist', 1)).toBe('x');
    });

    it('should remove elements by value', async () => {
      await ds.rpush('mylist', ['a', 'b', 'a', 'c', 'a']);
      expect(await ds.lrem('mylist', 2, 'a')).toBe(2);
      expect(await ds.lrange('mylist', 0, -1)).toEqual(['b', 'c', 'a']);
    });
  });

  describe('Set Operations', () => {
    it('should add and check membership', async () => {
      expect(await ds.sadd('myset', ['a', 'b', 'c'])).toBe(3);
      expect(await ds.sismember('myset', 'a')).toBe(true);
      expect(await ds.sismember('myset', 'd')).toBe(false);
    });

    it('should remove members', async () => {
      await ds.sadd('myset', ['a', 'b', 'c']);
      expect(await ds.srem('myset', ['a', 'd'])).toBe(1);
      expect(await ds.sismember('myset', 'a')).toBe(false);
    });

    it('should get all members', async () => {
      await ds.sadd('myset', ['a', 'b', 'c']);
      const members = await ds.smembers('myset');
      expect(members).toHaveLength(3);
      expect(members).toContain('a');
      expect(members).toContain('b');
      expect(members).toContain('c');
    });

    it('should get set cardinality', async () => {
      await ds.sadd('myset', ['a', 'b', 'c']);
      expect(await ds.scard('myset')).toBe(3);
    });

    it('should compute set difference', async () => {
      await ds.sadd('set1', ['a', 'b', 'c']);
      await ds.sadd('set2', ['b', 'c', 'd']);
      const diff = await ds.sdiff(['set1', 'set2']);
      expect(diff).toContain('a');
      expect(diff).not.toContain('b');
      expect(diff).not.toContain('c');
    });

    it('should compute set intersection', async () => {
      await ds.sadd('set1', ['a', 'b', 'c']);
      await ds.sadd('set2', ['b', 'c', 'd']);
      const inter = await ds.sinter(['set1', 'set2']);
      expect(inter).toContain('b');
      expect(inter).toContain('c');
      expect(inter).not.toContain('a');
      expect(inter).not.toContain('d');
    });

    it('should compute set union', async () => {
      await ds.sadd('set1', ['a', 'b']);
      await ds.sadd('set2', ['b', 'c']);
      const union = await ds.sunion(['set1', 'set2']);
      expect(union).toHaveLength(3);
      expect(union).toContain('a');
      expect(union).toContain('b');
      expect(union).toContain('c');
    });

    it('should get random members', async () => {
      await ds.sadd('myset', ['a', 'b', 'c', 'd', 'e']);
      const random = await ds.srandmember('myset', 2);
      expect(random).toHaveLength(2);
      expect(['a', 'b', 'c', 'd', 'e']).toEqual(expect.arrayContaining(random));
    });
  });

  describe('Hash Operations', () => {
    it('should set and get hash fields', async () => {
      expect(await ds.hset('myhash', 'field1', 'value1')).toBe(1);
      expect(await ds.hget('myhash', 'field1')).toBe('value1');
    });

    it('should get all hash fields', async () => {
      await ds.hset('myhash', 'field1', 'value1');
      await ds.hset('myhash', 'field2', 'value2');
      const all = await ds.hgetall('myhash');
      expect(all).toEqual({ field1: 'value1', field2: 'value2' });
    });

    it('should delete hash fields', async () => {
      await ds.hset('myhash', 'field1', 'value1');
      await ds.hset('myhash', 'field2', 'value2');
      expect(await ds.hdel('myhash', ['field1', 'field3'])).toBe(1);
      expect(await ds.hexists('myhash', 'field1')).toBe(false);
      expect(await ds.hexists('myhash', 'field2')).toBe(true);
    });

    it('should check field existence', async () => {
      await ds.hset('myhash', 'field1', 'value1');
      expect(await ds.hexists('myhash', 'field1')).toBe(true);
      expect(await ds.hexists('myhash', 'field2')).toBe(false);
    });

    it('should get hash keys and values', async () => {
      await ds.hset('myhash', 'field1', 'value1');
      await ds.hset('myhash', 'field2', 'value2');
      expect(await ds.hkeys('myhash')).toEqual(['field1', 'field2']);
      expect(await ds.hvals('myhash')).toEqual(['value1', 'value2']);
    });

    it('should get hash length', async () => {
      await ds.hset('myhash', 'field1', 'value1');
      await ds.hset('myhash', 'field2', 'value2');
      expect(await ds.hlen('myhash')).toBe(2);
    });

    it('should increment hash field', async () => {
      await ds.hset('myhash', 'counter', '5');
      expect(await ds.hincrby('myhash', 'counter', 3)).toBe(8);
      expect(await ds.hincrbyfloat('myhash', 'counter', 1.5)).toBe(9.5);
    });
  });

  describe('Sorted Set Operations', () => {
    it('should add members with scores', async () => {
      expect(await ds.zadd('myzset', { member1: 1.5, member2: 2.5 })).toBe(2);
      expect(await ds.zscore('myzset', 'member1')).toBe(1.5);
    });

    it('should get rank of members', async () => {
      await ds.zadd('myzset', { alice: 1, bob: 2, charlie: 3 });
      expect(await ds.zrank('myzset', 'bob')).toBe(1);
      expect(await ds.zrevrank('myzset', 'bob')).toBe(1);
    });

    it('should get range of members', async () => {
      await ds.zadd('myzset', { a: 1, b: 2, c: 3, d: 4 });
      expect(await ds.zrange('myzset', 1, 2)).toEqual(['b', 'c']);
      expect(await ds.zrevrange('myzset', 0, 1)).toEqual(['d', 'c']);
    });

    it('should get range with scores', async () => {
      await ds.zadd('myzset', { a: 1, b: 2 });
      expect(await ds.zrange('myzset', 0, -1, true)).toEqual(['a', 1, 'b', 2]);
    });

    it('should get members by score range', async () => {
      await ds.zadd('myzset', { a: 1, b: 2, c: 3, d: 4 });
      expect(await ds.zrangebyscore('myzset', 2, 3)).toEqual(['b', 'c']);
    });

    it('should count members in score range', async () => {
      await ds.zadd('myzset', { a: 1, b: 2, c: 3, d: 4 });
      expect(await ds.zcount('myzset', 2, 3)).toBe(2);
    });

    it('should increment member score', async () => {
      await ds.zadd('myzset', { member: 5 });
      expect(await ds.zincrby('myzset', 3, 'member')).toBe(8);
    });

    it('should remove members', async () => {
      await ds.zadd('myzset', { a: 1, b: 2, c: 3 });
      expect(await ds.zrem('myzset', ['a', 'c'])).toBe(2);
      expect(await ds.zcard('myzset')).toBe(1);
    });
  });

  describe('Stream Operations', () => {
    it('should add entries to stream', async () => {
      const id1 = await ds.xadd('mystream', '*', { field1: 'value1' });
      const id2 = await ds.xadd('mystream', '*', { field2: 'value2' });
      expect(await ds.xlen('mystream')).toBe(2);
      expect(id1).toMatch(/^\d+-\d+$/);
      expect(id2).toMatch(/^\d+-\d+$/);
    });

    it('should read from streams', async () => {
      await ds.xadd('mystream', '1-0', { field1: 'value1' });
      await ds.xadd('mystream', '1-1', { field2: 'value2' });

      const result = await ds.xread({ mystream: '0' });
      expect(result.mystream).toHaveLength(2);
      expect(result.mystream[0].fields).toEqual({ field1: 'value1' });
    });

    it('should get range of stream entries', async () => {
      await ds.xadd('mystream', '1-0', { a: '1' });
      await ds.xadd('mystream', '1-1', { a: '2' });
      await ds.xadd('mystream', '1-2', { a: '3' });

      const range = await ds.xrange('mystream', '1-1', '1-2');
      expect(range).toHaveLength(2);
      expect(range[0].fields.a).toBe('2');
    });

    it('should delete stream entries', async () => {
      await ds.xadd('mystream', '1-0', { a: '1' });
      await ds.xadd('mystream', '1-1', { a: '2' });
      expect(await ds.xdel('mystream', ['1-0'])).toBe(1);
      expect(await ds.xlen('mystream')).toBe(1);
    });

    it('should trim stream', async () => {
      await ds.xadd('mystream', '1-0', { a: '1' });
      await ds.xadd('mystream', '1-1', { a: '2' });
      await ds.xadd('mystream', '1-2', { a: '3' });

      expect(await ds.xtrim('mystream', 'maxlen', 2)).toBe(1);
      expect(await ds.xlen('mystream')).toBe(2);
    });
  });

  describe('Geospatial Operations', () => {
    it('should add geospatial points', async () => {
      expect(await ds.geoadd('mygeo', -74.006, 40.7128, 'nyc')).toBe(1);
      expect(await ds.geoadd('mygeo', -87.6298, 41.8781, 'chicago')).toBe(1);
    });

    it('should get positions of points', async () => {
      await ds.geoadd('mygeo', -74.006, 40.7128, 'nyc');
      const positions = await ds.geopos('mygeo', ['nyc', 'missing']);
      expect(positions[0]).toEqual({ longitude: -74.006, latitude: 40.7128 });
      expect(positions[1]).toBeNull();
    });

    it('should calculate distance between points', async () => {
      await ds.geoadd('mygeo', -74.006, 40.7128, 'nyc');
      await ds.geoadd('mygeo', -87.6298, 41.8781, 'chicago');
      const distance = await ds.geodist('mygeo', 'nyc', 'chicago', 'km');
      expect(distance).toBeGreaterThan(1100);
      expect(distance).toBeLessThan(1200);
    });

    it('should find points within radius', async () => {
      await ds.geoadd('mygeo', -74.006, 40.7128, 'nyc');
      await ds.geoadd('mygeo', -73.935242, 40.730610, 'brooklyn');

      const nearby = await ds.georadius('mygeo', -74.006, 40.7128, 10, 'km');
      expect(nearby).toContain('nyc');
      expect(nearby).toContain('brooklyn');
    });

    it('should generate geohash', async () => {
      await ds.geoadd('mygeo', -74.006, 40.7128, 'nyc');
      const hashes = await ds.geohash('mygeo', ['nyc']);
      expect(hashes).toHaveLength(1);
      expect(typeof hashes[0]).toBe('string');
    });
  });

  describe('Time Series Operations', () => {
    it('should add time series entries', async () => {
      await ds.tsadd('mytimeseries', 1000, 25.5, { sensor: 'temp1' });
      await ds.tsadd('mytimeseries', 2000, 26.0, { sensor: 'temp1' });
      expect(await ds.tscount('mytimeseries')).toBe(2);
    });

    it('should get time series entry by timestamp', async () => {
      await ds.tsadd('mytimeseries', 1000, 25.5);
      const entry = await ds.tsget('mytimeseries', 1000);
      expect(entry?.value).toBe(25.5);
      expect(entry?.timestamp).toBe(1000);
    });

    it('should get time series range', async () => {
      await ds.tsadd('mytimeseries', 1000, 25.5);
      await ds.tsadd('mytimeseries', 2000, 26.0);
      await ds.tsadd('mytimeseries', 3000, 26.5);

      const range = await ds.tsrange('mytimeseries', 1500, 2500);
      expect(range).toHaveLength(1);
      expect(range[0].value).toBe(26.0);
    });

    it('should get min and max values', async () => {
      await ds.tsadd('mytimeseries', 1000, 25.5);
      await ds.tsadd('mytimeseries', 2000, 26.0);
      await ds.tsadd('mytimeseries', 3000, 24.5);

      const min = await ds.tsmin('mytimeseries');
      const max = await ds.tsmax('mytimeseries');

      expect(min?.value).toBe(24.5);
      expect(max?.value).toBe(26.0);
    });

    it('should calculate average', async () => {
      await ds.tsadd('mytimeseries', 1000, 20);
      await ds.tsadd('mytimeseries', 2000, 30);
      await ds.tsadd('mytimeseries', 3000, 40);

      const avg = await ds.tsavg('mytimeseries');
      expect(avg).toBe(30);
    });

    it('should get last entry', async () => {
      await ds.tsadd('mytimeseries', 1000, 20);
      await ds.tsadd('mytimeseries', 3000, 30);
      await ds.tsadd('mytimeseries', 2000, 25);

      const last = await ds.tslast('mytimeseries');
      expect(last?.timestamp).toBe(3000);
      expect(last?.value).toBe(30);
    });
  });

  describe('Vector Operations', () => {
    it('should add and retrieve vectors', async () => {
      await ds.vadd('myvectors', 'vec1', [1, 2, 3], { category: 'test' });
      const vector = await ds.vget('myvectors', 'vec1');
      expect(vector?.vector).toEqual([1, 2, 3]);
      expect(vector?.metadata).toEqual({ category: 'test' });
    });

    it('should search similar vectors', async () => {
      await ds.vadd('myvectors', 'vec1', [1, 0, 0]);
      await ds.vadd('myvectors', 'vec2', [0, 1, 0]);
      await ds.vadd('myvectors', 'vec3', [0, 0, 1]);

      const results = await ds.vsearch('myvectors', [1, 0, 0], 2);
      expect(results).toHaveLength(2);
      expect(results[0].id).toBe('vec1');
      expect(results[0].score).toBeGreaterThan(results[1].score);
    });

    it('should count vectors', async () => {
      await ds.vadd('myvectors', 'vec1', [1, 2, 3]);
      await ds.vadd('myvectors', 'vec2', [4, 5, 6]);
      expect(await ds.vcount('myvectors')).toBe(2);
    });

    it('should delete vectors', async () => {
      await ds.vadd('myvectors', 'vec1', [1, 2, 3]);
      await ds.vadd('myvectors', 'vec2', [4, 5, 6]);
      expect(await ds.vdel('myvectors', ['vec1'])).toBe(1);
      expect(await ds.vcount('myvectors')).toBe(1);
    });
  });
});
