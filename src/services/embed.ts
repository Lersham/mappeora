import type { MapNode } from '../types/map';

/** What the first bytes say, when the server does not (e.g. "octet-stream"). */
function sniffImage(b: Uint8Array): string | undefined {
  const starts = (...xs: number[]) => xs.every((x, i) => b[i] === x);
  if (starts(0x89, 0x50, 0x4e, 0x47)) return 'image/png';
  if (starts(0xff, 0xd8, 0xff)) return 'image/jpeg';
  if (starts(0x47, 0x49, 0x46, 0x38)) return 'image/gif';
  if (starts(0x52, 0x49, 0x46, 0x46) && String.fromCharCode(...b.subarray(8, 12)) === 'WEBP') return 'image/webp';
  return undefined;
}

/**
 * Longest side (px) of an illustration saved in a map. It is shown at 72 px,
 * so even an export at twice the pixels (144) is sharp; the downloaded 256 px
 * picture only made every map, copy and file about ten times heavier.
 */
export const ILLUSTRATION_PX = 192;

const SHRINKABLE = /^data:image\/(?:png|jpeg|webp);base64,/;

function dataUrlToBlob(dataUrl: string): Blob {
  const binary = atob(dataUrl.slice(dataUrl.indexOf(',') + 1));
  const bytes = Uint8Array.from(binary, (c) => c.charCodeAt(0));
  return new Blob([bytes], { type: dataUrl.slice(5, dataUrl.indexOf(';')) });
}

async function decode(dataUrl: string) {
  if (typeof createImageBitmap === 'function') {
    const bitmap = await createImageBitmap(dataUrlToBlob(dataUrl));
    return { image: bitmap as CanvasImageSource, width: bitmap.width, height: bitmap.height, release: () => bitmap.close() };
  }
  const img = new Image();
  img.src = dataUrl;
  await img.decode();
  return { image: img as CanvasImageSource, width: img.naturalWidth, height: img.naturalHeight, release: () => {} };
}

/**
 * The same picture with its longest side at most `max` px, as WebP (with
 * its transparency) or, where the browser cannot write WebP (Safari), as PNG.
 * Whatever goes wrong, or whatever would come out heavier or no smaller in
 * size, the original is returned: it is only a saving, never a risk.
 */
export async function shrinkImage(dataUrl: string, max = ILLUSTRATION_PX): Promise<string> {
  if (!SHRINKABLE.test(dataUrl)) return dataUrl;
  try {
    const { image, width, height, release } = await decode(dataUrl);
    try {
      if (!(width > 0 && height > 0) || Math.max(width, height) <= max) return dataUrl;
      const scale = max / Math.max(width, height);
      const canvas = document.createElement('canvas');
      canvas.width = Math.max(1, Math.round(width * scale));
      canvas.height = Math.max(1, Math.round(height * scale));
      const context = canvas.getContext('2d');
      if (!context) return dataUrl;
      context.imageSmoothingQuality = 'high';
      context.drawImage(image, 0, 0, canvas.width, canvas.height);
      const webp = canvas.toDataURL('image/webp', 0.85);
      const smaller = webp.startsWith('data:image/webp') ? webp : canvas.toDataURL('image/png');
      return smaller.length < dataUrl.length ? smaller : dataUrl;
    } finally {
      release();
    }
  } catch {
    return dataUrl;
  }
}

/**
 * Downloads a picture and returns it as a data URL, to be saved inside the
 * map. Returns undefined when offline, after `signal` aborts, or after ten
 * seconds on a stalled network. With `shrinkTo`, a larger picture is made
 * smaller first (illustrations only: photos have their own size, see photo.ts).
 */
export async function toDataUrl(url: string, signal?: AbortSignal, options?: { shrinkTo?: number }): Promise<string | undefined> {
  const timeout = new AbortController();
  const timer = setTimeout(() => timeout.abort(), 10_000);
  const stop = () => timeout.abort();
  signal?.addEventListener('abort', stop);
  try {
    if (signal?.aborted) return undefined;
    const res = await fetch(url, { signal: timeout.signal });
    if (!res.ok) return undefined;
    const bytes = new Uint8Array(await res.arrayBuffer());
    const header = (res.headers.get('content-type') ?? '').split(';')[0].trim();
    // A page instead of a picture (the school wifi's login) is not saved as one.
    const type = header.startsWith('image/') ? header : (sniffImage(bytes) ?? (header ? undefined : 'image/png'));
    if (!type) return undefined;
    let binary = '';
    for (let i = 0; i < bytes.length; i += 0x8000) binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
    const data = `data:${type};base64,${btoa(binary)}`;
    return options?.shrinkTo ? await shrinkImage(data, options.shrinkTo) : data;
  } catch {
    return undefined;
  } finally {
    clearTimeout(timer);
    signal?.removeEventListener('abort', stop);
  }
}

/** A Fluent Emoji illustration, saved at the size it needs (see ILLUSTRATION_PX). */
export const toIllustrationDataUrl = (url: string, signal?: AbortSignal) => toDataUrl(url, signal, { shrinkTo: ILLUSTRATION_PX });

/**
 * Maps made before pictures were saved inside them still point to the web.
 * Returns, per node, the downloaded picture for its current image `ref`.
 */
export async function embedMissingImages(
  nodes: MapNode[],
  urlFor: (image: NonNullable<MapNode['image']>) => string | undefined,
): Promise<Map<string, { ref: string; src: string }>> {
  const found = new Map<string, { ref: string; src: string }>();
  await Promise.all(
    nodes.map(async (n) => {
      if (!n.image || n.image.src) return;
      const url = urlFor(n.image);
      const src = url && (await toDataUrl(url, undefined, n.image.kind === 'illustrazione' ? { shrinkTo: ILLUSTRATION_PX } : undefined));
      if (src) found.set(n.id, { ref: n.image.ref, src });
    }),
  );
  return found;
}
