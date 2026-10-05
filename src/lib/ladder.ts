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

/**
 * Rough width of linking words drawn on a ladder line (they are not
 * measured): enough to keep long ones from running into the next column.
 */
export const labelWidth = (text: string, scale = 1) => (16 + 10 * [...text].length) * scale;
/**
 * Linking words grow with the reading text size: how much bigger they are
 * than at the default size, which the numbers above are made for.
 */
export const labelScale = (textScale: number) => Math.max(1, textScale / 1.15);
/** Where linking words start, from the left side of the child's parent. */
export const LABEL_OFFSET = LADDER.spine + 10;

type Sizes = Record<string, { width: number; height: number } | undefined>;

export interface LadderResult {
  positions: Record<string, { x: number; y: number }>;
  /** Links drawn as the ladder's L-shaped lines (the others are cross-links). */
  treeEdges: Set<string>;
  /** Concepts from top to bottom: the natural reading order. */
  order: string[];
}

type TreeEdge = Pick<MapEdge, 'id' | 'source' | 'target' | 'label'>;

/**
 * Concepts this close to the highest of their siblings are in the same row
 * (branches side by side): a few pixels up or down never beat a long move
 * sideways. Less than any row of the sheet is from the next one.
 */
const ROW_TOLERANCE = DEFAULT_SIZE.height / 2;

/**
 * Siblings in the order they have on screen: top to bottom, and left to
 * right in the top row. Dragging a concept above, or beside, another one
 * moves it in the list.
 */
function bySight<T>(items: T[], at: (item: T) => { x: number; y: number }): T[] {
  const sorted = [...items].sort((a, b) => at(a).y - at(b).y || at(a).x - at(b).x);
  if (sorted.length === 0) return sorted;
  const top = at(sorted[0]).y;
  const row = sorted.filter((i) => at(i).y - top < ROW_TOLERANCE).sort((a, b) => at(a).x - at(b).x);
  return [...row, ...sorted.slice(row.length)];
}

export interface Tree<E extends TreeEdge> {
  /** Each concept's tree links, in on-screen order. */
  kids: Map<string, E[]>;
  /** The main concept first, then the top of each separate tree. */
  tops: string[];
}

/**
 * The map as a tree. A concept hangs from its oldest link: a link drawn
 * later, from another branch, is a cross-link and never moves it out of its
 * branch. Only a concept in a loop takes the first link that reaches it.
 */
export function layoutTree<E extends TreeEdge>(nodes: Pick<MapNode, 'id' | 'position'>[], edges: E[]): Tree<E> {
  const pos = new Map(nodes.map((n) => [n.id, n.position]));
  const valid = edges.filter((e) => pos.has(e.source) && pos.has(e.target) && e.source !== e.target);
  const parentLink = new Map<string, E>();
  for (const e of valid) if (!parentLink.has(e.target)) parentLink.set(e.target, e);
  const out = new Map<string, E[]>();
  for (const e of valid) {
    if (!out.has(e.source)) out.set(e.source, []);
    out.get(e.source)!.push(e);
  }

  const kids = new Map<string, E[]>();
  const visited = new Set<string>();
  const grow = (id: string) => {
    visited.add(id);
    kids.set(id, kids.get(id) ?? []);
    for (const e of out.get(id) ?? []) {
      if (parentLink.get(e.target) !== e || visited.has(e.target)) continue;
      kids.get(id)!.push(e);
      grow(e.target);
    }
  };
  const ids = bySight(nodes, (n) => n.position).map((n) => n.id);
  const seeds = [...ids.filter((id) => !parentLink.has(id)), ...ids];
  const tops: string[] = [];
  for (;;) {
    const adopted = valid.find((e) => visited.has(e.source) && !visited.has(e.target));
    if (adopted) {
      kids.get(adopted.source)!.push(adopted);
      grow(adopted.target);
      continue;
    }
    const next = seeds.find((id) => !visited.has(id));
    if (next === undefined) break;
    tops.push(next);
    grow(next);
  }
  for (const [id, list] of kids) kids.set(id, bySight(list, (e) => pos.get(e.target)!));
  return { kids, tops };
}

export function ladderLayout(
  nodes: Pick<MapNode, 'id' | 'position'>[],
  edges: TreeEdge[],
  sizes: Sizes = {},
  origin = { x: 0, y: 0 },
): LadderResult {
  const { kids, tops } = layoutTree(nodes, edges);
  const positions: LadderResult['positions'] = {};
  const treeEdges = new Set<string>();
  const order: string[] = [];
  let cursor = origin.y;

  const place = (id: string, depth: number) => {
    order.push(id);
    positions[id] = { x: origin.x + depth * LADDER.indent, y: cursor };
    cursor += (sizes[id] ?? DEFAULT_SIZE).height + LADDER.gap;
    for (const e of kids.get(id) ?? []) {
      treeEdges.add(e.id);
      if (e.label) cursor += LADDER.labelSpace;
      place(e.target, depth + 1);
    }
  };
  for (const id of tops) {
    if (order.length > 0) cursor += LADDER.rootGap;
    place(id, 0);
  }
  return { positions, treeEdges, order };
}
