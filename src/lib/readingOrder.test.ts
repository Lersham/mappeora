import { describe, expect, it } from 'vitest';
import { readingOrder } from './readingOrder';
import type { MapEdge, MapNode } from '../types/map';

const node = (id: string, label = id): MapNode => ({ id, label, position: { x: 0, y: 0 } });
const edge = (source: string, target: string, label?: string): MapEdge => ({ id: `${source}-${target}`, source, target, label });

describe('readingOrder', () => {
  it('reads from the root, breadth first, prefixing linking words', () => {
    const steps = readingOrder({
      nodes: [node('c', 'ossigeno'), node('a', 'acqua'), node('b', 'idrogeno')],
      edges: [edge('a', 'b', 'è formata da'), edge('a', 'c')],
    });
    expect(steps).toEqual([
      { nodeId: 'a', text: 'acqua' },
      { nodeId: 'b', text: 'è formata da: idrogeno' },
      { nodeId: 'c', text: 'ossigeno' },
    ]);
  });

  it('reads a "scaletta" from top to bottom, depth first', () => {
    const at = (id: string, label: string, y: number): MapNode => ({ id, label, position: { x: 0, y } });
    const steps = readingOrder(
      {
        nodes: [at('a', 'acqua', 0), at('b', 'idrogeno', 10), at('c', 'ossigeno', 30), at('d', 'atomo', 20)],
        edges: [edge('a', 'b', 'è formata da'), edge('a', 'c'), edge('b', 'd')],
      },
      { depthFirst: true },
    );
    expect(steps.map((s) => s.text)).toEqual(['acqua', 'è formata da: idrogeno', 'atomo', 'ossigeno']);
  });

  it('includes disconnected nodes and survives cycles', () => {
    const steps = readingOrder({
      nodes: [node('a'), node('b'), node('x')],
      edges: [edge('a', 'b'), edge('b', 'a')],
    });
    expect(steps.map((s) => s.nodeId).sort()).toEqual(['a', 'b', 'x']);
  });
});
