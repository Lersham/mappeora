import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { ConceptMap } from '../types/map';
import { createMap } from '../lib/mapFactory';
import { useMapStore } from '../store/mapStore';
import { flushAutosave, recovered, showMap, startAutosave, useSaveStatus } from './autosave';
import { readErrorLog } from './errorLog';

const db = new Map<string, ConceptMap>();
const broken = { yes: false, failNext: 0 };
/** Holds the next save until `release()`: the page can go away meanwhile. */
const gate: { hold: boolean; release?: () => void } = { hold: false };
vi.mock('./storage', () => ({
  storage: () => ({
    get: async () => {
      throw new Error('autosave must not read the whole map');
    },
    updatedAt: async (id: string) => db.get(id)?.updatedAt,
    save: async (map: ConceptMap) => {
      if (gate.hold) {
        gate.hold = false;
        await new Promise<void>((resolve) => (gate.release = resolve));
      }
      if (broken.yes || broken.failNext-- > 0) throw new Error('full');
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
  broken.failNext = 0;
  gate.hold = false;
  localStorage.clear();
  showMap(null);
});

const hidePage = () => window.dispatchEvent(new Event('pagehide'));
const slot = () => JSON.parse(localStorage.getItem('mappeora-unsaved') ?? 'null') as ConceptMap | null;

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

  it('a failed older save does not come back over a newer one that went through', async () => {
    const map = openNew();
    broken.failNext = 1;
    useMapStore.getState().setTitle('A1');
    const first = flushAutosave();
    useMapStore.getState().setTitle('A2');
    const second = flushAutosave();
    await Promise.all([first, second]);
    await flushAutosave();
    expect(db.get(map.id)?.title).toBe('A2');
    expect(useSaveStatus.getState().problem).toBe(null);
  });

  it('writes down why a save failed, for «Copia i dettagli»', async () => {
    openNew();
    broken.yes = true;
    useMapStore.getState().setTitle('Seconda');
    await flushAutosave();
    expect(readErrorLog().at(-1)).toMatchObject({ source: 'autosave', message: 'full' });
  });

  it('keeps in the slot a save still under way when the page goes away', async () => {
    openNew();
    gate.hold = true;
    useMapStore.getState().setTitle('In viaggio');
    const saving = flushAutosave();
    await vi.waitFor(() => expect(gate.release).toBeTypeOf('function'));
    hidePage();
    expect(slot()?.title).toBe('In viaggio');
    gate.release!();
    gate.release = undefined;
    await saving;
    await flushAutosave();
    expect(slot()).toBe(null);
  });

  it('an older save ending does not empty the slot holding a newer change', async () => {
    const map = openNew();
    gate.hold = true;
    useMapStore.getState().setTitle('Prima modifica');
    const saving = flushAutosave();
    await vi.waitFor(() => expect(gate.release).toBeTypeOf('function'));
    useMapStore.getState().setTitle('Seconda modifica');
    hidePage();
    expect(slot()?.title).toBe('Seconda modifica');
    // The older save ends; the newer one is held in turn.
    const first = gate.release!;
    gate.release = undefined;
    gate.hold = true;
    first();
    await saving;
    await vi.waitFor(() => expect(gate.release).toBeTypeOf('function'));
    expect(db.get(map.id)?.title).toBe('Prima modifica');
    expect(slot()?.title).toBe('Seconda modifica');
    gate.release!();
    gate.release = undefined;
    await flushAutosave();
    expect(db.get(map.id)?.title).toBe('Seconda modifica');
    expect(slot()).toBe(null);
  });
});
