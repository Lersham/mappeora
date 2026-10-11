import type { MapEdge, MapNode } from '../types/map';
import { DEFAULT_SIZE, LADDER, labelWidth, layoutTree } from './ladder';

/**
 * "Foglio": an organisation chart, at every level. Under each concept its
 * concepts side by side in a row, the concept over the row's middle. A list
 * of concepts with none of their own that would make the row too wide goes
 * down in a column instead, centred under its concept; so does a single
 * concept. The main concept's branches are always in a row.
 *
 *                     [ Illuminismo ]
 *       ┌──────────────────────┼───────────────────────┐
 *   [Nasce]              [I filosofi]              [Influenza]
 *      │            ┌──────────┼──────────┐            │
 *   [1770]     [Montesq.]  [Voltaire]  [Rousseau]   [Smith]
 *      │        ┌───┼───┐      │                       │
 *  [Ragione]   [L] [E] [G]  [ma doveva]              [ … ]
 */

/** Space between two concepts side by side. */
const SIDE_GAP = 40;
/** From a concept to the space above the row under it: none, the line leaves from its edge. */
const ROW_LINE_GAP = 0;
/** Space above a row: the feeding line halfway, then linking words. */
const BAND = 24;
/** Where the feeding line runs, below the top of the band. */
const LINE_DROP = 12;
/** Space between a concept and the next one down a column: just the line. */
const COLUMN_GAP = 16;
/** A list of concepts with none of their own stays in a row up to about three short ones. */
const ROW_MAX = 3 * 160 + 2 * SIDE_GAP;

type Sizes = Record<string, { width: number; height: number } | undefined>;
type Point = { x: number; y: number };

/** The main concept; a concept with concepts under it (shown or closed); one without. */
export type NodeRole = 'root' | 'hub' | 'item';

export interface SheetResult {
  positions: Record<string, Point>;
  roles: Record<string, NodeRole>;
  /**
   * Tree links. In a row the line leaves from under the concept, runs along
   * the top of the row (shared with the others) and drops into each concept:
   * its own stretch starts at `points[own]`. In a column (`column`) it starts
   * at `points[0]`, just under the concept above, and goes straight down.
   * `branch` numbers the main concept's branches, so each has its own colour.
   */
  edges: Record<string, { points: Point[]; branch: number; own: number; column?: boolean }>;
  /** The first concept of each of the main concept's branches, with the branch's number. */
  heads: Record<string, number>;
}

type GraphEdge = Pick<MapEdge, 'id' | 'source' | 'target' | 'label'>;

interface Shape {
  width: number;
  height: number;
  /** Centre of the concept itself, from the left of its part of the sheet. */
  centre: number;
  /** Centre of each concept under it, from the left of its part. */
  under: number[];
  column: boolean;
}

export function sheetLayout(
  nodes: Pick<MapNode, 'id' | 'position' | 'collapsed'>[],
  edges: GraphEdge[],
  sizes: Sizes = {},
  origin: Point = { x: 0, y: 0 },
  /** From labelScale(): linking words need more room at a larger text size. */
  scale = 1,
): SheetResult {
  const labelSpace = LADDER.labelSpace * scale;
  const size = (id: string) => sizes[id] ?? DEFAULT_SIZE;
  const result: SheetResult = { positions: {}, roles: {}, edges: {}, heads: {} };
  if (nodes.length === 0) return result;
  const { kids, tops } = layoutTree(nodes, edges);
  const [root, ...extraTops] = tops;
  const collapsed = new Set(nodes.filter((n) => n.collapsed).map((n) => n.id));
  // A collapsed concept still counts as having concepts: closing it doesn't reshuffle its row.
  const branches = (id: string) => (kids.get(id)?.length ?? 0) > 0 || collapsed.has(id);
  type Kid = { id: string; via?: GraphEdge };
  // The concepts under `id` (the main concept's include separate trees, without a line).
  const under = (id: string): Kid[] => {
    const list: Kid[] = (kids.get(id) ?? []).map((e) => ({ id: e.target, via: e }));
    return id === root ? [...list, ...extraTops.map((t) => ({ id: t }))] : list;
  };
  const band = (list: Kid[]) => BAND + (list.some((k) => k.via?.label) ? labelSpace : 0);
  const gap = (k: Kid) => COLUMN_GAP + (k.via?.label ? labelSpace : 0);

  // First how much room each part of the map takes, from the bottom up…
  const shapes = new Map<string, Shape>();
  const measure = (id: string): Shape => {
    const own = size(id);
    const list = under(id);
    if (list.length === 0) {
      const leaf = { width: own.width, height: own.height, centre: own.width / 2, under: [], column: false };
      shapes.set(id, leaf);
      return leaf;
    }
    const parts = list.map((k) => measure(k.id));
    // Linking words sit over the concept's middle and can be wider than its part.
    const reach = list.map((k, i) => {
      const half = k.via?.label ? labelWidth(k.via.label, scale) / 2 : 0;
      return { left: Math.max(parts[i].centre, half), right: Math.max(parts[i].width - parts[i].centre, half) };
    });
    const rowWidth = reach.reduce((w, r) => w + r.left + r.right, 0) + SIDE_GAP * (list.length - 1);
    const column = id !== root && (list.length === 1 || (!list.some((k) => branches(k.id)) && rowWidth > ROW_MAX * scale));
    let shape: Shape;
    if (column) {
      const left = Math.max(own.width / 2, ...reach.map((r) => r.left));
      const right = Math.max(own.width / 2, ...reach.map((r) => r.right));
      const height = list.reduce((h, k, i) => h + gap(k) + parts[i].height, own.height);
      shape = { width: left + right, height, centre: left, under: list.map(() => left), column };
    } else {
      const centres: number[] = [];
      let x = 0;
      for (const r of reach) {
        centres.push(x + r.left);
        x += r.left + r.right + SIDE_GAP;
      }
      // The concept over the middle of its row's concepts (not of what is under them).
      const middle = (centres[0] + centres[centres.length - 1]) / 2;
      const start = Math.min(0, middle - own.width / 2);
      shape = {
        width: Math.max(rowWidth, middle + own.width / 2) - start,
        height: own.height + ROW_LINE_GAP + band(list) + Math.max(...parts.map((p) => p.height)),
        centre: middle - start,
        under: centres.map((c) => c - start),
        column,
      };
    }
    shapes.set(id, shape);
    return shape;
  };

  // …then where each concept goes, from the top down.
  const place = (id: string, left: number, top: number, branch: number) => {
    const shape = shapes.get(id)!;
    const own = size(id);
    const centre = left + shape.centre;
    result.positions[id] = { x: centre - own.width / 2, y: top };
    result.roles[id] = id === root ? 'root' : branches(id) ? 'hub' : 'item';
    const list = under(id);
    if (shape.column) {
      let y = top + own.height;
      list.forEach((k, i) => {
        const part = shapes.get(k.id)!;
        if (k.via) result.edges[k.via.id] = { points: [{ x: centre, y }], branch, own: 0, column: true };
        y += gap(k);
        place(k.id, left + shape.under[i] - part.centre, y, branch);
        y += part.height;
      });
      return;
    }
    const line = top + own.height + ROW_LINE_GAP + LINE_DROP;
    const rowTop = top + own.height + ROW_LINE_GAP + band(list);
    list.forEach((k, i) => {
      const part = shapes.get(k.id)!;
      const b = id === root ? i : branch;
      if (id === root && k.via) result.heads[k.id] = b;
      const x = left + shape.under[i];
      place(k.id, x - part.centre, rowTop, b);
      // Along the row the line is shared; from where it turns towards this concept it is its own.
      if (k.via) result.edges[k.via.id] = { points: [{ x: centre, y: line }, { x, y: line }], branch: b, own: 1 };
    });
  };

  // The main concept stays where it is: the map hangs from it.
  const top = measure(root);
  place(root, origin.x + size(root).width / 2 - top.centre, origin.y, 0);
  return result;
}

/** SVG path through the points, with rounded corners. */
export function roundedPath(points: Point[], radius = 10): string {
  // Drop repeated points and straight-line middles: they break the corners.
  const pts = points.filter((p, i) => i === 0 || p.x !== points[i - 1].x || p.y !== points[i - 1].y);
  let d = `M ${pts[0].x},${pts[0].y}`;
  for (let i = 1; i < pts.length - 1; i++) {
    const [a, b, c] = [pts[i - 1], pts[i], pts[i + 1]];
    const r = Math.min(radius, Math.hypot(b.x - a.x, b.y - a.y) / 2, Math.hypot(c.x - b.x, c.y - b.y) / 2);
    const inX = b.x - Math.sign(b.x - a.x) * r;
    const inY = b.y - Math.sign(b.y - a.y) * r;
    const outX = b.x + Math.sign(c.x - b.x) * r;
    const outY = b.y + Math.sign(c.y - b.y) * r;
    d += ` L ${inX},${inY} Q ${b.x},${b.y} ${outX},${outY}`;
  }
  const last = pts[pts.length - 1];
  return `${d} L ${last.x},${last.y}`;
}
