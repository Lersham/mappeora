import { describe, expect, it } from 'vitest';
import type { MapEdge, MapNode } from '../types/map';
import { spanningTree } from './tree';

const node = (id: string): MapNode => ({ id, label: id, position: { x: 0, y: 0 } });
const edge = (source: string, target: string): MapEdge => ({ id: `${source}>${target}`, source, target });
const graph = (ids: string[], links: [string, string][]) => ({ nodes: ids.map(node), edges: links.map(([s, t]) => edge(s, t)) });
const forward = (g: ReturnType<typeof graph>) => spanningTree(g).forward.map((e) => e.id).sort();

describe('spanningTree', () => {
  it('reads a plain tree from the main concept down', () => {
    // acqua → (mare, fiume); fiume → lago
    const g = graph(['acqua', 'mare', 'fiume', 'lago'], [['acqua', 'mare'], ['acqua', 'fiume'], ['fiume', 'lago']]);
    const { depth, parent } = spanningTree(g);
    expect(Object.fromEntries(depth)).toEqual({ acqua: 0, mare: 1, fiume: 1, lago: 2 });
    expect(Object.fromEntries(parent)).toEqual({ mare: 'acqua', fiume: 'acqua', lago: 'fiume' });
    expect(forward(g)).toEqual(['acqua>fiume', 'acqua>mare', 'fiume>lago']);
  });

  it('an empty map has no tree', () => {
    const { depth, parent, forward } = spanningTree({ nodes: [], edges: [] });
    expect(depth.size + parent.size + forward.length).toBe(0);
  });

  it('a concept on its own is a root', () => {
    const { depth, parent } = spanningTree(graph(['solo'], []));
    expect(depth.get('solo')).toBe(0);
    expect(parent.has('solo')).toBe(false);
  });

  it('hangs a concept reached twice from its first link, as drawn, and keeps the cross-link', () => {
    // a → b → c, and later a cross-link a → c («Collega»)
    const g = graph(['a', 'b', 'c'], [['a', 'b'], ['b', 'c'], ['a', 'c']]);
    const { depth, parent } = spanningTree(g);
    expect(depth.get('c')).toBe(2);
    expect(parent.get('c')).toBe('b');
    expect(forward(g)).toEqual(['a>b', 'a>c', 'b>c']);
  });

  it('a cross-link between two branches leaves both where they are', () => {
    // governo and stato under paese; a cross-link governo → concetto, which is under stato
    const g = graph(
      ['paese', 'governo', 'stato', 'concetto'],
      [['paese', 'governo'], ['paese', 'stato'], ['stato', 'concetto'], ['governo', 'concetto']],
    );
    const { depth, parent } = spanningTree(g);
    expect(parent.get('concetto')).toBe('stato');
    expect(depth.get('concetto')).toBe(2);
  });

  it('leaves out a link back to an ancestor, so the main concept stays on top', () => {
    // Ciclo dell'acqua under a title: acqua → evaporazione → nuvole → pioggia → evaporazione
    const g = graph(
      ['acqua', 'evaporazione', 'nuvole', 'pioggia'],
      [['acqua', 'evaporazione'], ['evaporazione', 'nuvole'], ['nuvole', 'pioggia'], ['pioggia', 'evaporazione']],
    );
    const { depth, parent } = spanningTree(g);
    expect(depth.get('acqua')).toBe(0);
    expect(parent.get('evaporazione')).toBe('acqua');
    expect(forward(g)).not.toContain('pioggia>evaporazione');
    expect(forward(g)).toHaveLength(3);
  });

  it('starts from the first concept when everything is in a cycle', () => {
    const g = graph(['evaporazione', 'nuvole', 'pioggia'], [['evaporazione', 'nuvole'], ['nuvole', 'pioggia'], ['pioggia', 'evaporazione']]);
    const { depth, parent } = spanningTree(g);
    expect(Object.fromEntries(depth)).toEqual({ evaporazione: 0, nuvole: 1, pioggia: 2 });
    expect(parent.has('evaporazione')).toBe(false);
    expect(forward(g)).toEqual(['evaporazione>nuvole', 'nuvole>pioggia']);
  });

  it('two concepts pointing at each other: the first one is on top', () => {
    const g = graph(['giorno', 'notte'], [['giorno', 'notte'], ['notte', 'giorno']]);
    expect(spanningTree(g).parent.get('notte')).toBe('giorno');
    expect(forward(g)).toEqual(['giorno>notte']);
  });

  it('without a free concept, the first one stays on top even if a cycle points to it, as on the sheet', () => {
    // «mare» was made first (the title), then a cycle points to it. The layout
    // (ladder.ts) keeps it as a main concept: the tree must agree with what is drawn.
    const g = graph(['mare', 'evaporazione', 'pioggia'], [['evaporazione', 'pioggia'], ['pioggia', 'evaporazione'], ['pioggia', 'mare']]);
    const { depth, parent } = spanningTree(g);
    expect(depth.get('mare')).toBe(0);
    expect(parent.has('mare')).toBe(false);
    expect(depth.get('evaporazione')).toBe(0);
    expect(parent.get('pioggia')).toBe('evaporazione');
    expect(forward(g)).toEqual(['evaporazione>pioggia', 'pioggia>mare']);
  });

  it('separate trees each have their own root', () => {
    const g = graph(['a', 'a1', 'b', 'b1'], [['a', 'a1'], ['b', 'b1']]);
    const { depth, parent } = spanningTree(g);
    expect(depth.get('a')).toBe(0);
    expect(depth.get('b')).toBe(0);
    expect(parent.get('b1')).toBe('b');
  });

  it('a cycle on its own next to a tree gets its own root', () => {
    const g = graph(['a', 'a1', 'x', 'y'], [['a', 'a1'], ['x', 'y'], ['y', 'x']]);
    const { depth, parent } = spanningTree(g);
    expect(depth.get('x')).toBe(0);
    expect(parent.get('y')).toBe('x');
    expect(forward(g)).toEqual(['a>a1', 'x>y']);
  });

  it('ignores a link to itself and links to concepts that are gone', () => {
    const g = graph(['a', 'b'], [['a', 'a'], ['a', 'b'], ['a', 'gone'], ['gone', 'b']]);
    const { depth, parent } = spanningTree(g);
    expect(depth.get('a')).toBe(0);
    expect(parent.get('b')).toBe('a');
    expect(depth.has('gone')).toBe(false);
    expect(forward(g)).toEqual(['a>b']);
  });

  it('a concept pointed to only by a link to itself is still a root', () => {
    // «b» comes first: if the link a → a counted, the map would look all cycle and start from «b».
    const g = graph(['b', 'a'], [['a', 'a'], ['a', 'b']]);
    const { depth, parent } = spanningTree(g);
    expect(depth.get('a')).toBe(0);
    expect(parent.get('b')).toBe('a');
  });
});
