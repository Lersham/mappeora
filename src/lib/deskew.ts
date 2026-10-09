/**
 * How much a photographed page is tilted, so it can be straightened before
 * the text is read: Tesseract reads a page 8° askew badly and one 15° askew
 * hardly at all, and a child rarely holds the phone square to the book.
 *
 * Projection profile: the ink of a page in lines piles up into the fewest,
 * sharpest rows when it is looked at along the lines. Every angle from −20°
 * to +20° is tried, then the best one is refined to a tenth of a degree.
 */

const MAX_TILT = 20;
/** Within this, the page is left as it is (degrees). */
export const STRAIGHT_ENOUGH = 0.5;
/** Enough ink points to judge, few enough to stay fast. */
const MIN_POINTS = 200;
const MAX_POINTS = 60_000;
/** Neighbourhood (px) whose lightest pixel is the paper under a point. */
const PAPER_RADIUS = 7;

/**
 * Tilt of the text lines, in degrees (positive: the lines go down to the
 * right). 0 when there is too little text to tell. `gray` is one 0–255 value
 * per pixel, row by row; best on an image of about 800 px.
 */
export function skewAngle(gray: ArrayLike<number>, width: number, height: number): number {
  const paper = localMax(localMax(gray, width, height, true), width, height, false);
  // Ink: clearly darker than the paper around it (shadows and gradients are not ink).
  const xs: number[] = [];
  const ys: number[] = [];
  for (let y = 0; y < height; y++)
    for (let x = 0; x < width; x++) {
      const i = y * width + x;
      if (paper[i] > 60 && gray[i] < 0.7 * paper[i]) {
        xs.push(x - width / 2);
        ys.push(y - height / 2);
      }
    }
  if (xs.length < MIN_POINTS) return 0;
  const step = Math.max(1, Math.floor(xs.length / MAX_POINTS));
  const diagonal = Math.ceil(Math.hypot(width, height));
  const sharpness = (degrees: number) => {
    const a = (degrees * Math.PI) / 180;
    const [sin, cos] = [Math.sin(a), Math.cos(a)];
    const rows = new Float32Array(diagonal + 2);
    for (let i = 0; i < xs.length; i += step) rows[Math.round(ys[i] * cos - xs[i] * sin + diagonal / 2)]++;
    let sum = 0;
    for (const r of rows) sum += r * r;
    return sum;
  };
  let best = 0;
  let bestScore = -1;
  const consider = (degrees: number) => {
    const score = sharpness(degrees);
    if (score > bestScore) [best, bestScore] = [degrees, score];
  };
  for (let d = -MAX_TILT; d <= MAX_TILT; d += 0.5) consider(d);
  const coarse = best;
  for (let d = coarse - 0.5; d <= coarse + 0.5; d += 0.1) consider(Math.round(d * 10) / 10);
  return best;
}

/** The lightest value within PAPER_RADIUS, along rows or along columns. */
function localMax(src: ArrayLike<number>, width: number, height: number, alongRows: boolean): Float32Array {
  const out = new Float32Array(width * height);
  for (let y = 0; y < height; y++)
    for (let x = 0; x < width; x++) {
      let m = 0;
      if (alongRows) for (let k = Math.max(0, x - PAPER_RADIUS); k <= Math.min(width - 1, x + PAPER_RADIUS); k++) m = Math.max(m, src[y * width + k]);
      else for (let k = Math.max(0, y - PAPER_RADIUS); k <= Math.min(height - 1, y + PAPER_RADIUS); k++) m = Math.max(m, src[k * width + x]);
      out[y * width + x] = m;
    }
  return out;
}
