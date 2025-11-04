import {
  ChangeEvent,
  ChangeStreamOptions,
  ChangeStreamListener,
  EventFilter,
  Document
} from './types';
import { generateId } from './utils';
import { logger } from './logger';

export class ChangeStreamsManager {
  private listeners = new Map<string, ChangeStreamListener>();
  private maxListeners = 100;
  private persistentEvents = new Map<string, ChangeEvent[]>();
  private maxPersistentEvents = 10000;
  private eventFilters = new Map<string, EventFilter[]>();
  private resumeTokens = new Map<string, string>();

  /**
   * Add a change stream listener
   */
  addListener(
    options: ChangeStreamOptions,
    callback: (event: ChangeEvent) => void
  ): string {
    if (this.listeners.size >= this.maxListeners) {
      throw new Error('Maximum number of change stream listeners exceeded');
    }

    const listenerId = generateId();
    const resumeToken = generateId();

    const listener: ChangeStreamListener = {
      id: listenerId,
      options,
      callback,
      resumeToken,
      lastEventTime: options.startAtOperationTime
    };

    this.listeners.set(listenerId, listener);
    this.resumeTokens.set(resumeToken, listenerId);

    // Send historical events if resumeAfter is specified
    if (options.resumeAfter) {
      this.sendHistoricalEvents(listener);
    }

    logger.info('Change stream listener added', {
      listenerId,
      collection: options.collection,
      operation: options.operation,
      persistent: options.persistent
    });

    return listenerId;
  }

  /**
   * Remove a change stream listener
   */
  removeListener(listenerId: string): boolean {
    return this.listeners.delete(listenerId);
  }

  /**
   * Emit a change event to all matching listeners
   */
  emit(event: ChangeEvent): void {
    // Store event if persistence is enabled for any listener
    const needsPersistence = Array.from(this.listeners.values()).some(
      listener => listener.options.persistent
    );

    if (needsPersistence) {
      this.storePersistentEvent(event);
    }

    // Filter event based on global filters
    if (!this.passesGlobalFilters(event)) {
      return;
    }

    for (const listener of this.listeners.values()) {
      if (this.matchesListener(listener, event)) {
        try {
          // Filter fields if specified
          const filteredEvent = this.filterEventFields(event, listener.options.fieldFilter);
          listener.callback(filteredEvent);
          listener.lastEventTime = event.timestamp;
        } catch (error) {
          logger.warn('Change stream listener threw an error', { listenerId: listener.id }, error as Error);
          // Continue with other listeners even if one fails
        }
      }
    }
  }

  /**
   * Check if an event matches a listener's criteria
   */
  private matchesListener(listener: ChangeStreamListener, event: ChangeEvent): boolean {
    const { options } = listener;

    // Check collection filter
    if (options.collection && options.collection !== event.collection) {
      return false;
    }

    // Check operation filter
    if (options.operation && options.operation !== event.type) {
      return false;
    }

    // Check timestamp filter
    if (options.startAtOperationTime && event.timestamp < options.startAtOperationTime) {
      return false;
    }

    // Check document filter (field-based filtering)
    if (options.documentFilter && !this.matchesDocumentFilter(event.document, options.documentFilter)) {
      return false;
    }

    // Check custom filter
    if (options.filter && !options.filter(event)) {
      return false;
    }

    // Check resume token (skip events before resume point)
    if (options.resumeAfter && listener.resumeToken) {
      const resumeEventIndex = this.findResumeEventIndex(options.resumeAfter);
      if (resumeEventIndex !== -1) {
        const resumeEvent = this.getEventByIndex(resumeEventIndex);
        if (resumeEvent && event.timestamp <= resumeEvent.timestamp) {
          return false;
        }
      }
    }

    return true;
  }

  /**
   * Get all active listeners
   */
  getListeners(): ChangeStreamListener[] {
    return Array.from(this.listeners.values());
  }

  /**
   * Get listeners for a specific collection
   */
  getListenersForCollection(collection: string): ChangeStreamListener[] {
    return Array.from(this.listeners.values()).filter(
      listener => !listener.options.collection || listener.options.collection === collection
    );
  }

  /**
   * Remove all listeners
   */
  removeAllListeners(): void {
    this.listeners.clear();
  }

  /**
   * Get statistics about change streams
   */
  getStats(): {
    totalListeners: number;
    listenersByCollection: Record<string, number>;
    persistentEventsCount: number;
    activeFilters: number;
  } {
    const listenersByCollection: Record<string, number> = {};
    let persistentEventsCount = 0;

    for (const listener of this.listeners.values()) {
      const collection = listener.options.collection || '*';
      listenersByCollection[collection] = (listenersByCollection[collection] || 0) + 1;
    }

    for (const events of this.persistentEvents.values()) {
      persistentEventsCount += events.length;
    }

    return {
      totalListeners: this.listeners.size,
      listenersByCollection,
      persistentEventsCount,
      activeFilters: Array.from(this.eventFilters.values()).flat().length
    };
  }

  /**
   * Add a global event filter
   */
  addEventFilter(filter: EventFilter): string {
    const filterId = generateId();
    filter.id = filterId;

    const collection = filter.collection || '*';
    if (!this.eventFilters.has(collection)) {
      this.eventFilters.set(collection, []);
    }

    this.eventFilters.get(collection)!.push(filter);
    logger.info('Event filter added', { filterId, collection, field: filter.field });
    return filterId;
  }

  /**
   * Remove a global event filter
   */
  removeEventFilter(filterId: string): boolean {
    for (const filters of this.eventFilters.values()) {
      const index = filters.findIndex(f => f.id === filterId);
      if (index !== -1) {
        filters.splice(index, 1);
        logger.info('Event filter removed', { filterId });
        return true;
      }
    }
    return false;
  }

  /**
   * Get persistent events for a collection
   */
  getPersistentEvents(collection: string, limit: number = 100): ChangeEvent[] {
    const events = this.persistentEvents.get(collection) || [];
    return events.slice(-limit);
  }

  /**
   * Get resume token for a listener
   */
  getResumeToken(listenerId: string): string | null {
    const listener = this.listeners.get(listenerId);
    return listener?.resumeToken || null;
  }

  /**
   * Clear persistent events for a collection
   */
  clearPersistentEvents(collection?: string): void {
    if (collection) {
      this.persistentEvents.delete(collection);
    } else {
      this.persistentEvents.clear();
    }
    logger.info('Persistent events cleared', { collection: collection || 'all' });
  }

  /**
   * Get events since a specific timestamp
   */
  getEventsSince(collection: string, timestamp: number): ChangeEvent[] {
    const events = this.persistentEvents.get(collection) || [];
    return events.filter(event => event.timestamp >= timestamp);
  }

  // Private helper methods
  private storePersistentEvent(event: ChangeEvent): void {
    const collection = event.collection;
    if (!this.persistentEvents.has(collection)) {
      this.persistentEvents.set(collection, []);
    }

    const events = this.persistentEvents.get(collection)!;
    events.push(event);

    // Maintain max size
    if (events.length > this.maxPersistentEvents) {
      events.shift(); // Remove oldest events
    }
  }

  private passesGlobalFilters(event: ChangeEvent): boolean {
    const filters = this.eventFilters.get(event.collection) || [];
    const globalFilters = this.eventFilters.get('*') || [];

    const allFilters = [...filters, ...globalFilters];

    for (const filter of allFilters) {
      if (!filter.enabled) continue;

      const fieldValue = this.getNestedValue(event.document, filter.field || '');
      if (!this.matchesFilterCondition(fieldValue, filter)) {
        return false;
      }
    }

    return true;
  }

  private matchesFilterCondition(value: any, filter: EventFilter): boolean {
    switch (filter.operator) {
      case 'eq': return value === filter.value;
      case 'ne': return value !== filter.value;
      case 'gt': return value > filter.value;
      case 'gte': return value >= filter.value;
      case 'lt': return value < filter.value;
      case 'lte': return value <= filter.value;
      case 'in': return Array.isArray(filter.value) && filter.value.includes(value);
      case 'nin': return Array.isArray(filter.value) && !filter.value.includes(value);
      case 'regex': return filter.value instanceof RegExp && filter.value.test(String(value));
      case 'exists': return (value !== undefined && value !== null) === filter.value;
      default: return true;
    }
  }

  private matchesDocumentFilter(document: Document, filter: Document): boolean {
    for (const [field, condition] of Object.entries(filter)) {
      const value = this.getNestedValue(document, field);
      if (typeof condition === 'object' && condition !== null) {
        // Handle MongoDB-style query operators
        if (!this.evaluateQueryCondition(value, condition)) {
          return false;
        }
      } else {
        // Direct equality
        if (value !== condition) {
          return false;
        }
      }
    }
    return true;
  }

  private evaluateQueryCondition(value: any, condition: any): boolean {
    for (const [operator, operand] of Object.entries(condition)) {
      switch (operator) {
        case '$eq': if (value !== operand) return false; break;
        case '$ne': if (value === operand) return false; break;
        case '$gt': if (!(value > operand)) return false; break;
        case '$gte': if (!(value >= operand)) return false; break;
        case '$lt': if (!(value < operand)) return false; break;
        case '$lte': if (!(value <= operand)) return false; break;
        case '$in': if (!Array.isArray(operand) || !operand.includes(value)) return false; break;
        case '$nin': if (!Array.isArray(operand) || operand.includes(value)) return false; break;
        case '$regex': if (!(operand instanceof RegExp) || !operand.test(String(value))) return false; break;
        case '$exists': if ((value !== undefined && value !== null) !== operand) return false; break;
      }
    }
    return true;
  }

  private filterEventFields(event: ChangeEvent, fieldFilter?: string[]): ChangeEvent {
    if (!fieldFilter || fieldFilter.length === 0) {
      return event;
    }

    const filteredDocument: Document = {};
    for (const field of fieldFilter) {
      const value = this.getNestedValue(event.document, field);
      if (value !== undefined) {
        this.setNestedValue(filteredDocument, field, value);
      }
    }

    return {
      ...event,
      document: filteredDocument
    };
  }

  private sendHistoricalEvents(listener: ChangeStreamListener): void {
    if (!listener.options.resumeAfter) return;

    const resumeEventIndex = this.findResumeEventIndex(listener.options.resumeAfter);
    if (resumeEventIndex === -1) return;

    const collection = listener.options.collection;
    if (!collection) return;

    const events = this.persistentEvents.get(collection) || [];
    const historicalEvents = events.slice(resumeEventIndex + 1);

    // Send historical events in batches
    const batchSize = listener.options.batchSize || 100;
    for (let i = 0; i < historicalEvents.length; i += batchSize) {
      const batch = historicalEvents.slice(i, i + batchSize);
      setTimeout(() => {
        for (const event of batch) {
          if (this.matchesListener(listener, event)) {
            try {
              const filteredEvent = this.filterEventFields(event, listener.options.fieldFilter);
              listener.callback(filteredEvent);
            } catch (error) {
              logger.warn('Historical event callback failed', { listenerId: listener.id }, error as Error);
            }
          }
        }
      }, 0); // Send asynchronously
    }
  }

  private findResumeEventIndex(resumeToken: string): number {
    for (const events of this.persistentEvents.values()) {
      for (let i = 0; i < events.length; i++) {
        if (events[i]._resumeToken === resumeToken) {
          return i;
        }
      }
    }
    return -1;
  }

  private getEventByIndex(index: number): ChangeEvent | null {
    for (const events of this.persistentEvents.values()) {
      if (index < events.length) {
        return events[index];
      }
      index -= events.length;
    }
    return null;
  }

  private getNestedValue(obj: any, path: string): any {
    if (!path) return obj;
    return path.split('.').reduce((current, key) => current?.[key], obj);
  }

  private setNestedValue(obj: any, path: string, value: any): void {
    const keys = path.split('.');
    const lastKey = keys.pop()!;
    const target = keys.reduce((current, key) => {
      if (!(key in current) || typeof current[key] !== 'object' || current[key] === null) {
        current[key] = {};
      }
      return current[key];
    }, obj);
    target[lastKey] = value;
  }
}
