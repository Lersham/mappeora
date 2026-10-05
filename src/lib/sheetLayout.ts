import type { MapEdge, MapNode } from '../types/map';
import { DEFAULT_SIZE, LABEL_OFFSET, LADDER, labelWidth, layoutTree } from './ladder';

/**
 * "Foglio A4": the main concept on top, its branches side by side below it,
 * and each branch's concepts listed under the branch (a small "scaletta").
 * Branches are arranged in the number of columns that fills a portrait A4
 * sheet best (a short branch can sit under another one), so the map prints
 * large.
 *
 *            [ Rivoluzione francese ]
 *     ┌──────────────┬───────┴──────┐
 *  [Cause]        [1789]         [Fasi]
 *   ├─ [Debiti]    ├─ [Bastiglia]  ├─ …
 *   └─ [Pane]      └─ …
 *     ┌──────────────┐
 *  [Conseguenze]  [Protagonisti]
 */

/** Printable box of a portrait A4 sheet, in mm: only the ratio matters. */
const SHEET = { width: 186, height: 257 };
const COLUMN_GAP = 48;
/** Space between two branches in the same column. */
const ROW_GAP = 28;
/** From the main concept to the line that feeds the first row. */
const ROOT_GAP = 20;
/** Space above a row of branches: the feeding line, then linking words. */
const BAND = 44;

type Sizes = Record<string, { width: number; height: number } | undefined>;
type Point = { x: number; y: number };

export type NodeRole = 'root' | 'head' | 'item';

export interface SheetResult {
  positions: Record<string, Point>;
  roles: Record<string, NodeRole>;
  /** Tree links: "bus" from the main concept to a branch, "ladder" inside a branch. */
  edges: Record<string, { kind: 'bus'; points: Point[] } | { kind: 'ladder' }>;
  /** Columns per row chosen for the branches. */
  columns: number;
}

type GraphEdge = Pick<MapEdge, 'id' | 'source' | 'target' | 'label'>;

interface Block {
  head: string;
  via?: GraphEdge;
  rel: Record<string, Point>;
  width: number;
  height: number;
}

export function sheetLayout(
  nodes: Pick<MapNode, 'id' | 'position'>[],
  edges: GraphEdge[],
  sizes: Sizes = {},
  origin: Point = { x: 0, y: 0 },
  /** From labelScale(): linking words need more room at a larger text size. */
  scale = 1,
): SheetResult {
  const labelSpace = LADDER.labelSpace * scale;
  const size = (id: string) => sizes[id] ?? DEFAULT_SIZE;
  const result: SheetResult = { positions: {}, roles: {}, edges: {}, columns: 1 };
  if (nodes.length === 0) return result;
  const { kids, tops } = layoutTree(nodes, edges);
  const [root, ...extraTops] = tops;

  // Each branch is a small "scaletta", laid out on its own.
  const makeBlock = (head: string, via?: GraphEdge): Block => {
    const rel: Record<string, Point> = {};
    let cursor = 0;
    let width = 0;
    const place = (id: string, depth: number) => {
      rel[id] = { x: depth * LADDER.indent, y: cursor };
      width = Math.max(width, depth * LADDER.indent + size(id).width);
      cursor += size(id).height + LADDER.gap;
      for (const e of kids.get(id) ?? []) {
        result.edges[e.id] = { kind: 'ladder' };
        if (e.label) {
          cursor += labelSpace;
          width = Math.max(width, depth * LADDER.indent + LABEL_OFFSET + labelWidth(e.label, scale));
        }
        place(e.target, depth + 1);
      }
    };
    place(head, 0);
    return { head, via, rel, width, height: cursor - LADDER.gap };
  };
  const blocks = [...(kids.get(root) ?? []).map((e) => makeBlock(e.target, e)), ...extraTops.map((t) => makeBlock(t))];

  const rootSize = size(root);
  result.positions[root] = { ...origin };
  result.roles[root] = 'root';
  if (blocks.length === 0) return result;

  // Branches go into columns like a masonry wall: the first ones side by
  // side on top, each next one under the shortest column. Every number of
  // columns is tried; the one that prints largest on an A4 sheet wins.
  // Every row leaves room for linking words if any branch has them: a branch
  // lower than the others would come later in the order the next time.
  const band = BAND + (blocks.some((b) => b.via?.label) ? labelSpace : 0);
  const measure = (cols: number) => {
    const bottom = Array<number>(cols).fill(0);
    const colW = Array<number>(cols).fill(0);
    const placed = blocks.map((block, i) => {
      const col = i < cols ? i : bottom.indexOf(Math.min(...bottom));
      const first = i < cols;
      const lineY = first ? 14 : bottom[col] + ROW_GAP + 14;
      const top = first ? band : bottom[col] + ROW_GAP + band;
      bottom[col] = top + block.height;
      colW[col] = Math.max(colW[col], block.width);
      return { block, col, top, lineY, first };
    });
    const gridW = colW.reduce((a, w) => a + w, 0) + COLUMN_GAP * (cols - 1);
    const width = Math.max(gridW, rootSize.width);
    const height = rootSize.height + ROOT_GAP + Math.max(...bottom);
    return { cols, colW, gridW, placed, fit: Math.min(SHEET.width / width, SHEET.height / height) };
  };
  let best = measure(1);
  for (let cols = 2; cols <= blocks.length; cols++) {
    const m = measure(cols);
    if (m.fit > best.fit + 1e-12) best = m;
  }
  result.columns = best.cols;

  const gridTop = origin.y + rootSize.height + ROOT_GAP;
  const rootCentre = origin.x + rootSize.width / 2;
  const gridLeft = rootCentre - best.gridW / 2;
  const colX = best.colW.map((_, j) => gridLeft + best.colW.slice(0, j).reduce((a, w) => a + w + COLUMN_GAP, 0));
  const topLine = gridTop + 14;

  for (const { block, col, top, lineY, first } of best.placed) {
    const left = colX[col];
    for (const [id, p] of Object.entries(block.rel)) {
      result.positions[id] = { x: left + p.x, y: gridTop + top + p.y };
      result.roles[id] = id === block.head ? 'head' : 'item';
    }
    if (!block.via) continue;
    // Feeding line: along the top of the grid; for a branch lower in a
    // column, down the gap at the column's left, then into the branch.
    const headCentre = left + size(block.head).width / 2;
    const points: Point[] = [{ x: rootCentre, y: topLine }];
    if (!first) {
      const channel = left - COLUMN_GAP / 2;
      points.push({ x: channel, y: topLine }, { x: channel, y: gridTop + lineY });
    }
    points.push({ x: headCentre, y: first ? topLine : gridTop + lineY });
    result.edges[block.via.id] = { kind: 'bus', points };
  }
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
