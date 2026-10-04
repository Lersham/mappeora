import { describe, expect, it } from 'vitest';
import { MapFileError, parseMapFile, serializeMap, textToDataUrl } from './mapFile';
import { createMap } from './mapFactory';

describe('mapFile', () => {
  it('round-trips a map as a new copy', () => {
    const map = createMap('L’acqua', 'causa-effetto');
    map.nodes[0].image = { kind: 'foto', ref: 'data:image/jpeg;base64,AAAA' };
    map.nodes[0].collapsed = true;
    const copy = parseMapFile(serializeMap(map));
    expect(copy.id).not.toBe(map.id);
    expect(copy.title).toBe('L’acqua');
    expect(copy.template).toBe('causa-effetto');
    expect(copy.nodes).toEqual(map.nodes);
    expect(copy.edges).toEqual(map.edges);
    expect(copy.freeLayout).toBeUndefined();
  });

  it('keeps a map placed by hand as it is', () => {
    const map = { ...createMap('Le stagioni'), freeLayout: true };
    expect(parseMapFile(serializeMap(map)).freeLayout).toBe(true);
  });

  it('rejects files that are not maps', () => {
    expect(() => parseMapFile('ciao')).toThrow(MapFileError);
    expect(() => parseMapFile('{"format":"altro","map":{}}')).toThrow(MapFileError);
    expect(() => parseMapFile('{"format":"mappeora","version":1,"map":{"nodes":[]}}')).toThrow(MapFileError);
    expect(() => parseMapFile('{"format":"mappeora","version":99,"map":{}}')).toThrow(/più nuova/);
  });

  it('keeps embedded pictures of symbols (older maps) and illustrations, drops remote ones', () => {
    const map = createMap('Test');
    map.nodes[0].image = { kind: 'illustrazione', ref: 'Droplet/3D/droplet_3d', src: 'data:image/png;base64,AAAA' };
    expect(parseMapFile(serializeMap(map)).nodes[0].image).toEqual(map.nodes[0].image);
    map.nodes[0].image = { kind: 'arasaac', ref: '2248', src: 'data:image/png;base64,AAAA' };
    expect(parseMapFile(serializeMap(map)).nodes[0].image).toEqual(map.nodes[0].image);
    map.nodes[0].image = { kind: 'arasaac', ref: '2248', src: 'https://evil.example/x.png' };
    expect(parseMapFile(serializeMap(map)).nodes[0].image).toBeUndefined();
    map.nodes[0].image = { kind: 'illustrazione', ref: '../../etc/passwd' };
    expect(parseMapFile(serializeMap(map)).nodes[0].image).toBeUndefined();
  });

  it('drops remote media, unknown fields and dangling links', () => {
    const file = JSON.stringify({
      format: 'mappeora',
      version: 1,
      map: {
        title: 'Test',
        template: 'boh',
        nodes: [
          { id: 'a', label: 'A', position: { x: 0, y: 0 }, image: { kind: 'foto', ref: 'https://evil.example/x.jpg' }, extra: 1 },
          { id: 'b', label: 'B', position: { x: 0, y: 100 }, audio: { dataUrl: 'data:audio/webm;base64,AAAA', durationMs: 1 } },
          { id: 'c', label: 'senza posizione' },
        ],
        edges: [
          { id: 'e1', source: 'a', target: 'b', label: 'causa' },
          { id: 'e2', source: 'a', target: 'zzz' },
        ],
      },
    });
    const map = parseMapFile(file);
    expect(map.template).toBe('libera');
    expect(map.nodes).toEqual([
      { id: 'a', label: 'A', position: { x: 0, y: 0 } },
      { id: 'b', label: 'B', position: { x: 0, y: 100 } },
    ]);
    expect(map.edges).toEqual([{ id: 'e1', source: 'a', target: 'b', label: 'causa' }]);
  });

  it('encodes UTF-8 text as a data URL', () => {
    const url = textToDataUrl('perché è così', 'application/json');
    const decoded = new TextDecoder().decode(Uint8Array.from(atob(url.split(',')[1]), (c) => c.charCodeAt(0)));
    expect(decoded).toBe('perché è così');
  });
});
