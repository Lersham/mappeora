import { describe, expect, it } from 'vitest';
import { flattenPage } from './ocrImage';

const W = 240;
const H = 160;

/**
 * A page lit from the left (paper from 230 down to 90 on the right), with
 * dark strokes of "text" across it and the dark table along the bottom.
 */
function photo() {
  const data = new Uint8ClampedArray(W * H * 4);
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const paper = 230 - (140 * x) / W;
      const stroke = y % 20 >= 8 && y % 20 < 11 && x % 12 < 8 && y < 120;
      const table = y >= 130;
      const v = table ? 40 : stroke ? paper * 0.35 : paper;
      data.set([v, v, v, 255], (y * W + x) * 4);
    }
  }
  return { data, width: W, height: H };
}

const at = (out: Uint8ClampedArray, x: number, y: number) => out[(y * W + x) * 4];

describe('flattenPage', () => {
  const out = flattenPage(photo());

  it('turns paper white on both the light and the dark side', () => {
    expect(at(out, 30, 4)).toBeGreaterThan(220);
    expect(at(out, 210, 4)).toBeGreaterThan(220);
  });

  it('keeps the text dark on both sides', () => {
    expect(at(out, 26, 29)).toBeLessThan(110);
    expect(at(out, 206, 29)).toBeLessThan(110);
  });

  it('fades out a dark area with no paper around, like the table', () => {
    expect(at(out, 120, 150)).toBeGreaterThan(220);
  });

  it('returns opaque gray pixels of the same size', () => {
    expect(out.length).toBe(W * H * 4);
    expect(out[(50 * W + 50) * 4 + 3]).toBe(255);
    expect(out[(50 * W + 50) * 4]).toBe(out[(50 * W + 50) * 4 + 1]);
  });
});
