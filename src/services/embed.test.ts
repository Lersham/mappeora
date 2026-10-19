import { afterEach, describe, expect, it, vi } from 'vitest';
import { embedMissingImages, ILLUSTRATION_PX, shrinkImage, toDataUrl, toIllustrationDataUrl } from './embed';
import { parseMapFile, parseStoredMap, serializeMap } from '../lib/mapFile';
import type { ConceptMap, MapNode } from '../types/map';

const node = (id: string, image?: MapNode['image']): MapNode => ({ id, label: id, position: { x: 0, y: 0 }, image });

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

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

  it('does not save a web page as a picture', async () => {
    vi.stubGlobal('fetch', async () => new Response('<html>Accedi al wifi</html>', { headers: { 'content-type': 'text/html' } }));
    expect(await toDataUrl('https://x/y.png')).toBeUndefined();
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

  describe('smaller illustrations', () => {
    // A 256 px PNG of about 45 KB (as base64 text, 60 KB).
    const big = `data:image/png;base64,${'A'.repeat(60_000)}`;
    const tiny = 'data:image/webp;base64,UklGRg==';

    /**
     * jsdom can neither decode nor draw: the picture is a fixed size and the
     * canvas records what it is asked. `encoders` is what toDataURL(type) answers.
     */
    function fakeBrowser(size: [number, number], encoders: Record<string, string> = { 'image/webp': tiny }) {
      const canvas = {
        width: 0,
        height: 0,
        context: { imageSmoothingQuality: '', drawImage: vi.fn() },
        asked: [] as [string, number | undefined][],
        getContext() {
          return this.context;
        },
        toDataURL(type: string, quality?: number) {
          this.asked.push([type, quality]);
          // Like Safari: a type it cannot write is answered with a PNG.
          return encoders[type] ?? encoders['image/png'] ?? 'data:image/png;base64,iVBORw==';
        },
      };
      const close = vi.fn();
      const decode = vi.fn(async (_image: Blob) => ({ width: size[0], height: size[1], close }));
      vi.stubGlobal('createImageBitmap', decode);
      const real = document.createElement.bind(document);
      vi.spyOn(document, 'createElement').mockImplementation(((tag: string) => (tag === 'canvas' ? canvas : real(tag))) as typeof document.createElement);
      return { canvas, decode, close };
    }

    it('draws a 256 px picture at 224 px and saves it as WebP', async () => {
      const { canvas, decode, close } = fakeBrowser([256, 256]);
      expect(await shrinkImage(big)).toBe(tiny);
      expect([canvas.width, canvas.height]).toEqual([224, 224]);
      expect(canvas.context.drawImage).toHaveBeenCalledWith(expect.anything(), 0, 0, 224, 224);
      expect(canvas.asked).toEqual([['image/webp', 0.85]]);
      // The bytes handed to the decoder are the picture's own, with its type.
      const blob = decode.mock.calls[0][0];
      expect(blob.type).toBe('image/png');
      expect(blob.size).toBe(45_000);
      expect(close).toHaveBeenCalled();
    });

    it('keeps the proportions', async () => {
      const { canvas } = fakeBrowser([300, 150]);
      await shrinkImage(big);
      expect([canvas.width, canvas.height]).toEqual([224, 112]);
    });

    it('where the browser cannot write WebP (Safari), saves a 224 px PNG instead', async () => {
      const png = 'data:image/png;base64,iVBORw0KGgo=';
      const { canvas } = fakeBrowser([256, 256], { 'image/png': png });
      expect(await shrinkImage(big)).toBe(png);
      expect(canvas.asked.map(([type]) => type)).toEqual(['image/webp', 'image/png']);
      expect([canvas.width, canvas.height]).toEqual([224, 224]);
    });

    it('leaves a picture alone that is not larger than that', async () => {
      const { canvas } = fakeBrowser([224, 160]);
      expect(await shrinkImage(big)).toBe(big);
      expect(canvas.asked).toEqual([]);
    });

    it('never makes it heavier', async () => {
      fakeBrowser([256, 256], { 'image/webp': `data:image/webp;base64,${'A'.repeat(70_000)}` });
      expect(await shrinkImage(big)).toBe(big);
    });

    it('returns the original when anything goes wrong', async () => {
      const { decode, canvas } = fakeBrowser([256, 256]);
      decode.mockRejectedValueOnce(new Error('cannot decode'));
      expect(await shrinkImage(big)).toBe(big);
      canvas.getContext = () => null as never;
      expect(await shrinkImage(big)).toBe(big);
      canvas.toDataURL = () => {
        throw new Error('tainted');
      };
      canvas.getContext = function () {
        return this.context;
      };
      expect(await shrinkImage(big)).toBe(big);
    });

    it('only touches pictures it knows how to decode', async () => {
      const { decode } = fakeBrowser([256, 256]);
      for (const other of ['data:image/svg+xml;base64,PHN2Zy8+', 'data:image/gif;base64,R0lGOA==', 'https://x/y.png', '']) {
        expect(await shrinkImage(other)).toBe(other);
      }
      expect(decode).not.toHaveBeenCalled();
    });

    const png = (kb: number) => {
      const bytes = new Uint8Array(kb * 1000);
      bytes.set([0x89, 0x50, 0x4e, 0x47]);
      return new Response(bytes, { headers: { 'content-type': 'image/png' } });
    };

    it('shrinks on download only when asked: photos and old symbols keep their size', async () => {
      const { decode } = fakeBrowser([256, 256]);
      vi.stubGlobal('fetch', async () => png(45));
      expect((await toDataUrl('https://x/y.png'))?.length).toBeGreaterThan(60_000);
      expect(decode).not.toHaveBeenCalled();
      expect(await toDataUrl('https://x/y.png', undefined, { shrinkTo: ILLUSTRATION_PX })).toBe(tiny);
      expect(await toIllustrationDataUrl('https://x/y.png')).toBe(tiny);
      // 72 CSS px at three pixels per CSS px, with a little to spare.
      expect(ILLUSTRATION_PX).toBeGreaterThanOrEqual(72 * 3);
    });

    it('still gives up quietly offline', async () => {
      fakeBrowser([256, 256]);
      vi.stubGlobal('fetch', async () => {
        throw new TypeError('offline');
      });
      expect(await toIllustrationDataUrl('https://x/y.png')).toBeUndefined();
    });

    it('shrinks the illustrations of older maps when it saves them, but not their symbols', async () => {
      const { decode } = fakeBrowser([256, 256]);
      vi.stubGlobal('fetch', async () => png(45));
      const found = await embedMissingImages(
        [node('a', { kind: 'illustrazione', ref: 'Droplet/3D/droplet_3d' }), node('b', { kind: 'arasaac', ref: '2' })],
        (image) => `https://pic/${image.ref}`,
      );
      expect(found.get('a')?.src).toBe(tiny);
      expect(found.get('b')?.src.startsWith('data:image/png;base64,')).toBe(true);
      expect(found.get('b')?.src.length).toBeGreaterThan(60_000);
      expect(decode).toHaveBeenCalledTimes(1);
    });

    it('a map file, a safety copy and the device storage take the WebP back', () => {
      const map: ConceptMap = {
        id: 'm',
        title: 'Il vulcano',
        createdAt: 1,
        updatedAt: 2,
        template: 'libera',
        nodes: [{ id: 'a', label: 'Vulcano', position: { x: 0, y: 0 }, image: { kind: 'illustrazione', ref: 'Volcano/3D/volcano_3d', src: tiny } }],
        edges: [],
      };
      expect(parseMapFile(serializeMap(map)).nodes[0].image?.src).toBe(tiny);
      expect(parseStoredMap(JSON.stringify(map)).nodes[0].image?.src).toBe(tiny);
    });
  });
});
