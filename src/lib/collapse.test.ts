import { describe, expect, it } from 'vitest';
import { collapseInfo, visiblePart } from './collapse';
import type { MapEdge, MapNode } from '../types/map';

const node = (id: string, collapsed = false): MapNode => ({ id, label: id, position: { x: 0, y: 0 }, ...(collapsed && { collapsed }) });
const edge = (source: string, target: string): MapEdge => ({ id: `${source}-${target}`, source, target });

describe('collapse', () => {
  //      A
  //    /   \
  //   B*    C
  //  / \     \
  // D   E     F
  //      \   /
  //        G      (G is also reachable through C → F)
  const edges = [edge('A', 'B'), edge('A', 'C'), edge('B', 'D'), edge('B', 'E'), edge('C', 'F'), edge('E', 'G'), edge('F', 'G')];

  it('hides what is only reachable through a collapsed concept', () => {
    const nodes = ['A', 'C', 'D', 'E', 'F', 'G'].map((id) => node(id)).concat(node('B', true));
    const info = collapseInfo({ nodes, edges });
    expect([...info.hidden].sort()).toEqual(['D', 'E']);
    expect(info.hiddenBelow).toEqual({ B: 2 });
  });

  it('nests: a collapsed concept inside a collapsed branch is hidden too', () => {
    const nodes = [node('A', true), node('B', true), ...['C', 'D', 'E', 'F', 'G'].map((id) => node(id))];
    const info = collapseInfo({ nodes, edges });
    expect([...info.hidden].sort()).toEqual(['B', 'C', 'D', 'E', 'F', 'G']);
    expect(info.hiddenBelow).toEqual({ A: 6 });
  });

  it('survives cycles', () => {
    const nodes = [node('X', true), node('Y')];
    const info = collapseInfo({ nodes, edges: [edge('X', 'Y'), edge('Y', 'X')] });
    expect([...info.hidden]).toEqual(['Y']);
  });

  it('visiblePart drops hidden concepts and their links', () => {
    const nodes = [node('A'), node('B', true), node('D')];
    const part = visiblePart({ nodes, edges: [edge('A', 'B'), edge('B', 'D')] });
    expect(part.nodes.map((n) => n.id)).toEqual(['A', 'B']);
    expect(part.edges.map((e) => e.id)).toEqual(['A-B']);
  });
});
