import { afterEach, describe, expect, it, vi } from 'vitest';
import type { MapTemplate } from '../types/map';
import { NEW_MAP_TITLE, createMap } from './mapFactory';

describe('createMap', () => {
  afterEach(() => vi.useRealTimers());

  it('a map nobody named is a free map called «Nuova mappa»', () => {
    const map = createMap();
    expect(map.title).toBe(NEW_MAP_TITLE);
    expect(map.template).toBe('libera');
    expect(map.nodes.map((n) => n.label)).toContain(NEW_MAP_TITLE);
  });

  it('the main concept takes the title', () => {
    const map = createMap('Il vulcano', '5w');
    expect(map.title).toBe('Il vulcano');
    expect(map.template).toBe('5w');
    expect(map.nodes[0].label).toBe('Il vulcano');
  });

  it('is created and last changed now', () => {
    vi.useFakeTimers({ now: new Date('2026-10-12T10:00:00Z') });
    const map = createMap('Oggi');
    expect(map.createdAt).toBe(Date.parse('2026-10-12T10:00:00Z'));
    expect(map.updatedAt).toBe(map.createdAt);
  });

  it('every template gives a connected starting map with its own ids', () => {
    const templates: MapTemplate[] = ['libera', 'causa-effetto', 'timeline', 'confronto', '5w'];
    for (const template of templates) {
      const map = createMap('Titolo', template);
      const ids = new Set(map.nodes.map((n) => n.id));
      expect(ids.size, template).toBe(map.nodes.length);
      expect(ids.has(map.id), template).toBe(false);
      for (const e of map.edges) expect(ids.has(e.source) && ids.has(e.target), template).toBe(true);
    }
  });

  it('two maps never share an id', () => {
    const a = createMap('Uguale', 'timeline');
    const b = createMap('Uguale', 'timeline');
    expect(a.id).not.toBe(b.id);
    const shared = a.nodes.map((n) => n.id).filter((id) => b.nodes.some((n) => n.id === id));
    expect(shared).toEqual([]);
  });
});
