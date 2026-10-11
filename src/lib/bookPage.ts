/**
 * «Dal libro» remembers the last page read for each map, so a child can come
 * back to it later and take more concepts without photographing it again.
 * Kept on the device only, like the photo.
 */
export interface BookPage {
  text: string;
  /** Words already added to the map (word positions). */
  used: number[];
}

const key = (mapId: string) => `mappeora-dal-libro:${mapId}`;

export function loadBookPage(mapId: string): BookPage | null {
  try {
    const page = JSON.parse(localStorage.getItem(key(mapId)) ?? 'null') as BookPage | null;
    return page && typeof page.text === 'string' && Array.isArray(page.used) ? page : null;
  } catch {
    return null;
  }
}

export function saveBookPage(mapId: string, page: BookPage): void {
  try {
    localStorage.setItem(key(mapId), JSON.stringify(page));
  } catch {
    // Storage full or blocked: the page is simply not remembered.
  }
}

export function forgetBookPage(mapId: string): void {
  try {
    localStorage.removeItem(key(mapId));
  } catch {
    // Nothing to do.
  }
}
