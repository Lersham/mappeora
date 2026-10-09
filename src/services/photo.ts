import { Camera, MediaTypeSelection } from '@capacitor/camera';
import { isNative } from './platform';

export interface PickedPhoto {
  /** URL usable in <img> and by the web OCR engine. */
  webPath: string;
  /** Native file URI, for the native OCR engines (Android/iOS only). */
  uri?: string;
}

export type PhotoSource = 'camera' | 'gallery';

/** Long side in pixels: enough for book text, small enough to OCR quickly. */
const TARGET_WIDTH = 2000;

/** Codes of @capacitor/camera for a picker the child closed on purpose. */
const CANCELLED = new Set(['OS-PLUG-CAMR-0006', 'OS-PLUG-CAMR-0020']);

/**
 * Returns null if the child cancels, and throws if the camera or gallery
 * fails. On the web this must be called from a click handler, because it
 * opens a file picker.
 */
export async function pickPhoto(source: PhotoSource): Promise<PickedPhoto | null> {
  if (isNative()) {
    try {
      if (source === 'camera') {
        const r = await Camera.takePhoto({ quality: 90, targetWidth: TARGET_WIDTH, correctOrientation: true });
        return r.webPath ? { webPath: r.webPath, uri: r.uri } : null;
      }
      const { results } = await Camera.chooseFromGallery({
        mediaType: MediaTypeSelection.Photo,
        limit: 1,
        quality: 90,
        targetWidth: TARGET_WIDTH,
        correctOrientation: true,
      });
      const r = results[0];
      return r?.webPath ? { webPath: r.webPath, uri: r.uri } : null;
    } catch (e) {
      // The plugin also rejects when the picker is dismissed.
      if (CANCELLED.has((e as { code?: string } | null)?.code ?? '') || /cancel/i.test(String((e as Error)?.message))) return null;
      throw e;
    }
  }
  return pickFileOnWeb(source);
}

function pickFileOnWeb(source: PhotoSource): Promise<PickedPhoto | null> {
  return new Promise((resolve) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    // On phones and tablets this opens the rear camera directly.
    if (source === 'camera') input.setAttribute('capture', 'environment');
    input.addEventListener('change', () => {
      const file = input.files?.[0];
      resolve(file ? { webPath: URL.createObjectURL(file) } : null);
    });
    input.addEventListener('cancel', () => resolve(null));
    input.click();
  });
}

/** Long side of a photo shown inside a concept: sharp even when zoomed in. */
const NODE_PHOTO_SIZE = 480;

/**
 * Shrinks a picked photo to a small JPEG data URL, so it is stored inside
 * the map (and its ".mappami" file) instead of pointing to a device path.
 */
export async function photoToDataUrl(webPath: string, maxSide = NODE_PHOTO_SIZE): Promise<string> {
  const img = await new Promise<HTMLImageElement>((resolve, reject) => {
    const el = new Image();
    el.onload = () => resolve(el);
    el.onerror = () => reject(new Error('photo-load'));
    el.src = webPath;
  });
  const scale = Math.min(1, maxSide / Math.max(img.naturalWidth, img.naturalHeight));
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(img.naturalWidth * scale);
  canvas.height = Math.round(img.naturalHeight * scale);
  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = '#ffffff'; // transparent PNGs would turn black in JPEG
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
  return canvas.toDataURL('image/jpeg', 0.8);
}
