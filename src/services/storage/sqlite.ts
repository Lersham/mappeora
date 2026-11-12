import { CapacitorSQLite, SQLiteConnection, type SQLiteDBConnection } from '@capacitor-community/sqlite';
import type { ConceptMap, MapSummary } from '../../types/map';
import { MapFileError, parseStoredMap } from '../../lib/mapFile';
import { newId } from '../../lib/id';
import { TRASH_MS, type StorageService, type TrashedSummary } from './types';

const DB_NAME = 'mappeora';

const SCHEMA = `
CREATE TABLE IF NOT EXISTS maps (
  id TEXT PRIMARY KEY NOT NULL,
  title TEXT NOT NULL,
  updated_at INTEGER NOT NULL,
  data TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS maps_updated_at ON maps (updated_at);
CREATE TABLE IF NOT EXISTS trash (
  id TEXT PRIMARY KEY NOT NULL,
  title TEXT NOT NULL,
  updated_at INTEGER NOT NULL,
  removed_at INTEGER NOT NULL,
  data TEXT NOT NULL
);
`;

/**
 * Android reads a row through a window of about 2 MB: a map with many
 * photos is bigger, and reading its text in one go fails («Row too big to
 * fit into CursorWindow»). It is read in slices well below that, even if
 * every character took 4 bytes.
 */
export const CHUNK = 256 * 1024;

type Table = 'maps' | 'trash';

/**
 * The whole text of a row, slice by slice. If it is saved again while being
 * read, the slices would mix two versions: then it starts over.
 */
export async function readData(db: Pick<SQLiteDBConnection, 'query'>, table: Table, id: string): Promise<string | undefined> {
  for (let attempt = 0; attempt < 3; attempt++) {
    const first = (await db.query(`SELECT length(data) AS n, updated_at AS u, substr(data, 1, ?) AS part FROM ${table} WHERE id = ?`, [CHUNK, id]))
      .values?.[0];
    if (!first) return undefined;
    let text: string = first.part ?? '';
    for (let at = CHUNK + 1; at <= first.n; at += CHUNK) {
      const row = (await db.query(`SELECT substr(data, ?, ?) AS part FROM ${table} WHERE id = ?`, [at, CHUNK, id])).values?.[0];
      text += row?.part ?? '';
    }
    if (first.n <= CHUNK) return text;
    const after = (await db.query(`SELECT updated_at AS u FROM ${table} WHERE id = ?`, [id])).values?.[0];
    if (after?.u === first.u && text.length === first.n) return text;
  }
  throw new MapFileError('La mappa salvata sul dispositivo cambia mentre la leggo.');
}

/**
 * Android/iOS storage. iOS may evict a WebView's IndexedDB when the device
 * is low on space, so on native we keep maps in a real SQLite file.
 */
export class SqliteStorage implements StorageService {
  private sqlite = new SQLiteConnection(CapacitorSQLite);
  private db: Promise<SQLiteDBConnection> | undefined;

  private connection(): Promise<SQLiteDBConnection> {
    if (this.db) return this.db;
    const db = (async () => {
      // After a WebView reload (e.g. back from the privacy page) the native
      // side still holds the old connection: realign before reusing it.
      await this.sqlite.checkConnectionsConsistency().catch(() => undefined);
      const exists = (await this.sqlite.isConnection(DB_NAME, false)).result;
      const conn = exists
        ? await this.sqlite.retrieveConnection(DB_NAME, false)
        : await this.sqlite.createConnection(DB_NAME, false, 'no-encryption', 1, false);
      if (!(await conn.isDBOpen()).result) await conn.open();
      await conn.execute(SCHEMA);
      return conn;
    })();
    this.db = db;
    // A failed attempt is not kept: the next call tries again.
    db.catch(() => {
      if (this.db === db) this.db = undefined;
    });
    return db;
  }

  async list(): Promise<MapSummary[]> {
    const db = await this.connection();
    const res = await db.query('SELECT id, title, updated_at FROM maps ORDER BY updated_at DESC');
    return (res.values ?? []).map((r) => ({ id: r.id, title: r.title, updatedAt: r.updated_at }));
  }

  async get(id: string): Promise<ConceptMap | undefined> {
    const text = await readData(await this.connection(), 'maps', id);
    return text === undefined ? undefined : parseStoredMap(text);
  }

  async updatedAt(id: string): Promise<number | undefined> {
    const db = await this.connection();
    return (await db.query('SELECT updated_at FROM maps WHERE id = ?', [id])).values?.[0]?.updated_at;
  }

  async save(map: ConceptMap): Promise<void> {
    const db = await this.connection();
    await db.run('INSERT OR REPLACE INTO maps (id, title, updated_at, data) VALUES (?, ?, ?, ?)', [
      map.id,
      map.title,
      map.updatedAt,
      JSON.stringify(map),
    ]);
  }

  async remove(id: string, now = Date.now()): Promise<void> {
    const db = await this.connection();
    // Copied as stored, without reading it here: a map too damaged to open still goes to the bin.
    await db.executeSet([
      {
        statement: 'INSERT OR REPLACE INTO trash (id, title, updated_at, removed_at, data) SELECT id, title, updated_at, ?, data FROM maps WHERE id = ?',
        values: [now, id],
      },
      { statement: 'DELETE FROM maps WHERE id = ?', values: [id] },
    ]);
  }

  async trash(now = Date.now()): Promise<TrashedSummary[]> {
    const db = await this.connection();
    await db.run('DELETE FROM trash WHERE removed_at < ?', [now - TRASH_MS]);
    const res = await db.query('SELECT id, title, removed_at FROM trash ORDER BY removed_at DESC');
    return (res.values ?? []).map((r) => ({ id: r.id, title: r.title, removedAt: r.removed_at }));
  }

  async restore(id: string): Promise<string | undefined> {
    const db = await this.connection();
    const back = (await db.query('SELECT title FROM trash WHERE id = ?', [id])).values?.[0];
    if (!back) return undefined;
    if ((await this.updatedAt(id)) === undefined) {
      await db.executeSet([
        { statement: 'INSERT INTO maps (id, title, updated_at, data) SELECT id, title, updated_at, data FROM trash WHERE id = ?', values: [id] },
        { statement: 'DELETE FROM trash WHERE id = ?', values: [id] },
      ]);
      return id;
    }
    // A map with this id exists again: this one comes back next to it.
    const map = parseStoredMap((await readData(db, 'trash', id)) ?? '');
    const copy = { ...map, id: newId(), title: `${back.title} (dal cestino)` };
    await this.save(copy);
    await db.run('DELETE FROM trash WHERE id = ?', [id]);
    return copy.id;
  }
}
