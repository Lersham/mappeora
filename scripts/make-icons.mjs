// Writes every icon and splash screen the app needs from the MappAmi mascot:
// favicon and PWA icons (public/), Android launcher icons and splash screens
// (android/app/src/main/res/), iOS app icon and splash (ios/App/App/Assets.xcassets/).
// The mascot is defined once, in resources/mascotte.png.
//
//   npm run icons
//
// Uses the Chromium that Playwright already installs for the E2E tests.
import { chromium } from '@playwright/test';
import { copyFileSync, mkdirSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const res = join(root, 'android/app/src/main/res');
const xcassets = join(root, 'ios/App/App/Assets.xcassets');

const CREAM = '#fdf8ec';
const DARK = '#1d2129';

/**
 * The mascot, 1024×1024 and full bleed: the original drawing without its
 * frame and rounded corners, cleaned and upscaled, so each platform can cut
 * its own shape. Face, tablet and hands sit inside the inscribed circle, so
 * they survive round masks.
 */
const MASCOT = join(root, 'resources/mascotte.png');
const mascot = `data:image/png;base64,${readFileSync(MASCOT).toString('base64')}`;

/** The mascot scaled by `scale` around the centre of a `size`×`size` box. */
function placed(size, scale, clip = '') {
  const s = +(size * scale).toFixed(3);
  const offset = +((size - s) / 2).toFixed(3);
  return `<image href="${mascot}" x="${offset}" y="${offset}" width="${s}" height="${s}"${clip}/>`;
}

const svg = (w, h, body) => `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">${body}</svg>`;
const clipped = (size, shape) => `<defs><clipPath id="c">${shape}</clipPath></defs>${placed(size, 1, ' clip-path="url(#c)"')}`;

/** Rounded square: favicon, PWA «any», splash screens, old Android launchers. */
const squareIcon = (size) => svg(size, size, clipped(size, `<rect width="${size}" height="${size}" rx="${size * 0.22}"/>`));
/** Full bleed: PWA «maskable» and Apple, which cut their own shape. */
const fullIcon = (size) => svg(size, size, placed(size, 1));
const roundIcon = (size) => svg(size, size, clipped(size, `<circle cx="${size / 2}" cy="${size / 2}" r="${size / 2}"/>`));
/**
 * Android adaptive icon foreground: 108dp, of which launchers show the inner
 * 72dp. The mascot fills those 72dp plus a little bleed; the sky colour in
 * values/ic_launcher_background.xml shows only during parallax effects.
 */
const foreground = (size) => svg(size, size, placed(size, 0.72));

const font = readFileSync(join(root, 'node_modules/@fontsource/lexend/files/lexend-latin-600-normal.woff2')).toString('base64');

function splash(w, h, dark) {
  const icon = Math.round(Math.min(w, h) * 0.3);
  const text = Math.round(icon * 0.3);
  const top = Math.round((h - icon - text * 1.6) / 2);
  return `<div style="width:${w}px;height:${h}px;background:${dark ? DARK : CREAM};display:flex;flex-direction:column;align-items:center;padding-top:${top}px;box-sizing:border-box">
    ${squareIcon(icon)}
    <div style="font:600 ${text}px Lexend;color:${dark ? '#f1ede4' : '#1f2430'};margin-top:${Math.round(text * 0.5)}px;letter-spacing:0.02em">MappAmi</div>
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
  await page.evaluate(() => Promise.all([document.fonts.ready, ...[...document.images].map((i) => i.decode().catch(() => {}))]));
  mkdirSync(dirname(file), { recursive: true });
  await page.screenshot({ path: file, omitBackground: true });
}

// Web and PWA.
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

// iOS: the App Store icon must have no transparency, so it is the mascot file
// itself. The splash is one 2732×2732 image, cropped by the launch screen.
copyFileSync(MASCOT, join(xcassets, 'AppIcon.appiconset/AppIcon-512@2x.png'));
const iosSplash = join(xcassets, 'Splash.imageset/splash-2732x2732.png');
await png(iosSplash, 2732, 2732, splash(2732, 2732, false));
for (const copy of ['splash-2732x2732-1.png', 'splash-2732x2732-2.png']) {
  copyFileSync(iosSplash, join(xcassets, 'Splash.imageset', copy));
}

await browser.close();
console.log('Icone e splash screen aggiornati.');
