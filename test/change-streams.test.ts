import { describe, it, expect, beforeEach } from 'vitest';
import { Monarch } from '../src';

describe('Change Streams', () => {
  let db: Monarch;
  let events: any[] = [];

  beforeEach(() => {
    db = new Monarch();
    events = [];
  });

  describe('Basic Change Stream Operations', () => {
    it('should add and remove change stream listeners', () => {
      const listenerId = db.watch({}, (event) => {
        events.push(event);
      });

      expect(typeof listenerId).toBe('string');

      const removed = db.unwatch(listenerId);
      expect(removed).toBe(true);

      // Try to remove again - should return false
      expect(db.unwatch(listenerId)).toBe(false);
    });

    it('should emit insert events', () => {
      const users = db.addCollection('users');

      db.watch({ collection: 'users', operation: 'insert' }, (event) => {
        events.push(event);
      });

      users.insert({ name: 'John', age: 30 });

      expect(events).toHaveLength(1);
      expect(events[0].type).toBe('insert');
      expect(events[0].collection).toBe('users');
      expect(events[0].document.name).toBe('John');
      expect(events[0].document.age).toBe(30);
      expect(typeof events[0].timestamp).toBe('number');
    });

    it('should emit update events', () => {
      const users = db.addCollection('users');

      db.watch({ collection: 'users' }, (event) => {
        events.push(event);
      });

      users.insert({ name: 'John', age: 30 });
      users.update({ name: 'John' }, { age: 31 });

      expect(events).toHaveLength(2);
      expect(events[0].type).toBe('insert');
      expect(events[1].type).toBe('update');
      expect(events[1].document.age).toBe(31);
    });

    it('should emit remove events', () => {
      const users = db.addCollection('users');

      db.watch({ operation: 'remove' }, (event) => {
        events.push(event);
      });

      users.insert({ name: 'John' });
      users.remove({ name: 'John' });

      expect(events).toHaveLength(1);
      expect(events[0].type).toBe('remove');
      expect(events[0].document.name).toBe('John');
    });
  });

  describe('Change Stream Filtering', () => {
    it('should filter by collection', () => {
      const users = db.addCollection('users');
      const posts = db.addCollection('posts');

      db.watch({ collection: 'users' }, (event) => {
        events.push(event);
      });

      users.insert({ name: 'John' });
      posts.insert({ title: 'Hello' });

      expect(events).toHaveLength(1);
      expect(events[0].collection).toBe('users');
    });

    it('should filter by operation type', () => {
      const users = db.addCollection('users');

      db.watch({ operation: 'insert' }, (event) => {
        events.push(event);
      });

      users.insert({ name: 'John' });
      users.update({ name: 'John' }, { age: 30 });

      expect(events).toHaveLength(1);
      expect(events[0].type).toBe('insert');
    });

    it('should support custom filter functions', () => {
      const users = db.addCollection('users');

      db.watch({
        filter: (event) => event.document.name === 'John'
      }, (event) => {
        events.push(event);
      });

      users.insert({ name: 'John' });
      users.insert({ name: 'Jane' });

      expect(events).toHaveLength(1);
      expect(events[0].document.name).toBe('John');
    });

    it('should support complex filtering', () => {
      const users = db.addCollection('users');

      db.watch({
        collection: 'users',
        operation: 'insert',
        filter: (event) => event.document.age && event.document.age > 25
      }, (event) => {
        events.push(event);
      });

      users.insert({ name: 'John', age: 30 }); // Should match
      users.insert({ name: 'Jane', age: 20 }); // Should not match (age too low)
      users.insert({ name: 'Bob' }); // Should not match (no age)
      users.update({ name: 'John' }, { age: 31 }); // Should not match (not insert)

      expect(events).toHaveLength(1);
      expect(events[0].document.name).toBe('John');
      expect(events[0].document.age).toBe(30);
    });
  });

  describe('Change Stream Management', () => {
    it('should get change stream statistics', () => {
      const users = db.addCollection('users');

      db.watch({ collection: 'users' }, () => {});
      db.watch({ operation: 'insert' }, () => {});
      db.watch({}, () => {});

      const stats = db.getChangeStreamStats();
      expect(stats.totalListeners).toBe(3);
      expect(stats.listenersByCollection.users).toBe(1);
      expect(stats.listenersByCollection['*']).toBe(2);
    });

    it('should handle listener errors gracefully', () => {
      const users = db.addCollection('users');

      // Add a listener that throws an error
      db.watch({}, (event) => {
        events.push(event);
        throw new Error('Listener error');
      });

      // Add another listener that should still work
      db.watch({}, (event) => {
        events.push({ ...event, processed: true });
      });

      users.insert({ name: 'John' });

      // Both listeners should have been called
      expect(events).toHaveLength(2);
      expect(events[0].document.name).toBe('John');
      expect(events[1].processed).toBe(true);
    });

    it('should limit the number of listeners', () => {
      // Add maximum listeners
      const listeners: string[] = [];
      for (let i = 0; i < 100; i++) {
        listeners.push(db.watch({}, () => {}));
      }

      // Try to add one more - should fail
      expect(() => db.watch({}, () => {})).toThrow('Maximum number of change stream listeners exceeded');

      // Clean up
      listeners.forEach(id => db.unwatch(id));
    });
  });

  describe('Real-time Notifications', () => {
    it('should notify multiple listeners of the same event', () => {
      const users = db.addCollection('users');
      const listener1Events: any[] = [];
      const listener2Events: any[] = [];

      db.watch({ collection: 'users' }, (event) => {
        listener1Events.push(event);
      });

      db.watch({ collection: 'users' }, (event) => {
        listener2Events.push(event);
      });

      users.insert({ name: 'John' });

      expect(listener1Events).toHaveLength(1);
      expect(listener2Events).toHaveLength(1);
      expect(listener1Events[0].document.name).toBe('John');
      expect(listener2Events[0].document.name).toBe('John');
    });

    it('should include timestamps in events', () => {
      const users = db.addCollection('users');
      const beforeInsert = Date.now();

      db.watch({}, (event) => {
        events.push(event);
      });

      users.insert({ name: 'John' });

      const afterInsert = Date.now();

      expect(events[0].timestamp).toBeGreaterThanOrEqual(beforeInsert);
      expect(events[0].timestamp).toBeLessThanOrEqual(afterInsert);
    });
  });
});
