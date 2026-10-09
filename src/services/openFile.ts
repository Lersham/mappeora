import { isNative } from './platform';
import { MAP_FILE_EXTENSION, OLD_MAP_FILE_EXTENSION } from '../lib/mapFile';

/**
 * Lets the child pick a ".mappami" file and returns its text, or null if
 * they cancel. Must be called from a click handler (it opens a picker).
 * Fails if the file cannot be read (e.g. a cloud file not downloaded yet).
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
      file.text().then(resolve, reject);
    });
    input.addEventListener('cancel', () => resolve(null));
    input.click();
  });
}
