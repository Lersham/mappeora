import { isNative } from './platform';
import { MAP_FILE_EXTENSION } from '../lib/mapFile';

/**
 * Lets the child pick a ".mappeora" file and returns its text, or null if
 * they cancel. Must be called from a click handler (it opens a picker).
 */
export function pickMapFile(): Promise<string | null> {
  return new Promise((resolve) => {
    const input = document.createElement('input');
    input.type = 'file';
    // Android filters the picker by MIME type, and a ".mappeora" file sent
    // through a chat app has no registered type: there we show every file.
    if (!isNative()) input.accept = `${MAP_FILE_EXTENSION},.json,application/json`;
    input.addEventListener('change', () => {
      const file = input.files?.[0];
      if (!file) return resolve(null);
      file.text().then(resolve, () => resolve(null));
    });
    input.addEventListener('cancel', () => resolve(null));
    input.click();
  });
}
