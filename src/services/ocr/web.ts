import type { Worker } from 'tesseract.js';
import type { PickedPhoto } from '../photo';
import { OcrDownloadError, PhotoDecodeError, type OcrService } from './types';

/**
 * Silence that means the download is stuck: the engine reports progress only
 * between its steps (engine, then the Italian model), so this is generous.
 */
const STALL_MS = 120_000;

/**
 * Tesseract.js (WebAssembly) runs in the browser: the photo never leaves
 * the device. The first use downloads the engine and the Italian model
 * from jsDelivr (a few MB); afterwards they are cached (see vite.config.ts).
 */
export class WebOcr implements OcrService {
  private worker: Promise<Worker> | undefined;
  /** The progress callback of the latest recognize() call. */
  private progress: ((p: number) => void) | undefined;

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
              if (m.status === 'recognizing text') this.progress?.(0.3 + m.progress * 0.7);
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
        const { data } = await untilAborted(worker.recognize(image), signal);
        return data.text;
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

/** Huge phone photos make Tesseract slow without improving accuracy. */
async function downscale(src: string): Promise<HTMLCanvasElement | string> {
  const img = new Image();
  img.src = src;
  try {
    await img.decode();
  } catch (e) {
    throw new PhotoDecodeError(describe(e)); // e.g. HEIC, or a broken file
  }
  const scale = Math.min(1, MAX_SIDE / Math.max(img.naturalWidth, img.naturalHeight));
  if (scale === 1) return src;
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(img.naturalWidth * scale);
  canvas.height = Math.round(img.naturalHeight * scale);
  canvas.getContext('2d')!.drawImage(img, 0, 0, canvas.width, canvas.height);
  return canvas;
}
