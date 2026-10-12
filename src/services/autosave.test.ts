import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { ConceptMap } from '../types/map';
import { createMap } from '../lib/mapFactory';
import { useMapStore } from '../store/mapStore';
import { flushAutosave, recovered, showMap, startAutosave, useSaveStatus } from './autosave';

const db = new Map<string, ConceptMap>();
const broken = { yes: false };
vi.mock('./storage', () => ({
  storage: () => ({
    get: async (id: string) => db.get(id),
    save: async (map: ConceptMap) => {
      if (broken.yes) throw new Error('full');
      db.set(map.id, map);
    },
  }),
}));

startAutosave();

function openNew() {
  const map = createMap('Prima');
  db.set(map.id, map);
  showMap(map);
  return map;
}

beforeEach(() => {
  broken.yes = false;
  showMap(null);
});

describe('autosave', () => {
  it('saves a change on flush', async () => {
    const map = openNew();
    useMapStore.getState().setTitle('Seconda');
    expect(await flushAutosave()).toBe(true);
    expect(db.get(map.id)?.title).toBe('Seconda');
  });

  it('keeps a change the device refused, and saves it on the next try', async () => {
    const map = openNew();
    broken.yes = true;
    useMapStore.getState().setTitle('Seconda');
    expect(await flushAutosave()).toBe(false);
    expect(useSaveStatus.getState().problem).toBe('error');
    broken.yes = false;
    expect(await flushAutosave()).toBe(true);
    expect(db.get(map.id)?.title).toBe('Seconda');
    expect(useSaveStatus.getState().problem).toBe(null);
  });

  it('does not overwrite a newer version saved elsewhere', async () => {
    const map = openNew();
    const other = { ...map, title: 'Altra finestra', updatedAt: map.updatedAt + 1000 };
    db.set(map.id, other);
    useMapStore.getState().setTitle('Seconda');
    expect(await flushAutosave()).toBe(false);
    expect(useSaveStatus.getState().problem).toBe('conflict');
    expect(db.get(map.id)?.title).toBe('Altra finestra');
  });

  it('on start, saves the changes left in the slot when the page closed', async () => {
    const map = createMap('Vecchia');
    db.set(map.id, map);
    localStorage.setItem('mappeora-unsaved', JSON.stringify({ ...map, title: 'Nuova', updatedAt: map.updatedAt + 1 }));
    await recovered();
    expect(db.get(map.id)?.title).toBe('Nuova');
    expect(localStorage.getItem('mappeora-unsaved')).toBe(null);
  });
});
