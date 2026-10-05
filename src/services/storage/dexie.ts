import Dexie, { type Table } from 'dexie';
import type { ConceptMap, MapSummary } from '../../types/map';
import type { StorageService } from './types';

class MappeoraDB extends Dexie {
  maps!: Table<ConceptMap, string>;
  /** Title and date of each map: the list never has to read the photos. */
  summaries!: Table<MapSummary, string>;

  constructor() {
    super('mappeora');
    this.version(1).stores({ maps: 'id, updatedAt' });
    this.version(2)
      .stores({ maps: 'id, updatedAt', summaries: 'id, updatedAt' })
      .upgrade((tx) =>
        tx
          .table<ConceptMap, string>('maps')
          .each(({ id, title, updatedAt }) => void tx.table<MapSummary, string>('summaries').put({ id, title, updatedAt })),
      );
  }
}

/** Web/PWA storage on IndexedDB. */
export class DexieStorage implements StorageService {
  private db = new MappeoraDB();

  constructor() {
    // Ask the browser not to evict our data under storage pressure.
    void navigator.storage?.persist?.();
  }

  list(): Promise<MapSummary[]> {
    return this.db.summaries.orderBy('updatedAt').reverse().toArray();
  }

  get(id: string) {
    return this.db.maps.get(id);
  }

  async save(map: ConceptMap) {
    const { id, title, updatedAt } = map;
    await this.db.transaction('rw', this.db.maps, this.db.summaries, async () => {
      await this.db.maps.put(map);
      await this.db.summaries.put({ id, title, updatedAt });
    });
  }

  async remove(id: string) {
    await this.db.transaction('rw', this.db.maps, this.db.summaries, async () => {
      await this.db.maps.delete(id);
      await this.db.summaries.delete(id);
    });
  }
}
