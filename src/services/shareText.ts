import { Share } from '@capacitor/share';
import { isNative } from './platform';
import { shareFile, slug } from './export';
import { textToDataUrl } from '../lib/mapFile';
import type { TextStyle } from '../lib/mapText';

/**
 * Puts the text on the clipboard. False when the browser does not let it
 * (no permission, an old WebView): the dialog then selects the text for the
 * child to copy by hand.
 */
export async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return legacyCopy(text);
  }
}

/** The old way, which still works where `navigator.clipboard` does not (a page that is not secure, some WebViews). */
function legacyCopy(text: string): boolean {
  const field = document.createElement('textarea');
  field.value = text;
  field.readOnly = true; // no keyboard coming up on a phone
  field.setAttribute('aria-hidden', 'true');
  field.style.cssText = 'position:fixed;top:0;left:0;opacity:0;pointer-events:none';
  const before = document.activeElement instanceof HTMLElement ? document.activeElement : null;
  document.body.appendChild(field);
  try {
    field.select();
    field.setSelectionRange(0, text.length);
    return document.execCommand('copy');
  } catch {
    return false;
  } finally {
    field.remove();
    before?.focus({ preventScroll: true });
  }
}

/**
 * Web: downloads a ".txt" named after the map, like the other exports.
 * Android/iOS: opens the share sheet with the text itself, so it goes into a
 * chat, an email or a note as it is; nothing is left on the phone.
 */
export async function saveText(text: string, title: string, style: TextStyle): Promise<void> {
  if (isNative()) {
    await Share.share({ title, text, dialogTitle: 'Condividi il testo' });
    return;
  }
  await shareFile(textToDataUrl(text, 'text/plain;charset=utf-8'), `${slug(title) || 'mappa'}-${style}.txt`, title);
}
