import { describe, expect, it } from 'vitest';
import { planPages } from './pagePlan';

const layout = { margin: 12, header: 12, footer: 4 };

describe('planPages', () => {
  it('prints a small map whole, on one portrait sheet', () => {
    const plan = planPages(600, 400, 'a4', 1, layout);
    expect(plan.orientation).toBe('portrait');
    expect(plan.tiles).toEqual([expect.objectContaining({ x: 0, y: 0, w: 600, h: 400, page: 0 })]);
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
    expect(two.scale).toBeGreaterThan(one.scale * 1.5);
  });

  it('does not blow up a tiny map', () => {
    expect(planPages(320, 240, 'a3', 1, layout).scale).toBeLessThanOrEqual(0.35);
  });
});
