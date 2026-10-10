import type { ConceptMap, MapSummary } from '../types/map';
import { storage } from './storage';
import { isNative } from './platform';
import { shareFile } from './export';
import { MAP_FILE_EXTENSION, serializeArchive, textToDataUrl } from '../lib/mapFile';
import { newId } from '../lib/id';

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
    return JSON.parse(localStorage.getItem(KEY) ?? '{}') as BackupState;
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
export async function saveAllMaps(): Promise<number> {
  const list = await storage().list();
  const maps = (await Promise.all(list.map((m) => storage().get(m.id)))).filter((m): m is ConceptMap => !!m);
  const date = new Date().toISOString().slice(0, 10);
  await shareFile(textToDataUrl(serializeArchive(maps), 'application/json'), `mappami-tutte-le-mappe-${date}${MAP_FILE_EXTENSION}`, 'Le mie mappe');
  writeState({ savedAt: Date.now(), snoozedUntil: undefined });
  return maps.length;
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
      await storage().save({ ...map, id: newId(), title: `${map.title} (dalla copia)` });
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
  const nav = navigator as Navigator & { standalone?: boolean };
  const ios = /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  const installed = nav.standalone === true || window.matchMedia?.('(display-mode: standalone)').matches;
  return ios && !installed;
}

export function homeScreenHintSeen() {
  writeState({ homeHintSeen: true });
}
