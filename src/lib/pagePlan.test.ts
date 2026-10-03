import { describe, expect, it } from 'vitest';
import { planPages } from './pagePlan';

const layout = { margin: 12, header: 12, footer: 4 };

describe('planPages', () => {
  it('prints a wide map on one landscape sheet', () => {
    const plan = planPages(2000, 1000, 'a4', 1, layout);
    expect(plan.orientation).toBe('landscape');
    expect(plan.tiles).toEqual([{ x: 0, y: 0, w: 2000, h: 1000 }]);
  });

  it('splits a wide map side by side on two sheets, larger than on one', () => {
    const one = planPages(4000, 1000, 'a4', 1, layout);
    const two = planPages(4000, 1000, 'a4', 2, layout);
    expect(two.tiles).toHaveLength(2);
    expect(two.tiles[0].y).toBe(two.tiles[1].y); // same row
    expect(two.scale).toBeGreaterThan(one.scale * 1.5);
  });

  it('overlaps neighbouring sheets and covers the whole map', () => {
    const { tiles } = planPages(3000, 3000, 'a4', 4, layout);
    expect(tiles).toHaveLength(4);
    const [a, b] = tiles;
    expect(b.x).toBeLessThan(a.x + a.w); // overlap
    const right = Math.max(...tiles.map((t) => t.x + t.w));
    const bottom = Math.max(...tiles.map((t) => t.y + t.h));
    expect(right).toBe(3000);
    expect(bottom).toBe(3000);
  });

  it('does not blow up a tiny map', () => {
    expect(planPages(800, 600, 'a3', 1, layout).scale).toBeLessThanOrEqual(0.35);
  });
});
