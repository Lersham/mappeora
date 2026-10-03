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

/**
 * Returns null if the child cancels. On the web this must be called from
 * a click handler, because it opens a file picker.
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
    } catch {
      return null; // the plugin rejects when the picker is dismissed
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
