import Dexie, { type Table } from 'dexie';
import type { ConceptMap, MapSummary } from '../../types/map';
import type { StorageService } from './types';

class MappeoraDB extends Dexie {
  maps!: Table<ConceptMap, string>;

  constructor() {
    super('mappeora');
    this.version(1).stores({ maps: 'id, updatedAt' });
  }
}

/** Web/PWA storage on IndexedDB. */
export class DexieStorage implements StorageService {
  private db = new MappeoraDB();

  constructor() {
    // Ask the browser not to evict our data under storage pressure.
    void navigator.storage?.persist?.();
  }

  async list(): Promise<MapSummary[]> {
    // One map at a time: photos make the whole archive too big to hold at once.
    const list: MapSummary[] = [];
    await this.db.maps
      .orderBy('updatedAt')
      .reverse()
      .each(({ id, title, updatedAt }) => void list.push({ id, title, updatedAt }));
    return list;
  }

  get(id: string) {
    return this.db.maps.get(id);
  }

  async save(map: ConceptMap) {
    await this.db.maps.put(map);
  }

  async remove(id: string) {
    await this.db.maps.delete(id);
  }
}
