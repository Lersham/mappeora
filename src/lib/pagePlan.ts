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
  /** Portrait, unless the map is wide enough to print larger on its side. */
  orientation: 'portrait' | 'landscape';
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
 * Plans sheets for a map of `width` × `height` CSS pixels. Sheets taped
 * together make one poster: one above the other, side by side, or (on 4)
 * a 2×2 grid. A tall, narrow map (a "scaletta") may instead be cut
 * into strips laid out in 2 or 3 columns per sheet, like a newspaper.
 * Whichever prints the map largest; sheets are portrait unless landscape
 * prints it larger. `breaks` are heights where a strip's cut doesn't split
 * a concept.
 */
export function planPages(
  width: number,
  height: number,
  paper: Paper,
  pages: PageCount,
  layout: { margin: number; header: number; footer: number },
  breaks: number[] = [],
): PagePlan {
  let best: PagePlan | null = null;
  // As large as it gets; at the same size (a small map), the one leaving no sheet empty.
  const filled = (plan: PagePlan) => new Set(plan.tiles.map((t) => t.page)).size;
  const consider = (plan: PagePlan) => {
    if (!best || plan.scale > best.scale + 1e-9 || (plan.scale > best.scale - 1e-9 && filled(plan) > filled(best))) best = plan;
  };
  for (const orientation of ['portrait', 'landscape'] as const) {
    const { w, h } = PAPER_MM[paper];
    const [pageW, pageH] = orientation === 'portrait' ? [w, h] : [h, w];
    const boxW = pageW - layout.margin * 2;
    const boxH = pageH - layout.margin * 2 - layout.header - layout.footer;

    // A poster: the map, centred across the sheets put together, cut where
    // one sheet's box ends. Each piece reaches the edge it is taped along,
    // and goes on from the same place on the next sheet: nothing is
    // repeated or shifted.
    const poster = (cols: number, rows: number) => {
      const scale = Math.min((cols * boxW) / width, (rows * boxH) / height, MAX_SCALE);
      const left = (cols * boxW - width * scale) / 2;
      const tiles: PlacedTile[] = [];
      for (let row = 0; row < rows; row++)
        for (let col = 0; col < cols; col++) {
          const x0 = Math.max(col * boxW, left);
          const x1 = Math.min((col + 1) * boxW, left + width * scale);
          const y0 = row * boxH;
          const y1 = Math.min((row + 1) * boxH, height * scale);
          if (x1 - x0 < 1e-6 || y1 - y0 < 1e-6) continue; // nothing left for this sheet
          tiles.push({ x: (x0 - left) / scale, y: y0 / scale, w: (x1 - x0) / scale, h: (y1 - y0) / scale, page: row * cols + col, dx: x0 - col * boxW, dy: 0 });
        }
      consider({ orientation, scale, pageCount: pages, tiles });
    };
    poster(1, pages);
    poster(pages, 1);
    if (pages === 4) poster(2, 2);

    // Columns: strips of the whole width, `perPage` side by side on each sheet.
    for (const perPage of [2, 3]) {
      const strips = cut(height, pages * perPage, breaks);
      const tallest = Math.max(...strips.map((s) => s.length));
      const scale = Math.min((boxW - (perPage - 1) * COLUMN_GAP) / (perPage * width), boxH / tallest, MAX_SCALE);
      const groupW = perPage * width * scale + (perPage - 1) * COLUMN_GAP;
      consider({
        orientation,
        scale,
        pageCount: pages,
        tiles: strips.map((s, i) => ({
          x: 0,
          y: s.start,
          w: width,
          h: s.length,
          page: Math.floor(i / perPage),
          dx: (boxW - groupW) / 2 + (i % perPage) * (width * scale + COLUMN_GAP),
          dy: 0,
        })),
      });
    }
  }
  return best!;
}
