import { describe, expect, it } from 'vitest';
import { fromOutline, toOutline } from './outline';
import { ladderLayout } from './ladder';
import type { MapEdge, MapNode } from '../types/map';

const at = (id: string, label: string, y: number, extra: Partial<MapNode> = {}): MapNode => ({ id, label, position: { x: 0, y }, ...extra });
const edge = (source: string, target: string, label?: string): MapEdge => ({ id: `${source}-${target}`, source, target, label });

const water = {
  nodes: [at('a', 'Acqua', 0), at('b', 'Stati', 10), at('c', 'Ghiaccio', 20, { color: '#ffffff' }), at('d', 'Ciclo', 30)],
  edges: [edge('a', 'b', 'ha tre'), edge('b', 'c'), edge('a', 'd'), edge('d', 'c', 'fa sciogliere')],
};

describe('toOutline', () => {
  it('lists the concepts in reading order, indented under the one they hang from', () => {
    expect(toOutline(water)).toEqual([
      { id: 'a', label: 'Acqua', depth: 0 },
      { id: 'b', label: 'Stati', depth: 1 },
      { id: 'c', label: 'Ghiaccio', depth: 2 },
      { id: 'd', label: 'Ciclo', depth: 1 },
    ]);
  });
});

describe('fromOutline', () => {
  it('gives back the same map when nothing changes', () => {
    const map = fromOutline(water, toOutline(water));
    expect(map.edges).toEqual(water.edges); // the cross-link points back up the list: kept
    expect(map.nodes.map((n) => [n.label, n.color])).toEqual([
      ['Acqua', undefined],
      ['Stati', undefined],
      ['Ghiaccio', '#ffffff'],
      ['Ciclo', undefined],
    ]);
  });

  it('renames, adds, moves and removes concepts', () => {
    const map = fromOutline(water, [
      { id: 'a', label: 'L’acqua', depth: 0 },
      { id: 'd', label: 'Ciclo', depth: 1 },
      { id: 'n', label: '  Evaporazione ', depth: 2 },
      { id: 'c', label: 'Ghiaccio', depth: 1 },
      { id: 'x', label: '   ', depth: 1 }, // an empty line is left out
    ]);
    expect(map.nodes.map((n) => n.label)).toEqual(['L’acqua', 'Ciclo', 'Evaporazione', 'Ghiaccio']);
    expect(map.nodes.find((n) => n.id === 'n')).toMatchObject({ shape: 'rettangolo', color: expect.any(String) });
    // "Stati" is gone with its links; "Ghiaccio" now hangs from "L’acqua"
    expect(map.edges.map((e) => [e.source, e.target, e.label])).toEqual([
      ['a', 'd', undefined],
      ['d', 'n', undefined],
      ['a', 'c', undefined],
      // the cross-link now points down the list: it would pull "Ghiaccio" under "Ciclo"
    ]);
    // the order of the list is the order on the sheet
    expect(ladderLayout(map.nodes, map.edges).order).toEqual(['a', 'd', 'n', 'c']);
  });

  it('never indents a line more than one step past the one above', () => {
    const map = fromOutline({ nodes: [], edges: [] }, [
      { id: 'a', label: 'Uno', depth: 1 },
      { id: 'b', label: 'Due', depth: 3 },
    ]);
    expect(toOutline(map).map((r) => r.depth)).toEqual([0, 1]);
  });
});
