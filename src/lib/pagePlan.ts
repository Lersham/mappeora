export type Paper = 'a4' | 'a3';
export type PageCount = 1 | 2 | 4;
export type Orientation = 'portrait' | 'landscape';

export interface Tile {
  /** Area of the rendered map, in CSS pixels. */
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface PagePlan {
  orientation: Orientation;
  /** Millimetres on paper per CSS pixel of the map. */
  scale: number;
  tiles: Tile[];
}

const PAPER_MM: Record<Paper, { w: number; h: number }> = { a4: { w: 210, h: 297 }, a3: { w: 297, h: 420 } };

/** Neighbouring sheets repeat a strip of the map so no word is cut in half. */
const OVERLAP = 0.05;
/** Never blow a small map up beyond this (≈ 18 pt for an 18 px label). */
const MAX_SCALE = 0.35;

const GRIDS: Record<PageCount, [cols: number, rows: number][]> = {
  1: [[1, 1]],
  2: [[2, 1], [1, 2]],
  4: [[2, 2], [4, 1], [1, 4]],
};

function tiles(size: number, count: number): { start: number; length: number }[] {
  const step = size / count;
  const overlap = count > 1 ? step * OVERLAP : 0;
  return Array.from({ length: count }, (_, i) => {
    const start = Math.max(0, i * step - overlap);
    const end = Math.min(size, (i + 1) * step + overlap);
    return { start, length: end - start };
  });
}

/**
 * Chooses the grid (e.g. 2×1 vs 1×2) and the orientation that print the
 * map largest on the given number of sheets.
 */
export function planPages(
  width: number,
  height: number,
  paper: Paper,
  pages: PageCount,
  layout: { margin: number; header: number; footer: number },
): PagePlan {
  let best: PagePlan | null = null;
  for (const orientation of ['landscape', 'portrait'] as const) {
    const { w, h } = PAPER_MM[paper];
    const pageW = orientation === 'landscape' ? h : w;
    const pageH = orientation === 'landscape' ? w : h;
    const boxW = pageW - layout.margin * 2;
    const boxH = pageH - layout.margin * 2 - layout.header - layout.footer;
    for (const [cols, rows] of GRIDS[pages]) {
      const xs = tiles(width, cols);
      const ys = tiles(height, rows);
      const tileW = Math.max(...xs.map((t) => t.length));
      const tileH = Math.max(...ys.map((t) => t.length));
      const scale = Math.min(boxW / tileW, boxH / tileH, MAX_SCALE);
      if (!best || scale > best.scale + 1e-9) {
        best = {
          orientation,
          scale,
          tiles: ys.flatMap((y) => xs.map((x) => ({ x: x.start, y: y.start, w: x.length, h: y.length }))),
        };
      }
    }
  }
  return best!;
}
