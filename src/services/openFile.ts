import { isNative } from './platform';
import { MAP_FILE_EXTENSION, MapFileError, OLD_MAP_FILE_EXTENSION } from '../lib/mapFile';

/**
 * Far above any real file: a copy of many maps, each with dozens of photos
 * (480 px JPEG, about 60 KB each), is a few tens of MB. The limits in
 * lib/mapFile.ts bound every field, not the whole file (1000 maps of 2000
 * concepts could add up to gigabytes), so the total is capped here: reading
 * and parsing more than this at once would stop the page.
 */
export const MAX_FILE_BYTES = 100 * 1024 * 1024;

/**
 * Lets the child pick a ".mappami" file and returns its text, or null if
 * they cancel. Must be called from a click handler (it opens a picker).
 * Fails if the file cannot be read (e.g. a cloud file not downloaded yet)
 * or is too big to be a map.
 */
export function pickMapFile(): Promise<string | null> {
  return new Promise((resolve, reject) => {
    const input = document.createElement('input');
    input.type = 'file';
    // Android filters the picker by MIME type, and a ".mappami" file sent
    // through a chat app has no registered type: there we show every file.
    if (!isNative()) input.accept = `${MAP_FILE_EXTENSION},${OLD_MAP_FILE_EXTENSION},.json,application/json`;
    input.addEventListener('change', () => {
      const file = input.files?.[0];
      if (!file) return resolve(null);
      if (file.size > MAX_FILE_BYTES) return reject(new MapFileError('Questo file è troppo grande per essere una mappa.'));
      file.text().then(resolve, reject);
    });
    input.addEventListener('cancel', () => resolve(null));
    input.click();
  });
}
