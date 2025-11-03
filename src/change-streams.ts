import {
  ChangeEvent,
  ChangeStreamOptions,
  ChangeStreamListener
} from './types';
import { generateId } from './utils';
import { logger } from './logger';

export class ChangeStreamsManager {
  private listeners = new Map<string, ChangeStreamListener>();
  private maxListeners = 100;

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
    const listener: ChangeStreamListener = {
      id: listenerId,
      options,
      callback
    };

    this.listeners.set(listenerId, listener);
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
    for (const listener of this.listeners.values()) {
      if (this.matchesListener(listener, event)) {
        try {
          listener.callback(event);
        } catch (error) {
          logger.warn('Change stream listener threw an error', {}, error as Error);
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

    // Check custom filter
    if (options.filter && !options.filter(event)) {
      return false;
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
  } {
    const listenersByCollection: Record<string, number> = {};

    for (const listener of this.listeners.values()) {
      const collection = listener.options.collection || '*';
      listenersByCollection[collection] = (listenersByCollection[collection] || 0) + 1;
    }

    return {
      totalListeners: this.listeners.size,
      listenersByCollection
    };
  }
}
