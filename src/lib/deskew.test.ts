import { describe, expect, it } from 'vitest';
import { skewAngle } from './deskew';

/** A page of "words" (dark dashes) on light paper, its lines tilted by `degrees`. */
function page(degrees: number, { width = 400, height = 500, shadow = false } = {}) {
  const gray = new Float32Array(width * height);
  const tan = Math.tan((degrees * Math.PI) / 180);
  for (let y = 0; y < height; y++)
    for (let x = 0; x < width; x++) {
      // A shadow over the left third: darker paper is not ink.
      const paper = shadow && x < width / 3 ? 150 : 235;
      const along = y - (x - width / 2) * tan;
      const inLine = ((along % 24) + 24) % 24 < 5;
      const inWord = (x % 50) < 38;
      gray[y * width + x] = inLine && inWord && x > 20 && x < width - 20 && y > 30 && y < height - 30 ? 40 : paper;
    }
  return { gray, width, height };
}

describe('skewAngle', () => {
  for (const tilt of [0, 3, -8, 15]) {
    it(`finds a tilt of ${tilt}°`, () => {
      const { gray, width, height } = page(tilt);
      expect(skewAngle(gray, width, height)).toBeCloseTo(tilt, 0);
    });
  }

  it('is not fooled by a shadow on the page', () => {
    const { gray, width, height } = page(6, { shadow: true });
    expect(skewAngle(gray, width, height)).toBeCloseTo(6, 0);
  });

  it('says 0 on a page with no text', () => {
    expect(skewAngle(new Float32Array(300 * 300).fill(230), 300, 300)).toBe(0);
  });
});
