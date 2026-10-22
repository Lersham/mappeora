// Writes public/og-image.png (1200×630): the picture that shows up when a link to
// MappAmi is shared in a chat or on a social network (og:image, see index.html).
// Cream background, the mascot with her map, the name and the tagline in Lexend.
//
//   npm run og-image
//
// Uses the Chromium that Playwright already installs for the E2E tests.
// public/ goes into the Android app too, so the file must stay small.
import { chromium } from '@playwright/test';
import { readFileSync, statSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = join(root, 'public/og-image.png');
const MAX_BYTES = 250 * 1024;

const CREAM = '#fdf8ec';
const INK = '#1f2430';
const PEN_BLUE = '#2b54b0';
const SKY = '#dcecf8';

const base64 = (file) => readFileSync(join(root, file)).toString('base64');
const lexend = (weight) => base64(`node_modules/@fontsource/lexend/files/lexend-latin-${weight}-normal.woff2`);
const mascot = `data:image/png;base64,${base64('resources/mascotte/mappa.png')}`;

const html = `<style>
  @font-face { font-family: Lexend; font-weight: 600; src: url(data:font/woff2;base64,${lexend(600)}); }
  @font-face { font-family: Lexend; font-weight: 700; src: url(data:font/woff2;base64,${lexend(700)}); }
  body { margin: 0; }
  .card { position: relative; width: 1200px; height: 630px; overflow: hidden; background: ${CREAM}; font-family: Lexend, sans-serif; }
  .text { position: absolute; left: 80px; top: 0; bottom: 0; width: 570px; display: flex; flex-direction: column; justify-content: center; }
  h1 { margin: 0 0 36px; font: 700 112px/1 Lexend; letter-spacing: -0.01em; color: ${PEN_BLUE}; }
  p { margin: 0; font: 600 40px/1.35 Lexend; color: ${INK}; }
  p span { display: block; }
  p span + span { margin-top: 12px; }
  .disc { position: absolute; right: 60px; top: 85px; width: 460px; height: 460px; border-radius: 50%; background: ${SKY}; }
  img { position: absolute; right: 100px; top: 65px; height: 500px; }
</style>
<div class="card">
  <div class="text">
    <h1>MappAmi</h1>
    <p><span>Mappe concettuali<br />che si ascoltano.</span><span>Per bambini con DSA<br />e per tutti.</span></p>
  </div>
  <div class="disc"></div>
  <img src="${mascot}" alt="" />
</div>`;

const browser = await chromium.launch(process.env.PLAYWRIGHT_CHROMIUM_PATH ? { executablePath: process.env.PLAYWRIGHT_CHROMIUM_PATH } : {});
const page = await browser.newPage({ viewport: { width: 1200, height: 630 } });
await page.setContent(html);
await page.evaluate(() => Promise.all([document.fonts.ready, ...[...document.images].map((i) => i.decode().catch(() => {}))]));
await page.screenshot({ path: OUT });
await browser.close();

const size = statSync(OUT).size;
console.log(`public/og-image.png: ${(size / 1024).toFixed(0)} KB`);
if (size > MAX_BYTES) {
  console.error(`Troppo grande: il limite è ${MAX_BYTES / 1024} KB (public/ finisce anche nell’app Android).`);
  process.exitCode = 1;
}
