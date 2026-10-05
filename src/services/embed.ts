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
 * Downloads a picture and returns it as a data URL, to be saved inside the
 * map. Returns undefined when offline, after `signal` aborts, or after ten
 * seconds on a stalled network.
 */
export async function toDataUrl(url: string, signal?: AbortSignal): Promise<string | undefined> {
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
    const type = header.startsWith('image/') ? header : (sniffImage(bytes) ?? (header || 'image/png'));
    let binary = '';
    for (let i = 0; i < bytes.length; i += 0x8000) binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
    return `data:${type};base64,${btoa(binary)}`;
  } catch {
    return undefined;
  } finally {
    clearTimeout(timer);
    signal?.removeEventListener('abort', stop);
  }
}

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
      const src = url && (await toDataUrl(url));
      if (src) found.set(n.id, { ref: n.image.ref, src });
    }),
  );
  return found;
}
