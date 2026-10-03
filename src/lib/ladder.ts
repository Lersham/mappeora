import type { MapEdge, MapNode } from '../types/map';

/**
 * "Scaletta": a vertical tree. Each concept's children hang below it, one
 * under the other and indented to the right, so the map stays narrow and
 * only grows downwards (phone screens, A4 portrait pages).
 *
 *   [ Acqua ]
 *     ├─ è formata da ─▶ [ Idrogeno ]
 *     └──────────────▶ [ Ossigeno ]
 */
export const LADDER = {
  /** Horizontal step between a concept and its children. */
  indent: 56,
  /** Distance of the vertical line from the left edge of the parent. */
  spine: 28,
  /** Vertical space between one concept and the next. */
  gap: 20,
  /** Extra space above a child whose link has words on it. */
  labelSpace: 30,
  /** Extra space between separate trees. */
  rootGap: 40,
};

export const DEFAULT_SIZE = { width: 180, height: 72 };

type Sizes = Record<string, { width: number; height: number } | undefined>;

export interface LadderResult {
  positions: Record<string, { x: number; y: number }>;
  /** Links drawn as the ladder's L-shaped lines (the others are cross-links). */
  treeEdges: Set<string>;
  /** Concepts from top to bottom: the natural reading order. */
  order: string[];
}

/**
 * Children keep the order they have on screen (top to bottom, then left to
 * right): dragging a concept above its sibling moves it up the list.
 */
export function ladderLayout(
  nodes: Pick<MapNode, 'id' | 'position'>[],
  edges: Pick<MapEdge, 'id' | 'source' | 'target' | 'label'>[],
  sizes: Sizes = {},
  origin = { x: 0, y: 0 },
): LadderResult {
  const pos = new Map(nodes.map((n) => [n.id, n.position]));
  const valid = edges.filter((e) => pos.has(e.source) && pos.has(e.target) && e.source !== e.target);
  const byPosition = (a: string, b: string) => pos.get(a)!.y - pos.get(b)!.y || pos.get(a)!.x - pos.get(b)!.x;
  const hasParent = new Set(valid.map((e) => e.target));

  const positions: LadderResult['positions'] = {};
  const treeEdges = new Set<string>();
  const order: string[] = [];
  const visited = new Set<string>();
  let cursor = origin.y;

  const place = (id: string, depth: number) => {
    visited.add(id);
    order.push(id);
    positions[id] = { x: origin.x + depth * LADDER.indent, y: cursor };
    cursor += (sizes[id] ?? DEFAULT_SIZE).height + LADDER.gap;
    const children = valid.filter((e) => e.source === id).sort((a, b) => byPosition(a.target, b.target));
    for (const e of children) {
      if (visited.has(e.target)) continue; // reached earlier: drawn as a cross-link
      treeEdges.add(e.id);
      if (e.label) cursor += LADDER.labelSpace;
      place(e.target, depth + 1);
    }
  };

  const ids = nodes.map((n) => n.id).sort(byPosition);
  const roots = ids.filter((id) => !hasParent.has(id));
  // Roots first; then whatever is only reachable through a cycle.
  for (const id of [...roots, ...ids]) {
    if (visited.has(id)) continue;
    if (order.length > 0) cursor += LADDER.rootGap;
    place(id, 0);
  }
  return { positions, treeEdges, order };
}
