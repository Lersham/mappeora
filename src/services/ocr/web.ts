import type { Worker } from 'tesseract.js';
import { flattenPage } from '../../lib/ocrImage';
import { confidentText, type OcrPage } from '../../lib/ocrText';
import type { PickedPhoto } from '../photo';
import { OcrDownloadError, PhotoDecodeError, type OcrService } from './types';

/**
 * Silence that means the download is stuck: the engine reports progress only
 * between its steps (engine, then the Italian model), so this is generous.
 */
const STALL_MS = 120_000;

/**
 * Page confidence (0–100) below which the photo is read a second time,
 * evened out (see ocrImage.ts). Clean photos score above it and take one
 * pass; shadows, a hand or the table around the page score below.
 */
const SURE = 90;

/**
 * Tesseract.js (WebAssembly) runs in the browser: the photo never leaves
 * the device. The first use downloads the engine and the Italian model
 * from jsDelivr (a few MB); afterwards they are cached (see vite.config.ts).
 */
export class WebOcr implements OcrService {
  private worker: Promise<Worker> | undefined;
  /** The progress callback of the latest recognize() call. */
  private progress: ((p: number) => void) | undefined;
  /** The part of the progress bar the current reading fills. */
  private reading: [number, number] = [0.3, 1];

  private getWorker(): Promise<Worker> {
    if (this.worker) return this.worker;
    const attempt = new Promise<Worker>((resolve, reject) => {
      let ready = false;
      let failed = false;
      let timer: ReturnType<typeof setTimeout> | undefined;
      const fail = (e: unknown) => {
        if (ready || failed) return;
        failed = true;
        clearTimeout(timer);
        reject(new OcrDownloadError(describe(e)));
      };
      const alive = () => {
        clearTimeout(timer);
        timer = setTimeout(() => fail('nessuna risposta durante il download'), STALL_MS);
      };
      alive();
      import('tesseract.js')
        .then(({ createWorker }) =>
          createWorker('ita', undefined, {
            logger: (m) => {
              if (!ready) alive();
              // Downloading the model counts as the first 30%, reading the rest.
              const [from, to] = this.reading;
              if (m.status === 'recognizing text') this.progress?.(from + m.progress * (to - from));
              else if (m.status.startsWith('loading')) this.progress?.(m.progress * 0.3);
            },
            // Without it a failed model download is thrown as an uncaught error
            // and createWorker() never settles. Later job errors reject their job.
            errorHandler: fail,
          }),
        )
        .then((worker) => {
          if (failed) return void worker.terminate(); // finished after we gave up
          ready = true;
          clearTimeout(timer);
          resolve(worker);
        }, fail);
    });
    // Offline on first use, a blocked CDN…: start from scratch next time.
    attempt.catch(() => {
      if (this.worker === attempt) this.worker = undefined;
    });
    this.worker = attempt;
    return attempt;
  }

  /** Throws away a worker that failed or was cancelled in the middle of a job. */
  private discard(worker: Promise<Worker>) {
    if (this.worker === worker) this.worker = undefined;
    worker.then((w) => w.terminate()).catch(() => {});
  }

  async recognize(photo: PickedPhoto, onProgress?: (p: number) => void, signal?: AbortSignal): Promise<string> {
    const report = (p: number) => onProgress?.(p);
    this.progress = report;
    try {
      // A photo that does not open must not cost a (re)download of the engine.
      const image = await downscale(photo.webPath);
      const pending = this.getWorker();
      // Cancelled while downloading: the download goes on, ready for next time.
      const worker = await untilAborted(pending, signal);
      const stop = () => this.discard(pending);
      signal?.addEventListener('abort', stop, { once: true });
      try {
        const read = async (canvas: HTMLCanvasElement, part: [number, number]): Promise<OcrPage & { confidence?: number }> => {
          this.reading = part;
          return (await untilAborted(worker.recognize(canvas, {}, { text: true, blocks: true }), signal)).data;
        };
        let page = await read(image, [0.3, 0.8]);
        if (page.confidence !== undefined && page.confidence < SURE) {
          const second = await read(evenOut(image), [0.8, 1]);
          if ((second.confidence ?? 0) > page.confidence) page = second;
        }
        return confidentText(page);
      } catch (e) {
        if (!signal?.aborted) this.discard(pending);
        throw e;
      } finally {
        signal?.removeEventListener('abort', stop);
      }
    } finally {
      if (this.progress === report) this.progress = undefined;
    }
  }
}

function describe(e: unknown): string {
  if (e instanceof Error) return e.message;
  if (typeof e === 'string') return e;
  return (e as { message?: string } | null)?.message ?? String(e);
}

function untilAborted<T>(promise: Promise<T>, signal?: AbortSignal): Promise<T> {
  if (!signal) return promise;
  if (signal.aborted) return Promise.reject(signal.reason);
  return new Promise<T>((resolve, reject) => {
    const onAbort = () => reject(signal.reason);
    signal.addEventListener('abort', onAbort, { once: true });
    promise.then(resolve, reject).finally(() => signal.removeEventListener('abort', onAbort));
  });
}

const MAX_SIDE = 2000;

/**
 * Huge phone photos make Tesseract slow without improving accuracy. Always a
 * canvas, so that its pixels can be evened out for a second reading.
 */
async function downscale(src: string): Promise<HTMLCanvasElement> {
  const img = new Image();
  img.src = src;
  try {
    await img.decode();
  } catch (e) {
    throw new PhotoDecodeError(describe(e)); // e.g. HEIC, or a broken file
  }
  const scale = Math.min(1, MAX_SIDE / Math.max(img.naturalWidth, img.naturalHeight));
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(img.naturalWidth * scale);
  canvas.height = Math.round(img.naturalHeight * scale);
  canvas.getContext('2d')!.drawImage(img, 0, 0, canvas.width, canvas.height);
  return canvas;
}

/** The photo with even lighting and full contrast, on a new canvas. */
function evenOut(photo: HTMLCanvasElement): HTMLCanvasElement {
  const { width, height } = photo;
  const pixels = photo.getContext('2d')!.getImageData(0, 0, width, height);
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  canvas.getContext('2d')!.putImageData(new ImageData(flattenPage(pixels), width, height), 0, 0);
  return canvas;
}
