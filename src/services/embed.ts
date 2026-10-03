import type { MapNode } from '../types/map';

/**
 * Downloads a picture and returns it as a data URL, to be saved inside the
 * map. Returns undefined when offline: the map then keeps the web address.
 */
export async function toDataUrl(url: string): Promise<string | undefined> {
  try {
    const res = await fetch(url);
    if (!res.ok) return undefined;
    const type = (res.headers.get('content-type') ?? 'image/png').split(';')[0];
    const bytes = new Uint8Array(await res.arrayBuffer());
    let binary = '';
    for (let i = 0; i < bytes.length; i += 0x8000) binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
    return `data:${type};base64,${btoa(binary)}`;
  } catch {
    return undefined;
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
