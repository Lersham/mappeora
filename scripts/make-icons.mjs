// Draws the Mappeora logo and writes every icon and splash screen the app
// needs: favicon and PWA icons (public/), Android launcher icons and splash
// screens (android/app/src/main/res/). The logo is defined once, here.
//
//   npm run icons
//
// Uses the Chromium that Playwright already installs for the E2E tests.
import { chromium } from '@playwright/test';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const res = join(root, 'android/app/src/main/res');

const BLUE = '#3b6ea5';
const CREAM = '#fdf8ec';
const DARK = '#1d2129';

/**
 * The drawing, in a 100×100 box: a small concept map. The main concept (yellow)
 * is linked to three others. Everything stays within a circle of radius 47
 * around the centre, so it survives Android's round masks.
 */
const art = `
  <g stroke="${CREAM}" stroke-width="5" stroke-linecap="round">
    <line x1="50" y1="38" x2="22" y2="69"/>
    <line x1="50" y1="38" x2="50" y2="75"/>
    <line x1="50" y1="38" x2="78" y2="69"/>
  </g>
  <rect x="25" y="14" width="50" height="25" rx="12.5" fill="#ffd166"/>
  <rect x="35" y="24.5" width="30" height="4" rx="2" fill="#7a5a00" opacity="0.55"/>
  <circle cx="22" cy="70" r="11" fill="#ff8a65"/>
  <circle cx="50" cy="77" r="11" fill="${CREAM}"/>
  <circle cx="78" cy="70" r="11" fill="#7ed492"/>`;

/** The art scaled by `scale` around the centre of a `size`×`size` box. */
function placed(size, scale) {
  const s = +((size / 100) * scale).toFixed(4);
  const offset = +((size - 100 * s) / 2).toFixed(3);
  return `<g transform="translate(${offset} ${offset}) scale(${s})">${art}</g>`;
}

const svg = (w, h, body) => `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">${body}</svg>`;

/** Rounded square: favicon, PWA «any», old Android launchers. */
const squareIcon = (size) => svg(size, size, `<rect width="${size}" height="${size}" rx="${size * 0.22}" fill="${BLUE}"/>${placed(size, 0.84)}`);
/** Full bleed: PWA «maskable» and iOS, which cut their own shape. */
const fullIcon = (size) => svg(size, size, `<rect width="${size}" height="${size}" fill="${BLUE}"/>${placed(size, 0.78)}`);
const roundIcon = (size) => svg(size, size, `<circle cx="${size / 2}" cy="${size / 2}" r="${size / 2}" fill="${BLUE}"/>${placed(size, 0.8)}`);
/** Android adaptive icon foreground: 108dp, only the inner 66dp circle is always visible. */
const foreground = (size) => svg(size, size, placed(size, 0.7));

const font = readFileSync(join(root, 'node_modules/@fontsource/lexend/files/lexend-latin-600-normal.woff2')).toString('base64');

function splash(w, h, dark) {
  const icon = Math.round(Math.min(w, h) * 0.3);
  const text = Math.round(icon * 0.3);
  const top = Math.round((h - icon - text * 1.6) / 2);
  return `<div style="width:${w}px;height:${h}px;background:${dark ? DARK : CREAM};display:flex;flex-direction:column;align-items:center;padding-top:${top}px;box-sizing:border-box">
    ${squareIcon(icon)}
    <div style="font:600 ${text}px Lexend;color:${dark ? '#f1ede4' : '#1f2430'};margin-top:${Math.round(text * 0.5)}px;letter-spacing:0.02em">Mappeora</div>
  </div>`;
}

const DENSITIES = { mdpi: 1, hdpi: 1.5, xhdpi: 2, xxhdpi: 3, xxxhdpi: 4 };
const SPLASH_PORT = { mdpi: [320, 480], hdpi: [480, 800], xhdpi: [720, 1280], xxhdpi: [960, 1600], xxxhdpi: [1280, 1920] };

const browser = await chromium.launch();
const page = await browser.newPage();

async function png(file, w, h, html) {
  await page.setViewportSize({ width: w, height: h });
  await page.setContent(
    `<style>@font-face{font-family:Lexend;font-weight:600;src:url(data:font/woff2;base64,${font})}body{margin:0}svg{display:block}</style>${html}`,
  );
  await page.evaluate(() => document.fonts.ready);
  mkdirSync(dirname(file), { recursive: true });
  await page.screenshot({ path: file, omitBackground: true });
}

// Web and PWA.
writeFileSync(join(root, 'public/icon.svg'), `${squareIcon(64).replace(/ width="64" height="64"/, '')}\n`);
await png(join(root, 'public/icon-192.png'), 192, 192, squareIcon(192));
await png(join(root, 'public/icon-512.png'), 512, 512, squareIcon(512));
await png(join(root, 'public/icon-maskable-512.png'), 512, 512, fullIcon(512));
await png(join(root, 'public/apple-touch-icon.png'), 180, 180, fullIcon(180));

// Android launcher icons.
for (const [d, k] of Object.entries(DENSITIES)) {
  await png(join(res, `mipmap-${d}/ic_launcher.png`), 48 * k, 48 * k, squareIcon(48 * k));
  await png(join(res, `mipmap-${d}/ic_launcher_round.png`), 48 * k, 48 * k, roundIcon(48 * k));
  await png(join(res, `mipmap-${d}/ic_launcher_foreground.png`), 108 * k, 108 * k, foreground(108 * k));
}

// Android splash screens (before Android 12; newer versions show the launcher
// icon on the colour in values/splash.xml), light and dark.
await png(join(res, 'drawable/splash.png'), 480, 320, splash(480, 320, false));
await png(join(res, 'drawable-night/splash.png'), 480, 320, splash(480, 320, true));
for (const [d, [w, h]] of Object.entries(SPLASH_PORT)) {
  for (const dark of [false, true]) {
    const night = dark ? '-night' : '';
    await png(join(res, `drawable-port${night}-${d}/splash.png`), w, h, splash(w, h, dark));
    await png(join(res, `drawable-land${night}-${d}/splash.png`), h, w, splash(h, w, dark));
  }
}

await browser.close();
console.log('Icone e splash screen aggiornati.');
