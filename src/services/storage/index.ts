import { isNative } from '../platform';
import { DexieStorage } from './dexie';
import { SqliteStorage } from './sqlite';
import type { StorageService } from './types';

export type { StorageService } from './types';

let instance: StorageService | undefined;

export function storage(): StorageService {
  instance ??= isNative() ? new SqliteStorage() : new DexieStorage();
  return instance;
}
