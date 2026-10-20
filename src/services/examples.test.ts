import { describe, expect, it } from 'vitest';
import { EXAMPLES } from './examples';
import { parseMapFile } from '../lib/mapFile';

/** The files the generators in scripts/esempi write; read as text, like the app fetches them. */
const files = import.meta.glob<string>('../../public/esempi/*.mappeora', { query: '?raw', import: 'default', eager: true });
const fileText = (name: string) => files[`../../public/esempi/${name}`];

describe('example maps', () => {
  it('lists every file in public/esempi, in chronological order', () => {
    const onDisk = Object.keys(files).map((path) => path.split('/').pop()).sort();
    expect(EXAMPLES.map((e) => e.file).sort()).toEqual(onDisk);
    expect(EXAMPLES.map((e) => e.file)).toEqual(['civilta-egizia.mappeora', 'nascita-di-roma.mappeora', 'rivoluzione-francese.mappeora']);
  });

  describe.each(EXAMPLES)('$title', (example) => {
    const text = fileText(example.file);
    const map = parseMapFile(text);

    it('opens, with the title of the list', () => {
      expect(map.title).toBe(example.title);
      expect(example.description.length).toBeGreaterThan(20);
    });

    it('is one connected tree', () => {
      const ids = new Set(map.nodes.map((n) => n.id));
      expect(ids.size).toBe(map.nodes.length);
      expect(map.edges).toHaveLength(map.nodes.length - 1);
      const targets = new Set(map.edges.map((e) => e.target));
      expect(map.nodes.filter((n) => !targets.has(n.id))).toHaveLength(1);
    });

    it('has real pictures, kept after reading the file', () => {
      const photos = map.nodes.filter((n) => n.image?.kind === 'foto');
      expect(photos.length).toBeGreaterThanOrEqual(6);
      for (const n of photos) expect(n.image!.ref).toMatch(/^data:image\/jpeg;base64,/);
      // Fluent illustrations keep their picture too, so the map shows offline.
      for (const n of map.nodes.filter((n) => n.image?.kind === 'illustrazione')) expect(n.image!.src).toMatch(/^data:image\/png;base64,/);
    });

    it('stays small enough to open on a slow connection', () => {
      expect(text.length).toBeLessThan(600 * 1024);
    });

    it('has linking words on the first-level branches', () => {
      const root = map.nodes.find((n) => !map.edges.some((e) => e.target === n.id))!;
      const branches = map.edges.filter((e) => e.source === root.id);
      expect(branches.filter((e) => !e.label)).toEqual([]);
    });
  });
});
