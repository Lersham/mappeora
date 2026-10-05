import { describe, expect, it } from 'vitest';
import { carryHidden, collapseInfo, visiblePart } from './collapse';
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

  it('a link back to the main concept does not hide the whole map', () => {
    // Ciclo dell'acqua: A → B → C → A, plus A → D.
    const nodes = [node('A'), node('B', true), node('C'), node('D')];
    const info = collapseInfo({ nodes, edges: [edge('A', 'B'), edge('B', 'C'), edge('C', 'A'), edge('A', 'D')] });
    expect([...info.hidden]).toEqual(['C']);
    expect(info.hiddenBelow).toEqual({ B: 1 });
  });

  it('never hides every concept, even when they are all collapsed in a loop', () => {
    const info = collapseInfo({ nodes: [node('A', true), node('B', true)], edges: [edge('A', 'B'), edge('B', 'A')] });
    expect([...info.hidden]).toEqual(['B']);
    expect(info.hiddenBelow).toEqual({ A: 1 });
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

  it('a layout of what is on screen moves a collapsed branch with its concept, keeping its shape', () => {
    const at = (id: string, x: number, y: number, collapsed = false): MapNode => ({ ...node(id, collapsed), position: { x, y } });
    const nodes = [at('A', 0, 0), at('B', 0, 100, true), at('D', 50, 200), at('E', 50, 300), at('C', 300, 100), at('F', 300, 200), at('G', 300, 300)];
    const moved = carryHidden({ nodes, edges }, { A: { x: 0, y: 0 }, B: { x: -100, y: 150 }, C: { x: 200, y: 150 }, F: { x: 200, y: 250 }, G: { x: 200, y: 350 } });
    expect(moved.D).toEqual({ x: -50, y: 250 });
    expect(moved.E).toEqual({ x: -50, y: 350 });
    // G is on screen through F: it goes where the layout put it
    expect(moved.G).toEqual({ x: 200, y: 350 });
  });
});
