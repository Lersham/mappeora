import type { ClipboardEvent as ReactClipboardEvent } from 'react';
import { photoToDataUrl } from './photo';
import { toDataUrl } from './embed';

/**
 * Google Images with SafeSearch, already searching the concept. Google's own
 * search API is closed to new projects, so the child picks a picture there
 * and brings it back by copying it (or saving it and using the gallery).
 * On Android/iOS Capacitor opens external links in the system browser.
 */
export function googleImagesUrl(query: string): string {
  const q = encodeURIComponent(query.trim());
  return `https://www.google.com/search?q=${q}&tbm=isch&udm=2&safe=active&hl=it`;
}

export function openGoogleImages(query: string): void {
  window.open(googleImagesUrl(query), '_blank', 'noopener');
}

export class PasteError extends Error {}

const IMAGE_LINK = /^https?:\/\/\S+$/i;

/** A copied picture (or the copied address of a picture) as a small JPEG. */
export async function pastedToDataUrl(pasted: Blob | string): Promise<string> {
  if (typeof pasted === 'string') {
    const link = pasted.trim();
    if (!IMAGE_LINK.test(link)) throw new PasteError('Negli appunti non c’è un’immagine. Su Google tieni premuta l’immagine e scegli «Copia immagine».');
    // Many sites don't let other apps download their pictures.
    const data = await toDataUrl(link);
    if (!data?.startsWith('data:image/')) {
      throw new PasteError('Questo sito non permette di copiare l’immagine. Scaricala e poi scegli «Dalla galleria».');
    }
    return photoToDataUrl(data);
  }
  if (!pasted.type.startsWith('image/')) throw new PasteError('Negli appunti non c’è un’immagine.');
  const url = URL.createObjectURL(pasted);
  try {
    return await photoToDataUrl(url);
  } finally {
    URL.revokeObjectURL(url);
  }
}

/**
 * Reads a picture from the clipboard. Returns null when the browser does
 * not allow it: the child can then paste by hand into the paste box.
 */
export async function readClipboardImage(): Promise<Blob | string | null> {
  try {
    for (const item of await navigator.clipboard.read()) {
      const image = item.types.find((t) => t.startsWith('image/'));
      if (image) return await item.getType(image);
      if (item.types.includes('text/plain')) return await (await item.getType('text/plain')).text();
    }
    return '';
  } catch {
    return null;
  }
}

/** Picture or text from a paste event (Ctrl+V, or "Incolla" from the menu). */
export function fromPasteEvent(e: ClipboardEvent | ReactClipboardEvent): Blob | string | null {
  const data = e.clipboardData;
  if (!data) return null;
  const file = [...data.files].find((f) => f.type.startsWith('image/'));
  if (file) return file;
  const text = data.getData('text/plain');
  return text || null;
}
