import type { PickedPhoto } from '../photo';

export interface OcrService {
  /**
   * Recognises the printed text in a photo, entirely on the device.
   * `onProgress` receives 0..1 when the engine reports it.
   */
  recognize(photo: PickedPhoto, onProgress?: (progress: number) => void): Promise<string>;
}
