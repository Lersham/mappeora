/**
 * Cleans up a phone photo of a book page before the OCR engine reads it.
 * A phone photo is unevenly lit (the shadow of the phone, a lamp on one
 * side), and the engine's own black-and-white conversion uses one threshold
 * for the whole page, so the text in the shadow turns into black blots and
 * the text in the light fades away. Here each part of the page is compared
 * with the paper around it instead: the result is dark text on white paper
 * everywhere, and the table, pictures and shadows past the page fade to white.
 */

/** RGBA pixels, as in ImageData. */
export interface Pixels {
  data: Uint8ClampedArray;
  width: number;
  height: number;
}

/**
 * Returns a copy of the photo (RGBA) in gray with even lighting and full
 * contrast. Pure, so it is unit tested; the web OCR draws it on a canvas.
 */
export function flattenPage({ data, width, height }: Pixels): Uint8ClampedArray<ArrayBuffer> {
  const n = width * height;
  let gray = new Float32Array(n);
  for (let i = 0; i < n; i++) gray[i] = 0.299 * data[i * 4] + 0.587 * data[i * 4 + 1] + 0.114 * data[i * 4 + 2];
  // Camera noise fades, letters stay.
  gray = boxBlur(boxBlur(gray, width, height), width, height);

  const paper = paperLevel(gray, width, height);
  // Lightness relative to the paper around: paper is 1, ink near 0.
  const rel = new Float32Array(n);
  for (let i = 0; i < n; i++) rel[i] = Math.min(1, gray[i] / Math.max(paper[i], 1));

  // Letters are thin: next to every bit of ink there is paper. A dark area
  // with no paper nearby (the table, a photo, a shadow) is not text.
  const r = Math.max(2, Math.round(Math.max(width, height) / 250));
  const near = runningMax(runningMax(rel, width, height, r, 1), width, height, r, width);
  for (let i = 0; i < n; i++) if (near[i] < 0.6) rel[i] = 1;

  // Stretch so that the darkest ink is black: faded print gets readable.
  const ink = quantile(rel, 0.005);
  const span = Math.max(1 - ink, 0.05);
  const out = new Uint8ClampedArray(n * 4);
  for (let i = 0; i < n; i++) {
    out[i * 4] = out[i * 4 + 1] = out[i * 4 + 2] = Math.round(((rel[i] - ink) / span) * 255);
    out[i * 4 + 3] = 255;
  }
  return out;
}

/**
 * The lightness the paper has at each pixel: the lightest pixel of each
 * block is paper (letters are smaller than a block), spread to the blocks
 * around, smoothed and brought back to full size.
 */
export function paperLevel(gray: Float32Array, width: number, height: number): Float32Array {
  // Blocks a bit taller than a line of text in a photo of a whole page.
  const block = Math.max(8, Math.round(Math.max(width, height) / 60));
  const bw = Math.ceil(width / block);
  const bh = Math.ceil(height / block);
  let small = new Float32Array(bw * bh);
  for (let y = 0; y < height; y++) {
    const row = Math.floor(y / block) * bw;
    for (let x = 0; x < width; x++) {
      const b = row + Math.floor(x / block);
      const v = gray[y * width + x];
      if (v > small[b]) small[b] = v;
    }
  }
  const mean = (...v: number[]) => v.reduce((a, b) => a + b) / v.length;
  small = neighbours(small, bw, bh, Math.max);
  small = neighbours(neighbours(small, bw, bh, mean), bw, bh, mean);

  const paper = new Float32Array(width * height);
  for (let y = 0; y < height; y++) {
    const fy = Math.min(Math.max((y + 0.5) / block - 0.5, 0), bh - 1);
    const y0 = Math.floor(fy);
    const y1 = Math.min(y0 + 1, bh - 1);
    const ty = fy - y0;
    for (let x = 0; x < width; x++) {
      const fx = Math.min(Math.max((x + 0.5) / block - 0.5, 0), bw - 1);
      const x0 = Math.floor(fx);
      const x1 = Math.min(x0 + 1, bw - 1);
      const tx = fx - x0;
      const top = small[y0 * bw + x0] * (1 - tx) + small[y0 * bw + x1] * tx;
      const bottom = small[y1 * bw + x0] * (1 - tx) + small[y1 * bw + x1] * tx;
      paper[y * width + x] = top * (1 - ty) + bottom * ty;
    }
  }
  return paper;
}

/** Combines each cell with its 3×3 neighbourhood (cut at the borders). */
function neighbours(src: Float32Array, w: number, h: number, f: (...values: number[]) => number): Float32Array<ArrayBuffer> {
  const dst = new Float32Array(src.length);
  const around: number[] = [];
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      around.length = 0;
      for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          const yy = y + dy;
          const xx = x + dx;
          if (yy >= 0 && yy < h && xx >= 0 && xx < w) around.push(src[yy * w + xx]);
        }
      }
      dst[y * w + x] = f(...around);
    }
  }
  return dst;
}

/** The value below which a fraction `q` of the values (0…1) fall. */
function quantile(values: Float32Array, q: number): number {
  const bins = new Uint32Array(256);
  for (const v of values) bins[Math.min(255, Math.max(0, Math.round(v * 255)))]++;
  let seen = 0;
  const target = values.length * q;
  for (let b = 0; b < 256; b++) {
    seen += bins[b];
    if (seen > target) return b / 255;
  }
  return 1;
}

/** Averages each pixel with its 3×3 neighbourhood. */
function boxBlur(src: Float32Array, w: number, h: number): Float32Array<ArrayBuffer> {
  const tmp = new Float32Array(src.length);
  const dst = new Float32Array(src.length);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = y * w + x;
      const l = x > 0 ? src[i - 1] : src[i];
      const r = x < w - 1 ? src[i + 1] : src[i];
      tmp[i] = (l + src[i] + r) / 3;
    }
  }
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = y * w + x;
      const u = y > 0 ? tmp[i - w] : tmp[i];
      const d = y < h - 1 ? tmp[i + w] : tmp[i];
      dst[i] = (u + tmp[i] + d) / 3;
    }
  }
  return dst;
}

/** The largest value within `r` steps along rows (step 1) or columns (step = width). */
function runningMax(src: Float32Array, w: number, h: number, r: number, step: number): Float32Array<ArrayBuffer> {
  const dst = new Float32Array(src.length);
  const lines = step === 1 ? h : w;
  const len = step === 1 ? w : h;
  const stride = step === 1 ? w : 1;
  for (let l = 0; l < lines; l++) {
    const base = l * stride;
    for (let i = 0; i < len; i++) {
      let m = 0;
      const a = Math.max(0, i - r);
      const b = Math.min(len - 1, i + r);
      for (let j = a; j <= b; j++) {
        const v = src[base + j * step];
        if (v > m) m = v;
      }
      dst[base + i * step] = m;
    }
  }
  return dst;
}
