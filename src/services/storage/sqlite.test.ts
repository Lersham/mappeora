import { describe, expect, it, vi } from 'vitest';
import { CHUNK, readData } from './sqlite';

vi.mock('@capacitor-community/sqlite', () => ({ CapacitorSQLite: {}, SQLiteConnection: class {} }));

/** One row, read the way SQLite does: `substr` counts characters from 1. */
function fakeDb(row: { data: string; updated_at: number } | undefined, onRead?: (calls: number) => void) {
  let calls = 0;
  const query = vi.fn(async (sql: string, values: unknown[]) => {
    onRead?.(++calls);
    if (!row) return { values: [] };
    if (sql.includes('length(data)')) {
      const [len] = values as [number];
      return { values: [{ n: row.data.length, u: row.updated_at, part: row.data.slice(0, len) }] };
    }
    if (sql.includes('substr')) {
      const [at, len] = values as [number, number];
      return { values: [{ part: row.data.slice(at - 1, at - 1 + len) }] };
    }
    return { values: [{ u: row.updated_at }] };
  });
  return { query };
}

describe('readData', () => {
  it('reads a small map in one query', async () => {
    const db = fakeDb({ data: '{"id":"a"}', updated_at: 1 });
    expect(await readData(db as never, 'maps', 'a')).toBe('{"id":"a"}');
    expect(db.query).toHaveBeenCalledTimes(1);
  });

  it('reads a map bigger than Android’s window in slices, and whole', async () => {
    const data = 'x'.repeat(CHUNK * 2 + 123) + 'fine';
    const db = fakeDb({ data, updated_at: 1 });
    expect(await readData(db as never, 'maps', 'a')).toBe(data);
    for (const [sql, values] of db.query.mock.calls) {
      if (sql.includes('substr(data, ?, ?)')) expect(values[1]).toBe(CHUNK);
    }
  });

  it('starts over if the map is saved again while being read', async () => {
    const row = { data: 'a'.repeat(CHUNK + 10), updated_at: 1 };
    const db = fakeDb(row, (call) => {
      // Saved again between the first and the second slice of the first try.
      if (call === 2) Object.assign(row, { data: 'b'.repeat(CHUNK + 10), updated_at: 2 });
    });
    expect(await readData(db as never, 'maps', 'a')).toBe('b'.repeat(CHUNK + 10));
  });

  it('undefined when the map is not there', async () => {
    expect(await readData(fakeDb(undefined) as never, 'maps', 'a')).toBeUndefined();
  });
});
