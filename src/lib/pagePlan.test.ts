import { describe, expect, it } from 'vitest';
import { planPages, stepCut, type Cut, type Tile } from './pagePlan';

const layout = { margin: 12, header: 12, footer: 4 };

describe('planPages', () => {
  it('prints a small map whole, on one portrait sheet', () => {
    const plan = planPages(400, 600, 'a4', 1, layout);
    expect(plan.orientation).toBe('portrait');
    expect(plan.tiles).toEqual([expect.objectContaining({ x: 0, y: 0, w: 400, h: 600, page: 0 })]);
  });

  it('turns the sheet for a wide map, when that prints it larger', () => {
    const plan = planPages(1400, 650, 'a4', 1, layout);
    expect(plan.orientation).toBe('landscape');
    expect(plan.scale).toBeCloseTo(273 / 1400);
    expect(plan.tiles).toEqual([expect.objectContaining({ x: 0, y: 0, w: 1400, h: 650, page: 0 })]);
  });

  it('lays a tall, narrow "scaletta" out in columns, much larger than one long strip', () => {
    const plan = planPages(450, 4000, 'a4', 1, layout);
    const oneStrip = Math.min(186 / 450, 257 / 4000);
    expect(plan.tiles.length).toBeGreaterThan(1);
    expect(plan.tiles.every((t) => t.page === 0)).toBe(true);
    expect(plan.scale).toBeGreaterThan(oneStrip * 1.8);
    // columns side by side, read top to bottom then left to right
    expect(plan.tiles[1].dx).toBeGreaterThan(plan.tiles[0].dx);
    expect(plan.tiles[1].y).toBeGreaterThan(plan.tiles[0].y);
  });

  it('cuts between concepts when it can, and covers the whole map', () => {
    const breaks = [900, 1950, 3100];
    const plan = planPages(450, 4000, 'a4', 2, layout, breaks);
    const cuts = plan.tiles.slice(1).map((t) => t.y);
    for (const c of cuts) expect(breaks).toContain(c);
    const last = plan.tiles[plan.tiles.length - 1];
    expect(last.y + last.h).toBe(4000);
    expect(new Set(plan.tiles.map((t) => t.page))).toEqual(new Set([0, 1]));
  });

  it('overlaps the pieces where no safe cut exists', () => {
    const plan = planPages(450, 4000, 'a4', 2, layout);
    const [a, b] = plan.tiles;
    expect(b.y).toBeLessThan(a.y + a.h);
  });

  it('uses a 2×2 poster for a wide map on four sheets', () => {
    const plan = planPages(3000, 2000, 'a4', 4, layout);
    expect(plan.tiles).toHaveLength(4);
    expect(new Set(plan.tiles.map((t) => t.x)).size).toBe(2);
  });

  it('on two sheets a wide map is cut down the middle, and prints larger than on one', () => {
    const one = planPages(3000, 2000, 'a4', 1, layout);
    const two = planPages(3000, 2000, 'a4', 2, layout);
    expect(two.tiles.map((t) => [t.page, t.y])).toEqual([
      [0, 0],
      [1, 0],
    ]);
    expect(one.orientation).toBe('landscape');
    expect(two.scale).toBeGreaterThan(one.scale * 1.3);
  });

  it('two sheets side by side join exactly: the cut is the edge of both, nothing repeated', () => {
    const plan = planPages(3000, 2000, 'a4', 2, layout);
    const [a, b] = plan.tiles;
    const boxW = (plan.orientation === 'portrait' ? 210 : 297) - 24;
    expect(a.dx + a.w * plan.scale).toBeCloseTo(boxW); // the left piece reaches the right edge
    expect(b.dx).toBeCloseTo(0); // the right one starts at the left edge
    expect(b.x).toBeCloseTo(a.x + a.w);
    expect(b.x + b.w).toBeCloseTo(3000);
    expect(a.dy).toBe(b.dy); // and at the same height
  });

  it('on four sheets the rows go on where the sheet above ends', () => {
    const plan = planPages(3000, 2000, 'a4', 4, layout);
    const page = (n: number) => plan.tiles.find((t) => t.page === n)!;
    const boxH = (plan.orientation === 'portrait' ? 297 : 210) - 24 - layout.header - layout.footer;
    expect(page(0).h * plan.scale).toBeCloseTo(boxH);
    expect(page(2).y).toBeCloseTo(page(0).y + page(0).h);
    expect(page(3).x).toBeCloseTo(page(2).x + page(2).w);
    expect(page(2).y + page(2).h).toBeCloseTo(2000);
  });

  it('a small map on two sheets leaves neither empty', () => {
    const plan = planPages(320, 240, 'a4', 2, layout);
    expect(new Set(plan.tiles.map((t) => t.page))).toEqual(new Set([0, 1]));
  });

  it('does not blow up a tiny map', () => {
    expect(planPages(320, 240, 'a3', 1, layout).scale).toBeLessThanOrEqual(0.35);
  });

  it('on more sheets the cuts step round the concepts, never through one', () => {
    // a grid of concepts, one of them right where a straight cut would fall
    const boxes: Tile[] = [];
    for (let row = 0; row < 6; row++)
      for (let col = 0; col < 8; col++) boxes.push({ x: 10 + col * 370 + (row % 2) * 185, y: 40 + row * 320, w: 220, h: 120 });
    const crosses = (cut: Cut, vertical: boolean) =>
      boxes.some((b) =>
        cut.some((s) => {
          const [from, to, lo, hi] = vertical ? [b.y, b.y + b.h, b.x, b.x + b.w] : [b.x, b.x + b.w, b.y, b.y + b.h];
          return s.from < to && s.to > from && s.at > lo && s.at < hi;
        }),
      );
    for (const pages of [2, 4] as const) {
      const plan = planPages(3000, 2000, 'a4', pages, layout, [], boxes);
      for (const t of plan.tiles) {
        if (t.cuts?.left) expect(crosses(t.cuts.left, true)).toBe(false);
        if (t.cuts?.right) expect(crosses(t.cuts.right, true)).toBe(false);
        if (t.cuts?.top) expect(crosses(t.cuts.top, false)).toBe(false);
        if (t.cuts?.bottom) expect(crosses(t.cuts.bottom, false)).toBe(false);
      }
      expect(plan.tiles.some((t) => (t.cuts?.right?.length ?? 0) > 1)).toBe(true); // a straight cut would split some
    }
  });

  it('a cut steps aside round a concept on its line, and goes straight elsewhere', () => {
    const cut = stepCut([{ x: 450, y: 300, w: 200, h: 100 }], true, 1000, 800, 500);
    const at = (y: number) => cut.find((s) => y >= s.from && y < s.to)!.at;
    expect(at(350)).toBeLessThanOrEqual(444); // passes left of the concept, with room to spare
    expect(cut[0].from).toBe(0);
    expect(cut[cut.length - 1].to).toBe(800);
    // with nothing in the way the cut is a straight line where it was asked
    expect(stepCut([], true, 1000, 800, 500)).toEqual([{ from: 0, to: 800, at: 500 }]);
  });
});
