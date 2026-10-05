import { afterEach, describe, expect, it, vi } from 'vitest';
import { embedMissingImages, toDataUrl } from './embed';
import type { MapNode } from '../types/map';

const node = (id: string, image?: MapNode['image']): MapNode => ({ id, label: id, position: { x: 0, y: 0 }, image });

afterEach(() => vi.unstubAllGlobals());

describe('embed', () => {
  it('downloads pictures as data URLs, and gives up quietly offline', async () => {
    vi.stubGlobal('fetch', async () => new Response(new Uint8Array([1, 2, 3]), { headers: { 'content-type': 'image/png' } }));
    expect(await toDataUrl('https://x/y.png')).toBe('data:image/png;base64,AQID');
    vi.stubGlobal('fetch', async () => {
      throw new TypeError('offline');
    });
    expect(await toDataUrl('https://x/y.png')).toBeUndefined();
  });

  it('recognises a picture served as octet-stream, and stops when asked', async () => {
    const png = new Uint8Array([0x89, 0x50, 0x4e, 0x47]);
    vi.stubGlobal('fetch', async () => new Response(png, { headers: { 'content-type': 'application/octet-stream' } }));
    expect(await toDataUrl('https://x/y')).toBe('data:image/png;base64,iVBORw==');
    const stop = new AbortController();
    stop.abort();
    expect(await toDataUrl('https://x/y', stop.signal)).toBeUndefined();
  });

  it('embeds only web pictures that are not saved yet', async () => {
    const urls: string[] = [];
    vi.stubGlobal('fetch', async (url: string) => {
      urls.push(url);
      return new Response(new Uint8Array([1]), { headers: { 'content-type': 'image/png' } });
    });
    const found = await embedMissingImages(
      [
        node('a', { kind: 'arasaac', ref: '1' }),
        node('b', { kind: 'arasaac', ref: '2', src: 'data:image/png;base64,AQ==' }),
        node('c', { kind: 'emoji', ref: '💧' }),
        node('d'),
      ],
      (image) => (image.kind === 'arasaac' ? `https://pic/${image.ref}` : undefined),
    );
    expect(urls).toEqual(['https://pic/1']);
    expect([...found.entries()]).toEqual([['a', { ref: '1', src: 'data:image/png;base64,AQ==' }]]);
  });
});
