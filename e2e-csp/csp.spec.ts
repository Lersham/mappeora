import { test as base, expect, type Page } from '@playwright/test';
import { readdirSync, readFileSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';

/**
 * The app on the headers of the real site (npm run test:csp): built, served
 * from dist/ with the headers of vercel.json (scripts/serve-dist.mjs). Walks
 * the features that load, draw or save things in ways a Content-Security-Policy
 * can block, and fails on any violation. The main suite runs on `vite preview`,
 * which sends no CSP: it cannot see these.
 */

const PNG_1PX = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
  'base64',
);
const SVG = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 10"><circle cx="5" cy="5" r="4" fill="#4a90d9"/></svg>';

const root = join(import.meta.dirname, '..');
/** What vercel.json says every path gets. */
const everywhere = (JSON.parse(readFileSync(join(root, 'vercel.json'), 'utf8')).headers as { source: string; headers: { key: string; value: string }[] }[]).find(
  (rule) => rule.source === '/(.*)',
)!.headers;

const test = base.extend<{ violations: string[] }>({
  // Everything the browser reports as blocked, from the page (the event) or the console.
  violations: [
    async ({ context, page }, use) => {
      const found: string[] = [];
      await context.exposeBinding('__cspViolation', (_source, message: string) => void found.push(message));
      await context.addInitScript(() => {
        // The welcome counts as seen: it is not what is tested here.
        localStorage.setItem('mappeora-welcome', 'visto');
        document.addEventListener('securitypolicyviolation', (e) => {
          const report = (window as unknown as { __cspViolation?: (m: string) => void }).__cspViolation;
          report?.(`${e.violatedDirective}: ${e.blockedURI || 'inline'} (${e.sourceFile}:${e.lineNumber})`);
        });
      });
      // The network outside the app is mocked, as in the main suite (e2e/fixtures.ts).
      await context.route(/^https?:\/\/(?!localhost[:/])/, async (route) => {
        const url = new URL(route.request().url());
        const cors = { 'access-control-allow-origin': '*' };
        if (url.hostname === 'cdn.jsdelivr.net' && url.pathname.endsWith('.png')) return route.fulfill({ body: PNG_1PX, contentType: 'image/png', headers: cors });
        if (url.hostname === 'cdn.jsdelivr.net' && url.pathname.endsWith('.svg')) return route.fulfill({ body: SVG, contentType: 'image/svg+xml', headers: cors });
        return route.abort();
      });
      page.on('pageerror', (e) => found.push(`pageerror: ${e.message}`));
      page.on('console', (m) => {
        if (/Content Security Policy|Refused to|violates the following/i.test(m.text())) found.push(`console: ${m.text().slice(0, 300)}`);
      });
      await use(found);
      expect(found, 'violazioni della Content-Security-Policy').toEqual([]);
    },
    { auto: true },
  ],
});

/** A tool of the editor: in the toolbars, in the top bar, or under «Altro». */
async function tool(page: Page, name: string) {
  const places = [
    page.getByRole('navigation', { name: 'Strumenti' }),
    page.getByRole('toolbar', { name: 'Concetto scelto' }),
    page.locator('.topbar'),
  ];
  for (const place of places) {
    const button = place.getByRole('button', { name, exact: true });
    if (await button.isVisible()) return button.click();
  }
  await places[0].getByRole('button', { name: 'Altro', exact: true }).click();
  await page.getByRole('dialog', { name: 'Altro' }).getByRole('button', { name, exact: true }).click();
}

async function newMap(page: Page, title: string) {
  await page.goto('/');
  await page.getByRole('button', { name: 'Nuova mappa' }).click();
  await page.getByPlaceholder("es. Il ciclo dell'acqua").fill(title);
  await page.locator('.template-pick', { hasText: 'Libera' }).click();
  await page.getByRole('button', { name: 'Crea' }).click();
  await expect(page.locator('.title-input')).toHaveValue(title);
}

const concept = (page: Page, label: string) => page.locator('.concept-node').filter({ has: page.locator('.concept-label', { hasText: label }) });

/** What a download holds. */
async function downloaded(page: Page, click: () => Promise<void>) {
  const download = page.waitForEvent('download');
  await click();
  const d = await download;
  return { name: d.suggestedFilename(), bytes: await readFile((await d.path())!) };
}

// Vitest also takes every *.spec.ts (vite.config.ts leaves out e2e/ only): there this file is just a placeholder.
if (process.env.VITEST) {
  const { it } = await import('vitest');
  it.skip('e2e-csp è fatto per Playwright: npm run test:csp', () => {});
} else {
  test.describe('Content-Security-Policy del sito vero', () => {
    test('le intestazioni di vercel.json arrivano sulla pagina, sugli script e sul service worker', async ({ page, request }) => {
      const home = await page.goto('/');
      const asset = readdirSync(join(root, 'dist/assets')).find((f) => f.endsWith('.js'))!;
      for (const response of [home!, await request.get('/sw.js'), await request.get(`/assets/${asset}`)]) {
        expect(response.status()).toBe(200);
        for (const { key, value } of everywhere) expect(response.headers()[key.toLowerCase()], `${key} su ${response.url()}`).toBe(value);
      }
      expect(everywhere.find((h) => h.key === 'Content-Security-Policy')?.value).toContain("script-src 'self'");
    });

    test('prova della prova: uno script scritto in pagina viene davvero bloccato e visto', async ({ page, violations }) => {
      await page.goto('/');
      await page.evaluate(() => {
        const s = document.createElement('script');
        s.textContent = 'window.__ran = true';
        document.head.append(s);
      });
      await expect.poll(() => violations.length).toBeGreaterThan(0);
      expect(violations[0]).toContain('script-src');
      expect(await page.evaluate(() => (window as unknown as { __ran?: boolean }).__ran)).toBeUndefined();
      // Expected here: not a failure.
      violations.length = 0;
    });

    test('dall’elenco al PDF: nuova mappa, un concetto, Salva e manda', async ({ page }) => {
      await newMap(page, 'Il vulcano');
      // «Concetto» adds under the concept in hand: the main one.
      await concept(page, 'Il vulcano').click();
      await page.getByRole('button', { name: 'Concetto', exact: true }).click();
      const input = page.getByRole('textbox', { name: 'Testo del concetto' });
      await expect(input).toBeFocused();
      await input.fill('Lava');
      await input.press('Enter');
      await expect(concept(page, 'Lava')).toBeVisible();

      await tool(page, 'Salva e manda');
      const dialog = page.getByRole('dialog', { name: 'Salva e manda' });
      await dialog.getByRole('button', { name: /^PDF da stampare/ }).click();
      const pdf = await downloaded(page, () => dialog.getByRole('button', { name: 'Salva', exact: true }).click());
      expect(pdf.name).toBe('il-vulcano.pdf');
      expect(pdf.bytes.subarray(0, 5).toString()).toBe('%PDF-');

      // The picture and the editable file take other paths (an SVG drawn to a canvas, a file made in memory).
      if (!(await dialog.isVisible())) await tool(page, 'Salva e manda');
      await dialog.getByRole('button', { name: /^Immagine/ }).click();
      const png = await downloaded(page, () => dialog.getByRole('button', { name: 'Salva', exact: true }).click());
      expect(png.bytes.subarray(1, 4).toString()).toBe('PNG');

      if (!(await dialog.isVisible())) await tool(page, 'Salva e manda');
      await dialog.getByRole('button', { name: /^File modificabile/ }).click();
      const file = await downloaded(page, () => dialog.getByRole('button', { name: 'Salva', exact: true }).click());
      expect(file.name).toMatch(/\.mappami$/);
      expect(JSON.parse(file.bytes.toString()).map.title).toBe('Il vulcano');
    });

    test('«Immagine e colore», scheda Illustrazioni: la scelta finisce dentro la mappa', async ({ page }) => {
      await newMap(page, 'Il vulcano');
      await concept(page, 'Il vulcano').click();
      await tool(page, 'Immagine');
      await expect(page.getByRole('button', { name: /Illustrazioni/ })).toHaveAttribute('aria-pressed', 'true');
      await page.getByRole('searchbox', { name: "Cerca un'immagine" }).fill('vulcano');
      const tile = page.getByRole('button', { name: 'vulcano', exact: true });
      // The mocked picture really loaded (an image blocked by img-src would stay empty).
      await expect(tile.locator('img')).toBeVisible();
      await expect.poll(() => tile.locator('img').evaluate((i: HTMLImageElement) => i.complete && i.naturalWidth)).toBeGreaterThan(0);
      await tile.click();
      await expect(concept(page, 'Il vulcano').locator('.concept-illustration')).toHaveAttribute('src', /^data:image\/png;base64,/);
    });

    test('la pagina «Come installare» si carica e si legge senza violazioni', async ({ page }) => {
      const response = await page.goto('/installa.html');
      expect(response?.status()).toBe(200);
      await expect(page.getByRole('heading', { level: 1, name: 'Come installare MappAmi' })).toBeVisible();
      await page.getByRole('link', { name: 'iPad e iPhone' }).click();
      await expect(page.locator('#ipad')).toBeInViewport();
    });

    test.describe('con il service worker', () => {
      test.use({ serviceWorkers: 'allow' });

      test('il service worker parte e il manifest si legge', async ({ page }) => {
        await page.goto('/');
        // worker-src 'self', the worker's own scripts (workbox) and the manifest all pass the policy.
        await expect.poll(() => page.evaluate(async () => (await navigator.serviceWorker.ready).active?.state)).toBe('activated');
        const manifest = await page.request.get('/manifest.webmanifest');
        expect(manifest.headers()['content-type']).toContain('manifest+json');
        expect((await manifest.json()).short_name).toBe('MappAmi');
        await expect(page.getByRole('button', { name: 'Nuova mappa' })).toBeVisible();
      });
    });
  });
}
