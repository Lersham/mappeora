import type { PickedPhoto } from '../photo';

export interface OcrService {
  /**
   * Recognises the printed text in a photo, entirely on the device.
   * `onProgress` receives 0..1 when the engine reports it; aborting `signal`
   * rejects with its reason and stops the work where the engine allows it.
   */
  recognize(photo: PickedPhoto, onProgress?: (progress: number) => void, signal?: AbortSignal): Promise<string>;
}

/** The engine or its Italian model could not be downloaded (first use). */
export class OcrDownloadError extends Error {
  name = 'OcrDownloadError';
}

/** The photo itself could not be opened (e.g. HEIC on a browser without it). */
export class PhotoDecodeError extends Error {
  name = 'PhotoDecodeError';
}
