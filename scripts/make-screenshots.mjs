// Takes the screenshots of the web app manifest (public/screenshots/*.webp):
// Chrome shows them in its richer «Installa» dialog. Two for phones (narrow,
// 1080×1920) and two for wide screens (1920×1080), each under 150 KB because
// public/ also goes into the Android and iOS bundles.
//
//   npm run build && npx vite preview --port 4182   # in another terminal
//   npm run screenshots                             # or: npm run screenshots -- --url http://localhost:4182
//
// Uses the Chromium that Playwright already installs for the E2E tests.
// Re-run it when the screens change a lot, and look at the four pictures:
// no welcome window, no word cut off.
import { chromium } from 'playwright-core';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const outDir = join(root, 'public/screenshots');
const urlArg = process.argv.indexOf('--url');
const base = (urlArg > 0 && process.argv[urlArg + 1]) || 'http://localhost:4182';
const MAX_BYTES = 150 * 1024;

try {
  await fetch(base);
} catch {
  console.error(`Nessun server su ${base}. Prima: npm run build && npx vite preview --port 4182 (oppure --url ...).`);
  process.exit(1);
}

// Cloud sessions have Chromium preinstalled here; elsewhere Playwright's own is used.
const browser = await chromium.launch(process.env.PLAYWRIGHT_CHROMIUM_PATH ? { executablePath: process.env.PLAYWRIGHT_CHROMIUM_PATH } : {});

/** A fresh browser, like a first visit, with the welcome already seen and nothing going out to the internet. */
async function open(viewport, mobile) {
  const context = await browser.newContext({
    viewport,
    deviceScaleFactor: mobile ? 3 : 1,
    isMobile: mobile,
    hasTouch: mobile,
    locale: 'it-IT',
    serviceWorkers: 'block',
  });
  await context.addInitScript(() => localStorage.setItem('mappeora-welcome', 'visto'));
  await context.route(/^https?:\/\/(?!localhost[:/])/, (route) => route.abort());
  const page = await context.newPage();
  await page.goto(base);
  return page;
}

/** A tool of the editor: in the toolbars, in the top bar, or under «Altro» (a phone). */
async function tool(page, name) {
  const places = [page.getByRole('navigation', { name: 'Strumenti' }), page.getByRole('toolbar', { name: 'Concetto scelto' }), page.locator('.topbar')];
  for (const place of places) {
    const button = place.getByRole('button', { name, exact: true });
    if (await button.isVisible()) return button.click();
  }
  await places[0].getByRole('button', { name: 'Altro', exact: true }).click();
  await page.getByRole('dialog', { name: 'Altro' }).getByRole('button', { name, exact: true }).click();
}

/** Waits until the concepts have stopped moving (layout, zoom). */
async function settled(page) {
  let last = '';
  for (let i = 0; i < 40; i++) {
    const now = await page.locator('.concept-node').evaluateAll((els) => JSON.stringify(els.map((e) => e.getBoundingClientRect().toJSON())));
    if (now === last) return;
    last = now;
    await page.waitForTimeout(250);
  }
  throw new Error('la mappa non smette di muoversi');
}

/** «La Rivoluzione francese» from «Esempi», tidied and with a colour for each branch. */
async function colouredExample(page) {
  await page.getByRole('button', { name: 'Esempi', exact: true }).click();
  await page.getByRole('button', { name: /^La Rivoluzione francese/ }).click();
  await page.locator('.concept-node').nth(36).waitFor();
  await settled(page);
  await tool(page, 'Riordina');
  await page.getByRole('button', { name: /Colora i rami/ }).click();
  await settled(page);
}

/** «Mostra tutta la mappa»: on a wide screen the map opens large and cut at the sides. */
async function wholeMap(page) {
  await page.locator('.react-flow__controls-fitview').click();
  await settled(page);
}

/** Zooms the map about a point, like a pinch (React Flow zooms on Ctrl + wheel), until it reaches the given scale. */
async function zoomTo(page, scale, x, y) {
  const current = () => page.locator('.react-flow__viewport').evaluate((el) => new DOMMatrixReadOnly(getComputedStyle(el).transform).a);
  await page.mouse.move(x, y);
  await page.keyboard.down('Control');
  for (let i = 0; i < 40; i++) {
    const now = await current();
    if (Math.abs(now - scale) / scale < 0.04) break;
    await page.mouse.wheel(0, now < scale ? -40 : 40);
    await page.waitForTimeout(60);
  }
  await page.keyboard.up('Control');
  await settled(page);
}

/** Looks at the picture before it is kept: nothing in the way of the map. */
async function readyToShoot(page) {
  await page.mouse.move(0, 0);
  await page.evaluate(() => document.fonts.ready);
  if (await page.getByRole('dialog', { name: /Benvenut|Come funziona/ }).count()) throw new Error('la finestra di benvenuto è aperta');
}

/** PNG to WebP with the browser's own encoder, at the best quality that stays under the limit. */
async function toWebp(png) {
  const page = await browser.newPage();
  try {
    for (const quality of [0.92, 0.85, 0.78, 0.7, 0.6, 0.5, 0.4]) {
      const base64 = await page.evaluate(
        async ([data, q]) => {
          const bitmap = await createImageBitmap(await (await fetch(`data:image/png;base64,${data}`)).blob());
          const canvas = new OffscreenCanvas(bitmap.width, bitmap.height);
          canvas.getContext('2d').drawImage(bitmap, 0, 0);
          const blob = await canvas.convertToBlob({ type: 'image/webp', quality: q });
          const bytes = new Uint8Array(await blob.arrayBuffer());
          let s = '';
          for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
          return btoa(s);
        },
        [png.toString('base64'), quality],
      );
      const webp = Buffer.from(base64, 'base64');
      if (webp.length < MAX_BYTES) return webp;
    }
  } finally {
    await page.close();
  }
  throw new Error('non riesco a stare sotto i 150 KB');
}

mkdirSync(outDir, { recursive: true });
async function shoot(page, name) {
  await readyToShoot(page);
  const webp = await toWebp(await page.screenshot({ type: 'png' }));
  writeFileSync(join(outDir, `${name}.webp`), webp);
  console.log(`${name}.webp  ${(webp.length / 1024).toFixed(0)} KB`);
  await page.context().close();
}

// Phone: 360×640 at 3× = 1080×1920.
{
  const page = await open({ width: 360, height: 640 }, true);
  await colouredExample(page);
  // The whole map is too small to read on a phone: a tap on a concept brings its branch closer (a leaf: no «+3» button in the way).
  await page.locator('.concept-node').filter({ has: page.locator('.concept-label', { hasText: /^Luigi XVI/ }) }).tap();
  // It waits a moment before coming closer, so a quick second tap finds the concept in place.
  await page.waitForTimeout(1200);
  await settled(page);
  await shoot(page, 'narrow-1');
}
{
  const page = await open({ width: 360, height: 640 }, true);
  await page.getByRole('button', { name: 'Esempi', exact: true }).click();
  await page.getByRole('button', { name: /^La Rivoluzione francese/ }).click();
  await page.locator('.concept-node').nth(36).waitFor();
  await settled(page);
  await tool(page, 'Ripassa');
  await page.getByRole('button', { name: /^Indovina/ }).click();
  await page.getByRole('button', { name: 'Scopri', exact: true }).waitFor();
  // Some concepts in, to see the map filling up: the next one is still hidden.
  for (let i = 0; i < 14; i++) {
    await page.getByRole('button', { name: 'Scopri', exact: true }).click();
    await page.getByRole('button', { name: 'Avanti', exact: true }).click();
  }
  await settled(page);
  // A step back from the question, to see the column of concepts found so far, with the «?» near the bottom.
  const question = page.locator('.concept-node').filter({ hasText: /^\?$/ });
  const at = async () => (await question.boundingBox()) ?? { x: 0, y: 0, width: 0, height: 0 };
  let box = await at();
  await zoomTo(page, 0.55, box.x + box.width / 2, box.y + box.height / 2);
  for (let i = 0; i < 20; i++) {
    box = await at();
    // 478 px from the top: the «?» low on the screen, the column above it, and no neighbour cut at the left.
    const off = box.y + box.height / 2 - 478;
    if (Math.abs(off) < 8) break;
    await page.mouse.wheel(0, off);
    await page.waitForTimeout(80);
  }
  await settled(page);
  await shoot(page, 'narrow-2');
}

// Wide screen: 1920×1080.
{
  const page = await open({ width: 1920, height: 1080 }, false);
  await colouredExample(page);
  await wholeMap(page);
  // The middle of the map, close enough to read: the whole of it would be 4 px of text in the install dialog.
  await zoomTo(page, 0.75, 1170, 440);
  await shoot(page, 'wide-1');
}
{
  const page = await open({ width: 1920, height: 1080 }, false);
  await colouredExample(page);
  await wholeMap(page);
  await tool(page, 'Aspetto');
  const panel = page.getByRole('dialog', { name: 'Aspetto e voce' });
  await panel.getByRole('button', { name: 'OpenDyslexic' }).click();
  await page.waitForFunction(() => [...document.fonts].some((f) => f.family.replace(/"/g, '') === 'OpenDyslexic' && f.status === 'loaded'));
  await settled(page);
  await shoot(page, 'wide-2');
}

await browser.close();
