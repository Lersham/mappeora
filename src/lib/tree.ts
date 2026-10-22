import type { ConceptMap, MapEdge } from '../types/map';

type Graph = Pick<ConceptMap, 'nodes' | 'edges'>;

export interface SpanningTree {
  /** How far down the tree (0 for a root). */
  depth: Map<string, number>;
  /** Links that go down or across the map: all but those closing a cycle. */
  forward: MapEdge[];
  /** The concept each one hangs from in the tree (none for a root). */
  parent: Map<string, string>;
}

/**
 * The map read as a tree, as the sheet draws it (see layoutTree in
 * ladder.ts): each concept hangs from its first link, the others are
 * cross-links («Collega»). It starts from the concepts nobody points to
 * (or, if everything is in a cycle, from the first concept). A link back to
 * an ancestor — «Ciclo dell'acqua» drawn as a real cycle — is left out, so
 * the main concept stays the main concept.
 */
export function spanningTree(map: Graph): SpanningTree {
  const ids = new Set(map.nodes.map((n) => n.id));
  const edges = map.edges.filter((e) => e.source !== e.target && ids.has(e.source) && ids.has(e.target));
  const parentLink = new Map<string, MapEdge>();
  for (const e of edges) if (!parentLink.has(e.target)) parentLink.set(e.target, e);
  const out = new Map<string, MapEdge[]>();
  for (const e of edges) out.set(e.source, [...(out.get(e.source) ?? []), e]);

  const depth = new Map<string, number>();
  const parent = new Map<string, string>();
  const hang = (id: string, from: string | undefined) => {
    const queue = [id];
    depth.set(id, from === undefined ? 0 : depth.get(from)! + 1);
    if (from !== undefined) parent.set(id, from);
    for (let i = 0; i < queue.length; i++) {
      for (const e of out.get(queue[i]) ?? []) {
        if (parentLink.get(e.target) !== e || depth.has(e.target)) continue;
        depth.set(e.target, depth.get(queue[i])! + 1);
        parent.set(e.target, queue[i]);
        queue.push(e.target);
      }
    }
  };
  const seeds = [...map.nodes.filter((n) => !parentLink.has(n.id)), ...map.nodes].map((n) => n.id);
  for (;;) {
    // A concept whose first link comes from a cycle hangs from where it is reached.
    const adopted = edges.find((e) => depth.has(e.source) && !depth.has(e.target));
    if (adopted) {
      hang(adopted.target, adopted.source);
      continue;
    }
    const next = seeds.find((id) => !depth.has(id));
    if (next === undefined) break;
    hang(next, undefined);
  }

  const isAncestorOrSelf = (candidate: string, of: string) => {
    for (let id: string | undefined = of; id !== undefined; id = parent.get(id)) if (id === candidate) return true;
    return false;
  };
  return { depth, forward: edges.filter((e) => !isAncestorOrSelf(e.target, e.source)), parent };
}
