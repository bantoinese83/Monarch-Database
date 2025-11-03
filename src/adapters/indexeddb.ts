import { BaseAdapter } from './base';

export class IndexedDBAdapter extends BaseAdapter {
  private db: IDBDatabase | null = null;
  private dbName: string;
  private storeName: string;

  constructor(dbName: string = 'monarch-db', storeName: string = 'data') {
    super();
    this.dbName = dbName;
    this.storeName = storeName;
  }

  private async openDB(): Promise<IDBDatabase> {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(this.dbName, 1);

      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve(request.result);

      request.onupgradeneeded = event => {
        const db = (event.target as IDBOpenDBRequest).result;
        if (!db.objectStoreNames.contains(this.storeName)) {
          db.createObjectStore(this.storeName);
        }
      };
    });
  }

  private async getDB(): Promise<IDBDatabase> {
    if (!this.db) {
      this.db = await this.openDB();
    }
    return this.db;
  }

  async save(data: any): Promise<void> {
    const db = await this.getDB();
    const transaction = db.transaction([this.storeName], 'readwrite');
    const store = transaction.objectStore(this.storeName);

    return new Promise((resolve, reject) => {
      const request = store.put(data, 'database');

      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve();
    });
  }

  async load(): Promise<any> {
    const db = await this.getDB();
    const transaction = db.transaction([this.storeName], 'readonly');
    const store = transaction.objectStore(this.storeName);

    return new Promise((resolve, reject) => {
      const request = store.get('database');

      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        resolve(request.result || {});
      };
    });
  }
}
