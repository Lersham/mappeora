export type Paper = 'a4' | 'a3';
export type PageCount = 1 | 2 | 4;

export interface Tile {
  /** Area of the rendered map, in CSS pixels. */
  x: number;
  y: number;
  w: number;
  h: number;
}

/**
 * A cut across the map that steps around concepts instead of splitting them.
 * From `from` to `to` along the line, it runs at `at`: for a cut between two
 * sheets side by side the steps go down the map and `at` is an x; for one
 * between a sheet and the one below, they go across and `at` is a y.
 */
export type Cut = { from: number; to: number; at: number }[];

/** A piece of the map placed on a sheet. */
export interface PlacedTile extends Tile {
  page: number;
  /** Position inside the printable box of the sheet, in millimetres. */
  dx: number;
  dy: number;
  /** Where the piece is cut from its neighbours; inside `x, y, w, h`, the rest belongs to them. */
  cuts?: { left?: Cut; right?: Cut; top?: Cut; bottom?: Cut };
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
/** Room left around a concept by a cut stepping round it, in CSS pixels. */
const CUT_ROOM = 6;

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
 * A cut across a map of `size` (along the cut: `length`) as near to `ideal`
 * as the concepts allow. Concepts beside each other along the line (a row
 * of them, for a cut going down) are passed in one straight stretch, through
 * the gap nearest to `ideal`; between such rows the cut steps aside.
 */
export function stepCut(boxes: Tile[], vertical: boolean, size: number, length: number, ideal: number): Cut {
  const spans = boxes
    .map((b) => (vertical ? { from: b.y, to: b.y + b.h, lo: b.x, hi: b.x + b.w } : { from: b.x, to: b.x + b.w, lo: b.y, hi: b.y + b.h }))
    .map((s) => ({ from: s.from - CUT_ROOM, to: s.to + CUT_ROOM, lo: s.lo - CUT_ROOM, hi: s.hi + CUT_ROOM }))
    .sort((a, b) => a.from - b.from);
  // Rows: spans overlapping along the line, which one straight stretch must pass.
  const rows: { from: number; to: number; taken: { lo: number; hi: number }[] }[] = [];
  for (const s of spans) {
    const row = rows[rows.length - 1];
    if (row && s.from < row.to) {
      row.to = Math.max(row.to, s.to);
      row.taken.push(s);
    } else rows.push({ from: s.from, to: s.to, taken: [s] });
  }
  const cut: Cut = [];
  for (const row of rows) {
    const inside = (at: number) => row.taken.some((t) => at > t.lo && at < t.hi);
    // The nearest place clear of every concept in the row, not on the map's edge.
    const at = inside(ideal)
      ? (row.taken
          .flatMap((t) => [t.lo, t.hi])
          .filter((a) => a > 0 && a < size && !inside(a))
          .sort((a, b) => Math.abs(a - ideal) - Math.abs(b - ideal))[0] ?? ideal)
      : ideal;
    const last = cut[cut.length - 1];
    if (last && last.at === at) last.to = row.to;
    else cut.push({ from: last ? row.from : 0, to: row.to, at });
  }
  if (!cut.length) return [{ from: 0, to: length, at: ideal }];
  // Between rows the cut keeps its place until the next one: fewer steps.
  for (let i = 1; i < cut.length; i++) cut[i - 1].to = cut[i].from;
  cut[0].from = 0;
  cut[cut.length - 1].to = length;
  return cut;
}

const lowest = (cut: Cut) => Math.min(...cut.map((s) => s.at));
const highest = (cut: Cut) => Math.max(...cut.map((s) => s.at));

/**
 * Cuts a map of `size` into `count` pieces, stepping round the concepts,
 * placed so that the longest piece is as short as it gets.
 */
function stepCuts(boxes: Tile[], vertical: boolean, size: number, length: number, count: number): Cut[] {
  const cuts = Array.from({ length: count - 1 }, (_, i) => stepCut(boxes, vertical, size, length, ((i + 1) * size) / count));
  const longest = (all: Cut[]) => Math.max(...all.map((c, i) => highest(c) - (i ? lowest(all[i - 1]) : 0)), size - (all.length ? lowest(all[all.length - 1]) : 0));
  for (let pass = 0; pass < 2; pass++)
    for (let i = 0; i < cuts.length; i++) {
      const step = size / count;
      for (let k = -10; k <= 10; k++) {
        const tried = [...cuts];
        tried[i] = stepCut(boxes, vertical, size, length, (i + 1) * step + (k / 20) * step);
        if (longest(tried) < longest(cuts) - 1e-9) cuts[i] = tried[i];
      }
    }
  return cuts;
}

/**
 * Plans sheets for a map of `width` × `height` CSS pixels. Sheets taped
 * together make one poster: one above the other, side by side, or (on 4)
 * a 2×2 grid. A tall, narrow map (a "scaletta") may instead be cut
 * into strips laid out in 2 or 3 columns per sheet, like a newspaper.
 * Whichever prints the map largest; sheets are portrait unless landscape
 * prints it larger. `breaks` are heights where a strip's cut doesn't split
 * a concept; `boxes` (concepts, linking words) are what a poster's cuts step
 * round.
 */
export function planPages(
  width: number,
  height: number,
  paper: Paper,
  pages: PageCount,
  layout: { margin: number; header: number; footer: number },
  breaks: number[] = [],
  boxes: Tile[] = [],
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

    // A poster: the map cut into `cols` × `rows` pieces, round the concepts.
    // Each piece touches the edge of the sheet where it is taped to the next
    // one, so the pieces fit together once the white margin is cut away
    // along the grey line.
    const poster = (cols: number, rows: number) => {
      const across = stepCuts(boxes, true, width, height, cols);
      const down = stepCuts(boxes, false, height, width, rows);
      // Piece i of n spans from the lowest point of the cut before it to the highest of the one after.
      const span = (cuts: Cut[], size: number, i: number) => {
        const start = i ? lowest(cuts[i - 1]) : 0;
        return { start, length: (i < cuts.length ? highest(cuts[i]) : size) - start };
      };
      const colSpans = Array.from({ length: cols }, (_, i) => span(across, width, i));
      const rowSpans = Array.from({ length: rows }, (_, i) => span(down, height, i));
      const scale = Math.min(
        ...colSpans.map((c) => boxW / c.length),
        ...rowSpans.map((r) => boxH / r.length),
        MAX_SCALE,
      );
      // Against the neighbour: right-aligned with one on the right, left with one on the left.
      const place = (i: number, n: number, room: number, centreAlone: boolean) =>
        n === 1 ? (centreAlone ? room / 2 : 0) : i === 0 ? room : i === n - 1 ? 0 : room / 2;
      const tiles: PlacedTile[] = [];
      for (let row = 0; row < rows; row++)
        for (let col = 0; col < cols; col++) {
          const c = colSpans[col];
          const r = rowSpans[row];
          tiles.push({
            x: c.start,
            y: r.start,
            w: c.length,
            h: r.length,
            page: row * cols + col,
            dx: place(col, cols, boxW - c.length * scale, true),
            dy: place(row, rows, boxH - r.length * scale, false),
            cuts: {
              left: col ? across[col - 1] : undefined,
              right: col < cols - 1 ? across[col] : undefined,
              top: row ? down[row - 1] : undefined,
              bottom: row < rows - 1 ? down[row] : undefined,
            },
          });
        }
      consider({ orientation, scale, pageCount: pages, tiles });
    };
    if (pages === 1) poster(1, 1);
    else {
      poster(1, pages);
      poster(pages, 1);
      if (pages === 4) poster(2, 2);
    }

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
