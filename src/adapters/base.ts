import { PersistenceAdapter } from '../types';

export abstract class BaseAdapter implements PersistenceAdapter {
  abstract save(data: any): Promise<void>;
  abstract load(): Promise<any>;
}
