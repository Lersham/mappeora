import 'fake-indexeddb/auto';
import Dexie from 'dexie';
import { beforeEach, describe, expect, it } from 'vitest';
import { createMap } from '../../lib/mapFactory';
import { DexieStorage } from './dexie';
import { TRASH_MS } from './types';

beforeEach(async () => {
  await Dexie.delete('mappeora');
});

describe('DexieStorage', () => {
  it('reads the date of a map without the map', async () => {
    const db = new DexieStorage();
    const map = createMap('Il Sole');
    await db.save(map);
    expect(await db.updatedAt(map.id)).toBe(map.updatedAt);
    expect(await db.updatedAt('nessuna')).toBeUndefined();
  });

  it('a deleted map goes to the bin and comes back whole', async () => {
    const db = new DexieStorage();
    const map = createMap('La Luna');
    await db.save(map);
    await db.remove(map.id);
    expect(await db.list()).toEqual([]);
    expect(await db.get(map.id)).toBeUndefined();
    expect(await db.trash()).toEqual([{ id: map.id, title: 'La Luna', removedAt: expect.any(Number) }]);
    expect(await db.restore(map.id)).toBe(map.id);
    expect(await db.get(map.id)).toEqual(map);
    expect(await db.list()).toEqual([{ id: map.id, title: 'La Luna', updatedAt: map.updatedAt }]);
    expect(await db.trash()).toEqual([]);
  });

  it('a map too damaged to open still goes to the bin, and comes back as it was', async () => {
    const db = new DexieStorage();
    const raw = new Dexie('mappeora');
    raw.version(2).stores({ maps: 'id, updatedAt', summaries: 'id, updatedAt' });
    await raw.table('maps').put({ id: 'rotta', title: 'Rotta', nodes: 'non una lista' });
    await raw.table('summaries').put({ id: 'rotta', title: 'Rotta', updatedAt: 5 });
    raw.close();
    await expect(db.get('rotta')).rejects.toThrow();
    await db.remove('rotta');
    expect((await db.trash()).map((t) => t.title)).toEqual(['Rotta']);
    expect(await db.restore('rotta')).toBe('rotta');
    expect(await db.list()).toEqual([{ id: 'rotta', title: 'Rotta', updatedAt: expect.any(Number) }]);
  });

  it('forgets maps deleted more than 30 days ago', async () => {
    const db = new DexieStorage();
    const old = createMap('Vecchia');
    const recent = createMap('Recente');
    await db.save(old);
    await db.save(recent);
    const now = Date.now();
    await db.remove(old.id, now - TRASH_MS - 1);
    await db.remove(recent.id, now);
    expect((await db.trash(now)).map((t) => t.title)).toEqual(['Recente']);
    expect(await db.restore(old.id)).toBeUndefined();
  });

  it('puts a map back next to one that has its id again', async () => {
    const db = new DexieStorage();
    const map = createMap('Gemella');
    await db.save(map);
    await db.remove(map.id);
    await db.save({ ...map, title: 'Dalla copia' });
    const id = await db.restore(map.id);
    expect(id).not.toBe(map.id);
    expect((await db.list()).map((m) => m.title).sort()).toEqual(['Dalla copia', 'Gemella (dal cestino)']);
  });

  it('opens a database of the first version, before the list had its own table', async () => {
    const map = createMap('Dalla versione 1');
    const v1 = new Dexie('mappeora');
    v1.version(1).stores({ maps: 'id, updatedAt' });
    await v1.table('maps').put(map);
    v1.close();
    const db = new DexieStorage();
    expect(await db.list()).toEqual([{ id: map.id, title: map.title, updatedAt: map.updatedAt }]);
    expect(await db.get(map.id)).toEqual(map);
  });
});
