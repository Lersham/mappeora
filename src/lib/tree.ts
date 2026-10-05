import type { ConceptMap, MapEdge } from '../types/map';

type Graph = Pick<ConceptMap, 'nodes' | 'edges'>;

export interface SpanningTree {
  /** Distance from the nearest root (0 for a root). */
  depth: Map<string, number>;
  /** Links that go down or across the map: all but those closing a cycle. */
  forward: MapEdge[];
}

/**
 * The map read as a tree: breadth first from the concepts nobody points to
 * (or, if everything is in a cycle, from the first concept). A link back to
 * an ancestor — «Ciclo dell'acqua» drawn as a real cycle — is left out, so
 * the main concept stays the main concept.
 */
export function spanningTree(map: Graph): SpanningTree {
  const ids = new Set(map.nodes.map((n) => n.id));
  const edges = map.edges.filter((e) => e.source !== e.target && ids.has(e.source) && ids.has(e.target));
  const out = new Map<string, string[]>();
  for (const e of edges) out.set(e.source, [...(out.get(e.source) ?? []), e.target]);
  const hasParent = new Set(edges.map((e) => e.target));

  const depth = new Map<string, number>();
  const parent = new Map<string, string>();
  const bfs = (seeds: string[]) => {
    const queue = seeds.filter((id) => !depth.has(id));
    for (const id of queue) depth.set(id, 0);
    for (let i = 0; i < queue.length; i++) {
      const id = queue[i];
      for (const child of out.get(id) ?? []) {
        if (depth.has(child)) continue;
        depth.set(child, depth.get(id)! + 1);
        parent.set(child, id);
        queue.push(child);
      }
    }
  };
  bfs(map.nodes.filter((n) => !hasParent.has(n.id)).map((n) => n.id));
  for (const n of map.nodes) if (!depth.has(n.id)) bfs([n.id]);

  const isAncestorOrSelf = (candidate: string, of: string) => {
    for (let id: string | undefined = of; id !== undefined; id = parent.get(id)) if (id === candidate) return true;
    return false;
  };
  return { depth, forward: edges.filter((e) => !isAncestorOrSelf(e.target, e.source)) };
}
