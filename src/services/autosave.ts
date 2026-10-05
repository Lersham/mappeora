import { create } from 'zustand';
import type { ConceptMap } from '../types/map';
import { mapHistory, useMapStore } from '../store/mapStore';
import { newId } from '../lib/id';
import { storage } from './storage';

const DELAY_MS = 600;
/** The last changes, kept here while the page closes (see `recovered`). */
const SLOT = 'mappeora-unsaved';

/**
 * - `error`: the device refused to save (full, broken database…).
 * - `conflict`: the map was changed elsewhere (another tab) after it was
 *   opened here; saving would throw that work away.
 */
export type SaveProblem = 'error' | 'conflict' | null;
export const useSaveStatus = create<{ problem: SaveProblem }>(() => ({ problem: null }));
const setProblem = (problem: SaveProblem) => useSaveStatus.setState({ problem });

let pending: ConceptMap | null = null;
let timer: ReturnType<typeof setTimeout> | undefined;
/** Writes one after the other: an older copy never lands after a newer one. */
let chain: Promise<void> = Promise.resolve();
/** The version of each map this tab last read or wrote. */
const known = new Map<string, number>();
let slotId: string | null = null;

/** Call before showing a map just read or created: later saves start from it. */
export function opened(map: ConceptMap) {
  clearTimeout(timer);
  pending = null;
  known.set(map.id, map.updatedAt);
  setProblem(null);
}

/** Shows `map` in the editor (or none), with a fresh undo history. */
export function showMap(map: ConceptMap | null) {
  if (map) opened(map);
  else discardPending();
  useMapStore.getState().load(map);
  mapHistory().clear();
}

/**
 * The map was changed elsewhere: keeps the work done here as a new map,
 * leaving the other version as it is. False if it could not be saved.
 */
export async function saveAsCopy(): Promise<boolean> {
  const current = pending ?? useMapStore.getState().map;
  if (!current) return false;
  const now = Date.now();
  const copy: ConceptMap = { ...current, id: newId(), title: `${current.title} (copia)`, createdAt: now, updatedAt: now };
  try {
    await storage().save(copy);
  } catch {
    return false;
  }
  showMap(copy);
  return true;
}

/** The map was changed elsewhere: shows that version, dropping the changes made here. */
export async function reopenStored(): Promise<boolean> {
  const id = useMapStore.getState().map?.id;
  if (!id) return false;
  try {
    const stored = await storage().get(id);
    if (!stored) return false;
    showMap(stored);
    return true;
  } catch {
    return false;
  }
}

/** Forgets the changes not saved yet (the child chose to leave them). */
export function discardPending() {
  clearTimeout(timer);
  pending = null;
  setProblem(null);
}

function clearSlot(id: string) {
  if (slotId !== id) return;
  slotId = null;
  try {
    localStorage.removeItem(SLOT);
  } catch {
    // Nothing to clean up.
  }
}

function writeSlot() {
  if (!pending || useSaveStatus.getState().problem === 'conflict') return;
  try {
    localStorage.setItem(SLOT, JSON.stringify(pending));
    slotId = pending.id;
  } catch {
    // Too big (photos) or storage blocked: the normal save still runs.
  }
}

async function write(map: ConceptMap) {
  if (useSaveStatus.getState().problem === 'conflict') {
    pending ??= map;
    return;
  }
  try {
    const stored = await storage().get(map.id);
    const base = known.get(map.id);
    if (stored && base !== undefined && stored.updatedAt > base) {
      pending ??= map;
      setProblem('conflict');
      return;
    }
    await storage().save(map);
    known.set(map.id, map.updatedAt);
    clearSlot(map.id);
    if (useSaveStatus.getState().problem === 'error') setProblem(null);
  } catch {
    // Kept for the next try (the next change, «Riprova», leaving the map).
    pending ??= map;
    setProblem('error');
  }
}

/** Saves the changes now. True when everything is saved. */
export function flushAutosave(): Promise<boolean> {
  clearTimeout(timer);
  const map = pending;
  pending = null;
  if (map) chain = chain.then(() => write(map));
  return chain.then(() => pending === null && useSaveStatus.getState().problem === null);
}

let recovery: Promise<void> | undefined;
/**
 * Changes kept while the page closed (a reload, the app killed in the
 * background) go into the archive before anything reads it.
 */
export function recovered(): Promise<void> {
  recovery ??= (async () => {
    let raw: string | null;
    try {
      raw = localStorage.getItem(SLOT);
    } catch {
      return;
    }
    if (!raw) return;
    let map: ConceptMap | undefined;
    try {
      const parsed = JSON.parse(raw) as ConceptMap;
      if (typeof parsed?.id === 'string' && Array.isArray(parsed.nodes) && Array.isArray(parsed.edges)) map = parsed;
    } catch {
      // Unreadable: dropped below.
    }
    try {
      if (map) {
        const stored = await storage().get(map.id);
        if (!stored || stored.updatedAt < map.updatedAt) await storage().save(map);
      }
      localStorage.removeItem(SLOT);
    } catch {
      // Kept for the next start.
    }
  })();
  return recovery;
}

/** Saves the open map shortly after every change: there is no "Save" button. */
export function startAutosave(): () => void {
  const unsubscribe = useMapStore.subscribe((state, prev) => {
    const map = state.map;
    if (map?.id !== prev.map?.id) {
      // Another map (or none): the previous one's changes go first, and
      // opening a map is not a change.
      if (pending && pending.id !== map?.id) void flushAutosave();
      return;
    }
    if (!map || map === prev.map) return;
    pending = map;
    clearTimeout(timer);
    timer = setTimeout(() => void flushAutosave(), DELAY_MS);
  });
  const onHide = () => {
    writeSlot();
    void flushAutosave();
  };
  const onVisibility = () => document.visibilityState === 'hidden' && onHide();
  document.addEventListener('visibilitychange', onVisibility);
  window.addEventListener('pagehide', onHide);
  return () => {
    unsubscribe();
    document.removeEventListener('visibilitychange', onVisibility);
    window.removeEventListener('pagehide', onHide);
    void flushAutosave();
  };
}
