import type { ConceptMap, MapEdge } from '../types/map';
import { spanningTree } from './tree';

type Graph = Pick<ConceptMap, 'nodes' | 'edges'>;

/** The links of the tree: each concept with the one it hangs from (no cross-links). */
function treeLinks(map: Graph): MapEdge[] {
  const { parent } = spanningTree(map);
  return map.edges.filter((e) => parent.get(e.target) === e.source);
}

/** The tree link that brings `id` under its parent, if any. */
function linkFromParent(map: Graph, id: string): MapEdge | undefined {
  return treeLinks(map).find((e) => e.target === id);
}

/** The concepts right under `id` in the tree. */
export function childrenOf(map: Graph, id: string): string[] {
  return treeLinks(map)
    .filter((e) => e.source === id)
    .map((e) => e.target);
}

/** `id` and every concept below it. */
export function branchOf(map: Graph, id: string): Set<string> {
  const below = new Map<string, string[]>();
  for (const e of treeLinks(map)) below.set(e.source, [...(below.get(e.source) ?? []), e.target]);
  const out = new Set<string>();
  const visit = (n: string) => {
    if (out.has(n)) return;
    out.add(n);
    for (const c of below.get(n) ?? []) visit(c);
  };
  visit(id);
  return out;
}

/**
 * Takes `id` away and lifts the concepts under it one level, under its own
 * parent, with the linking words they had. Null for a concept without a
 * parent that has some under it: they would be left hanging on their own.
 */
export function removeLiftingChildren(map: Graph, id: string): Graph | null {
  const up = linkFromParent(map, id);
  const below = treeLinks(map).filter((e) => e.source === id);
  if (!up && below.length > 0) return null;
  const lifted = new Set(below.map((e) => e.id));
  const edges = map.edges.flatMap((e) => {
    if (lifted.has(e.id)) return up && !map.edges.some((x) => x.source === up.source && x.target === e.target) ? [{ ...e, source: up.source }] : [];
    return e.source === id || e.target === id ? [] : [e];
  });
  return { nodes: map.nodes.filter((n) => n.id !== id), edges };
}

/** Takes away `id` and everything below it. */
export function removeBranch(map: Graph, id: string): Graph {
  const gone = branchOf(map, id);
  return {
    nodes: map.nodes.filter((n) => !gone.has(n.id)),
    edges: map.edges.filter((e) => !gone.has(e.source) && !gone.has(e.target)),
  };
}

/** Why `id` cannot go under `parent`, or null if it can. */
export function cannotMoveUnder(map: Graph, id: string, parent: string): 'self' | 'below' | 'already' | null {
  if (id === parent) return 'self';
  if (branchOf(map, id).has(parent)) return 'below';
  if (linkFromParent(map, id)?.source === parent) return 'already';
  return null;
}

/**
 * Moves `id` (with everything below it) under `parent`: the link from its
 * old parent goes to the new one, with its linking words. A direct link
 * between the two that was already there becomes that link.
 */
export function moveUnder(map: Graph, id: string, parent: string): Graph | null {
  if (cannotMoveUnder(map, id, parent)) return null;
  const up = linkFromParent(map, id);
  const direct = map.edges.find((e) => (e.source === parent && e.target === id) || (e.source === id && e.target === parent));
  const kept = map.edges.filter((e) => e.id !== up?.id && e.id !== direct?.id);
  const link: MapEdge = { ...(up ?? direct ?? { id: `${parent}-${id}` }), source: parent, target: id };
  if (direct?.label && !up?.label) link.label = direct.label;
  return { nodes: map.nodes, edges: [...kept, link] };
}
