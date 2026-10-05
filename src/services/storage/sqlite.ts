import { CapacitorSQLite, SQLiteConnection, type SQLiteDBConnection } from '@capacitor-community/sqlite';
import type { ConceptMap, MapSummary } from '../../types/map';
import type { StorageService } from './types';

const DB_NAME = 'mappeora';

const SCHEMA = `
CREATE TABLE IF NOT EXISTS maps (
  id TEXT PRIMARY KEY NOT NULL,
  title TEXT NOT NULL,
  updated_at INTEGER NOT NULL,
  data TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS maps_updated_at ON maps (updated_at);
`;

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
    const db = await this.connection();
    const res = await db.query('SELECT data FROM maps WHERE id = ?', [id]);
    const row = res.values?.[0];
    return row ? (JSON.parse(row.data) as ConceptMap) : undefined;
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

  async remove(id: string): Promise<void> {
    const db = await this.connection();
    await db.run('DELETE FROM maps WHERE id = ?', [id]);
  }
}
