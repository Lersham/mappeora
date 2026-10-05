import { describe, expect, it } from 'vitest';
import { LADDER, ladderLayout } from './ladder';

const n = (id: string, x = 0, y = 0) => ({ id, position: { x, y } });
const e = (source: string, target: string, label?: string) => ({ id: `${source}-${target}`, source, target, label });
const sizes = { a: { width: 200, height: 60 }, b: { width: 150, height: 40 }, c: { width: 150, height: 40 }, d: { width: 150, height: 40 } };

describe('ladderLayout', () => {
  it('stacks children below their parent, indented', () => {
    const { positions, order } = ladderLayout([n('a'), n('b', 0, 10), n('c', 0, 20)], [e('a', 'b'), e('a', 'c')], sizes);
    expect(order).toEqual(['a', 'b', 'c']);
    expect(positions.a).toEqual({ x: 0, y: 0 });
    expect(positions.b).toEqual({ x: LADDER.indent, y: 60 + LADDER.gap });
    expect(positions.c).toEqual({ x: LADDER.indent, y: 60 + LADDER.gap + 40 + LADDER.gap });
  });

  it('walks depth first, and keeps the on-screen order of siblings', () => {
    // c is above b on screen: it comes first.
    const { order, positions } = ladderLayout(
      [n('a'), n('b', 0, 50), n('c', 0, 20), n('d', 0, 90)],
      [e('a', 'b'), e('a', 'c'), e('b', 'd')],
      sizes,
    );
    expect(order).toEqual(['a', 'c', 'b', 'd']);
    expect(positions.d.x).toBe(2 * LADDER.indent);
    expect(positions.d.y).toBeGreaterThan(positions.b.y);
  });

  it('leaves room for linking words and keeps the map narrow', () => {
    const plain = ladderLayout([n('a'), n('b', 0, 1)], [e('a', 'b')], sizes).positions;
    const labelled = ladderLayout([n('a'), n('b', 0, 1)], [e('a', 'b', 'causa')], sizes).positions;
    expect(labelled.b.y - plain.b.y).toBe(LADDER.labelSpace);
    expect(labelled.b.x).toBe(plain.b.x);
  });

  it('hangs a concept with two parents from its oldest link', () => {
    const { treeEdges, order } = ladderLayout([n('a'), n('b', 0, 1), n('c', 0, 2)], [e('a', 'b'), e('a', 'c'), e('b', 'c')], sizes);
    expect(order).toEqual(['a', 'b', 'c']);
    expect(treeEdges.has('a-c')).toBe(true);
    expect(treeEdges.has('b-c')).toBe(false);
  });

  it('a link drawn later from another branch never moves a concept out of its branch', () => {
    const nodes = [n('a'), n('b', 0, 1), n('c', 0, 3), n('d', 0, 4)];
    const { treeEdges, order } = ladderLayout(nodes, [e('a', 'b'), e('a', 'c'), e('c', 'd'), e('b', 'd')], sizes);
    expect(order).toEqual(['a', 'b', 'c', 'd']);
    expect(treeEdges.has('c-d')).toBe(true);
    expect(treeEdges.has('b-d')).toBe(false);
  });

  it('keeps concepts side by side in their order left to right, even a few pixels higher or lower', () => {
    const nodes = [n('a'), n('b', 400, 300), n('c', 0, 303), n('d', 200, 297)];
    const { order } = ladderLayout(nodes, [e('a', 'b'), e('a', 'c'), e('a', 'd')], sizes);
    expect(order).toEqual(['a', 'c', 'd', 'b']);
  });

  it('places separate trees and cycles one after the other', () => {
    const { order, positions } = ladderLayout([n('a'), n('x', 0, 5), n('p', 0, 9), n('q', 0, 10)], [e('p', 'q'), e('q', 'p')], sizes, { x: 10, y: 5 });
    expect(order).toHaveLength(4);
    expect(new Set(Object.values(positions).map((p) => p.y)).size).toBe(4);
    expect(positions.a).toEqual({ x: 10, y: 5 });
  });
});
