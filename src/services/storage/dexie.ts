import Dexie, { type Table } from 'dexie';
import type { ConceptMap, MapSummary } from '../../types/map';
import { sanitizeStoredMap } from '../../lib/mapFile';
import { newId } from '../../lib/id';
import { TRASH_MS, type StorageService, type TrashedSummary } from './types';

/**
 * A deleted map. It lives in the `maps` table under its own key, so the bin
 * needs no new database version (see docs/rilascio.md, «Mai cambiare il
 * formato dei dati»): an older app never lists it, since only `summaries`
 * is listed, and simply leaves it there.
 */
interface TrashRecord {
  id: string;
  /** Same as removedAt: the table's index needs it. */
  updatedAt: number;
  removedAt: number;
  title: string;
  /** The record as it was stored, not sanitised: a damaged map comes back as it was. */
  map: unknown;
}

const TRASH = 'trash:';
const trashKey = (id: string) => TRASH + id;

class MappeoraDB extends Dexie {
  maps!: Table<ConceptMap | TrashRecord, string>;
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

  async get(id: string) {
    if (id.startsWith(TRASH)) return undefined;
    const stored = await this.db.maps.get(id);
    return stored && sanitizeStoredMap(stored);
  }

  async updatedAt(id: string) {
    return (await this.db.summaries.get(id))?.updatedAt;
  }

  async save(map: ConceptMap) {
    const { id, title, updatedAt } = map;
    await this.db.transaction('rw', this.db.maps, this.db.summaries, async () => {
      await this.db.maps.put(map);
      await this.db.summaries.put({ id, title, updatedAt });
    });
  }

  async remove(id: string, now = Date.now()) {
    await this.db.transaction('rw', this.db.maps, this.db.summaries, async () => {
      const stored = await this.db.maps.get(id);
      const summary = await this.db.summaries.get(id);
      if (stored) {
        const record: TrashRecord = { id: trashKey(id), updatedAt: now, removedAt: now, title: summary?.title ?? '', map: stored };
        await this.db.maps.put(record);
      }
      await this.db.maps.delete(id);
      await this.db.summaries.delete(id);
    });
  }

  async trash(now = Date.now()): Promise<TrashedSummary[]> {
    const records = (await this.db.maps.where('id').startsWith(TRASH).toArray()) as TrashRecord[];
    const old = records.filter((r) => now - r.removedAt > TRASH_MS).map((r) => r.id);
    if (old.length) await this.db.maps.bulkDelete(old);
    return records
      .filter((r) => now - r.removedAt <= TRASH_MS)
      .sort((a, b) => b.removedAt - a.removedAt)
      .map((r) => ({ id: r.id.slice(TRASH.length), title: r.title, removedAt: r.removedAt }));
  }

  async restore(id: string) {
    return this.db.transaction('rw', this.db.maps, this.db.summaries, async () => {
      const record = (await this.db.maps.get(trashKey(id))) as TrashRecord | undefined;
      if (!record) return undefined;
      let map = record.map as ConceptMap;
      if (await this.db.maps.get(id)) map = { ...map, id: newId(), title: `${record.title} (dal cestino)` };
      await this.db.maps.put(map);
      // A damaged map may lack them: without a date it would be missing from the list.
      const title = typeof map.title === 'string' ? map.title : record.title;
      const updatedAt = typeof map.updatedAt === 'number' ? map.updatedAt : record.removedAt;
      await this.db.summaries.put({ id: map.id, title, updatedAt });
      await this.db.maps.delete(trashKey(id));
      return map.id;
    });
  }
}
