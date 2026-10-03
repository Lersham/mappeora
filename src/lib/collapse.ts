import type { ConceptMap } from '../types/map';

export interface CollapseInfo {
  /** Nodes hidden because an ancestor is collapsed. */
  hidden: Set<string>;
  /** For each collapsed node, how many concepts it is hiding ("+3"). */
  hiddenBelow: Record<string, number>;
}

type Graph = Pick<ConceptMap, 'nodes' | 'edges'>;

function walk(starts: Iterable<string>, children: Map<string, string[]>, canExpand: (id: string) => boolean): Set<string> {
  const seen = new Set<string>();
  const stack = [...starts];
  while (stack.length) {
    const id = stack.pop()!;
    if (seen.has(id)) continue;
    seen.add(id);
    if (canExpand(id)) stack.push(...(children.get(id) ?? []));
  }
  return seen;
}

/**
 * A concept is hidden when every way to reach it passes through a
 * collapsed concept: something also linked from an open branch stays.
 */
export function collapseInfo(map: Graph): CollapseInfo {
  const collapsed = new Set(map.nodes.filter((n) => n.collapsed).map((n) => n.id));
  if (collapsed.size === 0) return { hidden: new Set(), hiddenBelow: {} };

  const children = new Map<string, string[]>();
  for (const e of map.edges) children.set(e.source, [...(children.get(e.source) ?? []), e.target]);

  // Everything below a collapsed concept (the collapsed ones stay visible)…
  const below = new Set<string>();
  for (const id of collapsed) for (const c of children.get(id) ?? []) below.add(c);
  const underCollapsed = walk(below, children, () => true);
  // …unless it can be reached from the rest without crossing a collapsed one.
  const seeds = map.nodes.map((n) => n.id).filter((id) => !underCollapsed.has(id) || (collapsed.has(id) && !below.has(id)));
  const visible = walk(seeds, children, (id) => !collapsed.has(id));
  const hidden = new Set(map.nodes.map((n) => n.id).filter((id) => !visible.has(id)));

  const hiddenBelow: Record<string, number> = {};
  for (const id of collapsed) {
    if (hidden.has(id)) continue;
    const reach = walk(children.get(id) ?? [], children, () => true);
    hiddenBelow[id] = [...reach].filter((r) => hidden.has(r)).length;
  }
  return { hidden, hiddenBelow };
}

/** The part of the map currently on screen: what gets read and reviewed. */
export function visiblePart<T extends Graph>(map: T): T {
  const { hidden } = collapseInfo(map);
  if (hidden.size === 0) return map;
  return {
    ...map,
    nodes: map.nodes.filter((n) => !hidden.has(n.id)),
    edges: map.edges.filter((e) => !hidden.has(e.source) && !hidden.has(e.target)),
  };
}
