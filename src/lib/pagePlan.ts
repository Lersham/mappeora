export type Paper = 'a4' | 'a3';
export type PageCount = 1 | 2 | 4;

export interface Tile {
  /** Area of the rendered map, in CSS pixels. */
  x: number;
  y: number;
  w: number;
  h: number;
}

/** A piece of the map placed on a sheet. */
export interface PlacedTile extends Tile {
  page: number;
  /** Position inside the printable box of the sheet, in millimetres. */
  dx: number;
  dy: number;
}

export interface PagePlan {
  /** Sheets are always portrait: maps grow downwards. */
  orientation: 'portrait';
  /** Millimetres on paper per CSS pixel of the map. */
  scale: number;
  pageCount: number;
  tiles: PlacedTile[];
}

const PAPER_MM: Record<Paper, { w: number; h: number }> = { a4: { w: 210, h: 297 }, a3: { w: 297, h: 420 } };

/** Repeated strip where a cut can't fall between two concepts. */
const OVERLAP = 0.05;
/** Never blow a small map up beyond this (≈ 18 pt for an 18 px label). */
const MAX_SCALE = 0.35;
/** Space between two columns on the same sheet, in millimetres. */
const COLUMN_GAP = 6;

interface Range {
  start: number;
  length: number;
}

/**
 * Cuts [0, size] into `count` pieces of about the same length. Each cut is
 * moved to the nearest safe place (`breaks`, e.g. between two concepts);
 * where there is none, neighbouring pieces overlap so no word is lost.
 */
function cut(size: number, count: number, breaks: number[] = []): Range[] {
  const step = size / count;
  const bounds = [{ at: 0, safe: true }];
  for (let i = 1; i < count; i++) {
    const ideal = i * step;
    const prev = bounds[bounds.length - 1].at;
    const near = breaks
      .filter((b) => b > prev + step * 0.4 && Math.abs(b - ideal) <= step * 0.35)
      .sort((a, b) => Math.abs(a - ideal) - Math.abs(b - ideal))[0];
    bounds.push(near === undefined ? { at: ideal, safe: false } : { at: near, safe: true });
  }
  bounds.push({ at: size, safe: true });
  const overlap = step * OVERLAP;
  return bounds.slice(0, -1).map((b, i) => {
    const next = bounds[i + 1];
    const start = Math.max(0, b.at - (b.safe ? 0 : overlap));
    const end = Math.min(size, next.at + (next.safe ? 0 : overlap));
    return { start, length: end - start };
  });
}

/**
 * Plans portrait sheets for a map of `width` × `height` CSS pixels. Tall
 * maps (a "scaletta") are cut into strips laid out in columns, like a
 * newspaper: 1 to 3 columns per sheet, whichever prints the map largest.
 * A wide map may instead be cut down the middle too: 2 sheets side by
 * side, or a 2×2 grid on 4.
 * `breaks` are heights where a cut doesn't split a concept.
 */
export function planPages(
  width: number,
  height: number,
  paper: Paper,
  pages: PageCount,
  layout: { margin: number; header: number; footer: number },
  breaks: number[] = [],
): PagePlan {
  const { w: pageW, h: pageH } = PAPER_MM[paper];
  const boxW = pageW - layout.margin * 2;
  const boxH = pageH - layout.margin * 2 - layout.header - layout.footer;
  let best: PagePlan | null = null;
  const consider = (plan: PagePlan) => {
    if (!best || plan.scale > best.scale + 1e-9) best = plan;
  };

  // Columns: strips of the whole width, `perPage` side by side on each sheet.
  for (const perPage of [1, 2, 3]) {
    const strips = cut(height, pages * perPage, breaks);
    const tallest = Math.max(...strips.map((s) => s.length));
    const scale = Math.min((boxW - (perPage - 1) * COLUMN_GAP) / (perPage * width), boxH / tallest, MAX_SCALE);
    const groupW = perPage * width * scale + (perPage - 1) * COLUMN_GAP;
    consider({
      orientation: 'portrait',
      scale,
      pageCount: pages,
      tiles: strips.map((s, i) => ({
        x: 0,
        y: s.start,
        w: width,
        h: s.length,
        page: Math.floor(i / perPage),
        dx: (boxW - groupW) / 2 + (i % perPage) * (width * scale + COLUMN_GAP),
        dy: 0, // top-aligned: pieces line up when the sheets are joined
      })),
    });
  }

  // A wide map: cut in two side by side too (2 sheets next to each
  // other, or a 2×2 poster on 4).
  if (pages % 2 === 0) {
    const xs = cut(width, 2);
    const ys = cut(height, pages / 2, breaks);
    const scale = Math.min(boxW / Math.max(...xs.map((r) => r.length)), boxH / Math.max(...ys.map((r) => r.length)), MAX_SCALE);
    consider({
      orientation: 'portrait',
      scale,
      pageCount: pages,
      tiles: ys.flatMap((y, row) =>
        xs.map((x, col) => ({
          x: x.start,
          y: y.start,
          w: x.length,
          h: y.length,
          page: row * 2 + col,
          dx: (boxW - x.length * scale) / 2,
          dy: 0,
        })),
      ),
    });
  }
  return best!;
}
