import type { Worker } from 'tesseract.js';
import type { PickedPhoto } from '../photo';
import type { OcrService } from './types';

/**
 * Tesseract.js (WebAssembly) runs in the browser: the photo never leaves
 * the device. The first use downloads the engine and the Italian model
 * from jsDelivr (a few MB); afterwards they are cached (see vite.config.ts).
 */
export class WebOcr implements OcrService {
  private worker: Promise<Worker> | undefined;
  private onProgress: ((p: number) => void) | undefined;

  private getWorker(): Promise<Worker> {
    this.worker ??= import('tesseract.js').then(({ createWorker }) =>
      createWorker('ita', undefined, {
        logger: (m) => {
          // Downloading the model counts as the first 30%, reading the rest.
          if (m.status === 'recognizing text') this.onProgress?.(0.3 + m.progress * 0.7);
          else if (m.status.startsWith('loading')) this.onProgress?.(m.progress * 0.3);
        },
      }),
    );
    return this.worker;
  }

  async recognize(photo: PickedPhoto, onProgress?: (p: number) => void): Promise<string> {
    this.onProgress = onProgress;
    try {
      const worker = await this.getWorker();
      const { data } = await worker.recognize(await downscale(photo.webPath));
      return data.text;
    } catch (e) {
      this.worker = undefined; // e.g. offline on first use: retry from scratch next time
      throw e;
    } finally {
      this.onProgress = undefined;
    }
  }
}

const MAX_SIDE = 2000;

/** Huge phone photos make Tesseract slow without improving accuracy. */
async function downscale(src: string): Promise<HTMLCanvasElement | string> {
  const img = new Image();
  img.src = src;
  await img.decode();
  const scale = Math.min(1, MAX_SIDE / Math.max(img.naturalWidth, img.naturalHeight));
  if (scale === 1) return src;
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(img.naturalWidth * scale);
  canvas.height = Math.round(img.naturalHeight * scale);
  canvas.getContext('2d')!.drawImage(img, 0, 0, canvas.width, canvas.height);
  return canvas;
}
