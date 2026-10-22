import type { ConceptMap, MapSummary } from '../types/map';
import { storage } from './storage';
import { isAppleMobile, isHomeScreenApp, isNative } from './platform';
import { shareFile } from './export';
import { MAP_FILE_EXTENSION, serializeArchive, textToDataUrl } from '../lib/mapFile';

/**
 * The maps live only on this device. «Salva tutte le mappe» makes one file
 * with all of them, to keep on Drive or a computer; «Apri file» brings them
 * back on a new phone, or after the browser has wiped its data.
 */

const KEY = 'mappeora-copia';
const DAY = 24 * 60 * 60 * 1000;

interface BackupState {
  /** Last «Salva tutte le mappe». */
  savedAt?: number;
  /** «Più tardi»: no reminder until then. */
  snoozedUntil?: number;
  /** The iPhone/iPad hint about the Home screen was read. */
  homeHintSeen?: boolean;
}

function readState(): BackupState {
  try {
    const s: unknown = JSON.parse(localStorage.getItem(KEY) ?? '{}');
    return s && typeof s === 'object' ? (s as BackupState) : {};
  } catch {
    return {};
  }
}

function writeState(patch: Partial<BackupState>) {
  try {
    localStorage.setItem(KEY, JSON.stringify({ ...readState(), ...patch }));
  } catch {
    // Storage full or blocked: the reminder simply comes back.
  }
}

/** Every map of the device in one file: downloaded on the web, «Condividi» in the app. */
export async function saveAllMaps(): Promise<{ saved: number; skipped: number }> {
  const list = await storage().list();
  // A damaged map must not stop the copy of the others, but the child is told.
  const maps = (await Promise.all(list.map((m) => storage().get(m.id).catch(() => undefined)))).filter((m): m is ConceptMap => !!m);
  const date = new Date().toISOString().slice(0, 10);
  await shareFile(textToDataUrl(serializeArchive(maps), 'application/json'), `mappami-tutte-le-mappe-${date}${MAP_FILE_EXTENSION}`, 'Le mie mappe');
  writeState({ savedAt: Date.now(), snoozedUntil: undefined });
  return { saved: maps.length, skipped: list.length - maps.length };
}

/** What to add to the note when damaged maps were left out of the copy. */
export function skippedNote(skipped: number): string {
  if (skipped <= 0) return '';
  return skipped === 1
    ? ' 1 mappa non si riesce più a leggere ed è rimasta fuori dalla copia.'
    : ` ${skipped} mappe non si riescono più a leggere e sono rimaste fuori dalla copia.`;
}

/**
 * Puts back the maps of a safety copy. Nothing on the device is ever
 * overwritten: a map already here, and not older, is left as it is; a
 * newer version from the copy comes back next to it.
 */
export async function restoreMaps(maps: ConceptMap[]): Promise<{ added: number; already: number }> {
  let added = 0;
  let already = 0;
  for (const map of maps) {
    const here = await storage().get(map.id);
    if (!here) {
      await storage().save(map);
      added++;
    } else if (here.updatedAt >= map.updatedAt) {
      already++;
    } else {
      // Always the same id for the same version: opening the copy twice
      // does not bring it back twice.
      const id = `${map.id}-copia-${map.updatedAt}`;
      if (await storage().get(id)) {
        already++;
        continue;
      }
      await storage().save({ ...map, id, title: `${map.title} (dalla copia)` });
      added++;
    }
  }
  return { added, already };
}

/**
 * Time to save a copy: never saved, and there are a few maps or one is a
 * week old; or saved more than two weeks ago and something changed since.
 */
export function backupDue(maps: MapSummary[], now = Date.now(), state = readState()): boolean {
  if (maps.length === 0 || (state.snoozedUntil && now < state.snoozedUntil)) return false;
  if (!state.savedAt) return maps.length >= 3 || maps.some((m) => now - m.updatedAt > 7 * DAY);
  return now - state.savedAt > 14 * DAY && maps.some((m) => m.updatedAt > state.savedAt!);
}

/** When «Salva tutte le mappe» last made a file on this device, if ever. */
export function lastBackup(): number | undefined {
  return readState().savedAt;
}

export function snoozeBackup(now = Date.now()) {
  writeState({ snoozedUntil: now + 7 * DAY });
}

/**
 * Safari on iPhone and iPad may wipe what a website keeps after 7 days
 * without a visit; added to the Home screen, MappAmi is an app and keeps
 * its maps. True when that hint is worth showing.
 */
export function homeScreenHintNeeded(): boolean {
  if (isNative() || readState().homeHintSeen) return false;
  return isAppleMobile() && !isHomeScreenApp();
}

export function homeScreenHintSeen() {
  writeState({ homeHintSeen: true });
}
