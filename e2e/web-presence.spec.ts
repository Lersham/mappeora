import { readFile } from 'node:fs/promises';
import AxeBuilder from '@axe-core/playwright';
import type { Page } from '@playwright/test';
import { test, expect } from './fixtures';

/**
 * What search engines, share previews and the first second of the app see:
 * robots.txt, sitemap, the static pages (presentazione, privacy, crediti), the
 * look of the child on them, and the first paint of the app itself.
 */

// privacy.html is the owner's text and is left as it was: it does not follow the child's look.
const THEMED_PAGES = ['/mappe-concettuali-dsa.html', '/crediti.html', '/installa.html'];
const STATIC_PAGES = [...THEMED_PAGES, '/privacy.html'];
const DARK_BG = 'rgb(29, 33, 41)'; // --bg of «scuro» in theme.css
const CREAM_BG = 'rgb(253, 248, 236)';
const WHITE_BG = 'rgb(255, 255, 255)';

const SCURO = { state: { font: 'opendyslexic', textScale: 1.5, uppercase: false, wideSpacing: true, theme: 'scuro' }, version: 1 };

async function seed(page: Page, settings: unknown) {
  await page.addInitScript((value) => localStorage.setItem('mappeora-settings', JSON.stringify(value)), settings);
}

/** What <html> looked like at DOMContentLoaded: before React, whatever the app does later. */
async function recordAtDomContentLoaded(page: Page) {
  await page.addInitScript(() => {
    document.addEventListener('DOMContentLoaded', () => {
      const root = document.documentElement;
      (window as unknown as Record<string, unknown>).__atDcl = {
        theme: root.dataset.theme,
        font: root.dataset.font,
        scale: root.style.getPropertyValue('--text-scale'),
        background: root.style.backgroundColor,
        themeColor: document.querySelector('meta[name=theme-color]')?.getAttribute('content'),
      };
    });
  });
}
const atDcl = (page: Page) => page.evaluate(() => (window as unknown as Record<string, unknown>).__atDcl);

/** The security headers of Vercel (vercel.json) on the pages, like in production: `vite preview` has none. */
async function withVercelHeaders(page: Page) {
  const config = JSON.parse(await readFile('vercel.json', 'utf8')) as { headers: { source: string; headers: { key: string; value: string }[] }[] };
  const all = config.headers.find((h) => h.source === '/(.*)')!;
  const headers = Object.fromEntries(all.headers.map((h) => [h.key.toLowerCase(), h.value]));
  await page.route(
    (url) => url.hostname === 'localhost',
    async (route) => {
      if (route.request().resourceType() !== 'document') return route.fallback();
      const response = await route.fetch();
      await route.fulfill({ response, headers: { ...response.headers(), ...headers } });
    },
  );
}

const bodyBackground = (page: Page) => page.evaluate(() => getComputedStyle(document.body).backgroundColor);

/** WCAG 2.2 A/AA problems that block or seriously hinder someone (same as accessibility.spec.ts). */
async function seriousProblems(page: Page) {
  const { violations } = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa']).analyze();
  return violations
    .filter((v) => v.impact === 'serious' || v.impact === 'critical')
    .map((v) => `${v.id}: ${v.help} (${v.nodes.length}) → ${v.nodes.slice(0, 3).map((n) => n.target.join(' ')).join(' | ')}`);
}

test.describe('robots.txt, sitemap e immagine di anteprima', () => {
  test.skip(({ isMobile }) => isMobile, 'files served as they are: one run is enough');

  test('robots.txt lascia entrare tutti e indica la sitemap', async ({ request }) => {
    const response = await request.get('/robots.txt');
    expect(response.status()).toBe(200);
    expect(response.headers()['content-type']).toMatch(/^text\/plain/);
    const text = await response.text();
    expect(text).toMatch(/^User-agent: \*$/m);
    expect(text).toMatch(/^Allow: \/$/m);
    expect(text).toMatch(/^Sitemap: https:\/\/mapp-ami\.vercel\.app\/sitemap\.xml$/m);
  });

  test('sitemap.xml è XML e elenca la home e le pagine statiche', async ({ request }) => {
    const response = await request.get('/sitemap.xml');
    expect(response.status()).toBe(200);
    expect(response.headers()['content-type']).toMatch(/xml/);
    const text = await response.text();
    for (const loc of ['/', ...STATIC_PAGES]) expect(text).toContain(`<loc>https://mapp-ami.vercel.app${loc}</loc>`);
  });

  test('l’immagine di anteprima c’è, è un PNG 1200×630 e pesa poco', async ({ request }) => {
    const response = await request.get('/og-image.png');
    expect(response.status()).toBe(200);
    expect(response.headers()['content-type']).toBe('image/png');
    const png = await response.body();
    expect(png.subarray(1, 4).toString()).toBe('PNG');
    expect(png.readUInt32BE(16)).toBe(1200);
    expect(png.readUInt32BE(20)).toBe(630);
    expect(png.length).toBeLessThan(250 * 1024);
  });

  test('il manifest dell’app ha identità, categorie e direzione', async ({ request }) => {
    const manifest = await (await request.get('/manifest.webmanifest')).json();
    expect(manifest).toMatchObject({
      id: '/',
      short_name: 'MappAmi',
      lang: 'it',
      dir: 'ltr',
      categories: ['education', 'productivity'],
      prefer_related_applications: false,
    });
  });

  test('la pagina costruita ha titolo, descrizione, indirizzo canonico e anteprima', async ({ page }) => {
    await page.goto('/');
    await expect(page).toHaveTitle('MappAmi – mappe concettuali con la voce, anche per DSA');
    await expect(page.locator('link[rel=canonical]')).toHaveAttribute('href', 'https://mapp-ami.vercel.app/');
    await expect(page.locator('meta[property="og:image"]')).toHaveAttribute('content', 'https://mapp-ami.vercel.app/og-image.png');
    await expect(page.locator('meta[name=apple-mobile-web-app-title]')).toHaveAttribute('content', 'MappAmi');
    const html = await (await page.request.get('/')).text();
    expect(html.indexOf('/theme-init.js')).toBeGreaterThan(-1);
    expect(html.indexOf('/theme-init.js')).toBeLessThan(html.indexOf('type="module"'));
  });
});

test.describe('Pagina di presentazione', () => {
  test('si apre senza errori, con le regole di sicurezza di Vercel, e il pulsante porta all’app', async ({ page }) => {
    await withVercelHeaders(page);
    await page.goto('/mappe-concettuali-dsa.html');
    await expect(page).toHaveTitle('Mappe concettuali per DSA e dislessia | MappAmi');
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Mappe concettuali per bambini con DSA e per tutti gli studenti');
    // The data block for search engines is there, and it is valid.
    const data = await page.locator('script[type="application/ld+json"]').evaluate((el) => JSON.parse(el.textContent ?? ''));
    expect(data).toMatchObject({ '@type': 'WebApplication', applicationCategory: 'EducationalApplication', isAccessibleForFree: true });
    // The FAQ is on the page, not hidden.
    await expect(page.getByRole('heading', { name: 'È gratuita?' })).toBeVisible();
    await expect(page.getByText('Sì: niente pubblicità e nessun account')).toBeVisible();
    // No sideways scrolling, also on a phone.
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true);
    await page.getByRole('link', { name: 'Apri MappAmi' }).first().click();
    await expect(page).toHaveURL(/\/$/);
    await expect(page.getByRole('button', { name: 'Nuova mappa' })).toBeVisible();
  });

  test('non ha problemi gravi di accessibilità, in nessuno dei quattro sfondi', async ({ page }) => {
    await page.goto('/mappe-concettuali-dsa.html');
    expect(await seriousProblems(page)).toEqual([]);
    for (const theme of ['crema', 'bianco', 'azzurro', 'scuro']) {
      await page.evaluate((value) => localStorage.setItem('mappeora-settings', JSON.stringify({ state: { theme: value, textScale: 1.8, wideSpacing: true, uppercase: true, font: 'opendyslexic' }, version: 1 })), theme);
      await page.reload();
      await expect(page.locator('html')).toHaveAttribute('data-theme', theme);
      expect(await seriousProblems(page), theme).toEqual([]);
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth), `${theme}: scorrimento di lato`).toBe(true);
    }
  });

  test('i crediti si vedono bene negli sfondi scelti, anche con il testo più grande', async ({ page }) => {
    for (const theme of ['azzurro', 'scuro']) {
      await page.goto('/crediti.html');
      const state = { theme, textScale: 1.8, font: 'opendyslexic', uppercase: true, wideSpacing: true };
      await page.evaluate((value) => localStorage.setItem('mappeora-settings', JSON.stringify({ state: value, version: 1 })), state);
      await page.reload();
      expect(await seriousProblems(page), theme).toEqual([]);
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth), `${theme}: scorrimento di lato`).toBe(true);
    }
  });

  test('«Come installare» non scorre di lato, nemmeno su un telefono stretto col testo più grande', async ({ page }) => {
    // 320 px is the width WCAG 1.4.10 asks for; the slider of the app stops at 180%. The address «mapp-ami.vercel.app» is the widest word.
    for (const width of [320, 360, 390]) {
      await page.setViewportSize({ width, height: 700 });
      await page.goto('/installa.html');
      for (const textScale of [1.15, 1.5, 1.8]) {
        for (const uppercase of [false, true]) {
          const state = { theme: 'crema', font: 'opendyslexic', textScale, uppercase, wideSpacing: true };
          await page.evaluate((value) => localStorage.setItem('mappeora-settings', JSON.stringify({ state: value, version: 1 })), state);
          await page.reload();
          const where = `${width} px, testo ${Math.round(textScale * 100)}%${uppercase ? ', maiuscolo' : ''}`;
          expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth), `${where}: scorrimento di lato`).toBe(true);
          // Nothing sticks out of its card either: before, the address went past the edge of the steps without yet scrolling the page.
          const outside = await page.evaluate(() => [...document.querySelectorAll('section')].filter((s) => s.scrollWidth > s.clientWidth).map((s) => s.id));
          expect(outside, `${where}: sezioni con qualcosa fuori dal riquadro`).toEqual([]);
        }
      }
    }
  });

  test('la privacy resta com’è, senza errori, anche con un aspetto scelto nell’app', async ({ page }) => {
    await seed(page, SCURO);
    await page.goto('/privacy.html');
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Privacy');
    expect(await seriousProblems(page)).toEqual([]);
  });
});

test.describe('Le pagine statiche prendono l’aspetto scelto dal bambino', () => {
  for (const path of THEMED_PAGES) {
    test(`${path}: scuro, carattere grande e spaziatura ampia`, async ({ page }) => {
      await withVercelHeaders(page);
      await seed(page, SCURO);
      await page.goto(path);
      const html = page.locator('html');
      await expect(html).toHaveAttribute('data-theme', 'scuro');
      expect(await bodyBackground(page)).toBe(DARK_BG);
      expect(await page.evaluate(() => getComputedStyle(document.body).color)).toBe('rgb(241, 237, 228)');
      expect(await page.evaluate(() => getComputedStyle(document.documentElement).fontSize)).toBe('24px');
      expect(await page.evaluate(() => getComputedStyle(document.body).letterSpacing)).not.toBe('normal');
      expect(await page.evaluate(() => getComputedStyle(document.documentElement).colorScheme)).toBe('dark');
    });
  }

  test('senza impostazioni la pagina resta com’è, e segue la modalità scura del sistema', async ({ page }) => {
    await page.goto('/crediti.html');
    await expect(page.locator('html')).not.toHaveAttribute('data-theme', /.*/);
    expect(await bodyBackground(page)).toBe(CREAM_BG);
    await page.emulateMedia({ colorScheme: 'dark' });
    expect(await bodyBackground(page)).toBe('rgb(27, 33, 41)');
  });

  test('lo sfondo scelto nell’app vale più della modalità scura del sistema', async ({ page }) => {
    await seed(page, { state: { theme: 'crema' }, version: 1 });
    await page.emulateMedia({ colorScheme: 'dark' });
    await page.goto('/crediti.html');
    expect(await bodyBackground(page)).toBe(CREAM_BG);
  });

  test('un’impostazione rotta lascia la pagina com’è, senza errori', async ({ page }) => {
    await page.addInitScript(() => localStorage.setItem('mappeora-settings', '{"state": {"theme": "scu'));
    await page.goto('/crediti.html');
    await expect(page.locator('html')).not.toHaveAttribute('data-theme', /.*/);
    expect(await bodyBackground(page)).toBe(CREAM_BG);
  });

  test('la privacy ha ancora i due segnaposto per il titolare', async ({ page }) => {
    await page.goto('/privacy.html');
    await expect(page.locator('.todo')).toHaveText(['[nome del titolare: da completare]', '[indirizzo email: da completare]']);
  });

  test('la presentazione rimanda alla privacy e alla dettatura con internet', async ({ page }) => {
    await page.goto('/mappe-concettuali-dsa.html');
    const answer = page.getByRole('heading', { name: 'Serve internet?' }).locator('xpath=following-sibling::p[1]');
    await expect(answer).toContainText('dettare con il browser');
    await answer.getByRole('link', { name: 'Privacy' }).click();
    await expect(page).toHaveURL(/privacy\.html$/);
  });

  test('i crediti rimandano alla presentazione', async ({ page }) => {
    await page.goto('/crediti.html');
    await page.locator('footer').getByRole('link', { name: 'Che cos’è MappAmi' }).click();
    await expect(page).toHaveURL(/mappe-concettuali-dsa\.html$/);
  });
});

test.describe('Primo disegno dell’app con l’aspetto scelto', () => {
  test('con l’app ferma, la pagina ha già sfondo, carattere e colore della barra dello scuro', async ({ page }) => {
    await withVercelHeaders(page);
    await seed(page, SCURO);
    await recordAtDomContentLoaded(page);
    // Only the app's own scripts are held back: what is left is the page as the first paint shows it.
    await page.route('**/assets/*.js', (route) => route.abort());
    await page.goto('/');
    await expect(page.getByRole('status')).toHaveText('Sto caricando…');
    await expect(page.locator('#root')).toContainText('MappAmi');
    expect(await atDcl(page)).toEqual({ theme: 'scuro', font: 'opendyslexic', scale: '1.5', background: DARK_BG, themeColor: '#282d38' });
    // The shell keeps its inline style under the CSP.
    expect(await page.locator('#root > div').evaluate((el) => getComputedStyle(el).display)).toBe('flex');
  });

  test('con l’app avviata, a DOMContentLoaded il tema è già quello scelto e l’app si vede', async ({ page }) => {
    await withVercelHeaders(page);
    await seed(page, SCURO);
    await recordAtDomContentLoaded(page);
    await page.goto('/');
    await expect(page.getByRole('button', { name: 'Nuova mappa' })).toBeVisible();
    expect(await atDcl(page)).toMatchObject({ theme: 'scuro', font: 'opendyslexic', themeColor: '#282d38' });
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'scuro');
    expect(await bodyBackground(page)).toBe(DARK_BG);
  });

  test('il colore messo in anticipo su <html> sparisce, e cambiare sfondo dopo funziona', async ({ page }) => {
    await seed(page, SCURO);
    await page.goto('/');
    await expect(page.getByRole('button', { name: 'Nuova mappa' })).toBeVisible();
    // Gone once the page is loaded: the stylesheet and the app decide from there.
    await expect.poll(() => page.evaluate(() => document.documentElement.style.background)).toBe('');
    expect(await page.evaluate(() => getComputedStyle(document.documentElement).backgroundColor)).toBe('rgba(0, 0, 0, 0)');
    await page.getByRole('button', { name: 'Aspetto' }).click();
    const panel = page.getByRole('dialog', { name: 'Aspetto e voce' });
    await panel.getByRole('button', { name: 'Azzurro' }).click();
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'azzurro');
    expect(await bodyBackground(page)).toBe('rgb(234, 243, 251)');
    await panel.getByRole('button', { name: 'Crema' }).click();
    expect(await bodyBackground(page)).toBe(CREAM_BG);
    await panel.getByRole('button', { name: 'Scuro' }).click();
    expect(await bodyBackground(page)).toBe(DARK_BG);
  });

  test('senza impostazioni parte bianca, come l’app', async ({ page }) => {
    await recordAtDomContentLoaded(page);
    await page.route('**/assets/*.js', (route) => route.abort());
    await page.goto('/');
    expect(await atDcl(page)).toMatchObject({ background: WHITE_BG, themeColor: '#fff', theme: undefined, font: undefined, scale: '' });
  });

  test('con le impostazioni rotte l’app parte lo stesso', async ({ page }) => {
    await page.addInitScript(() => localStorage.setItem('mappeora-settings', 'non è JSON'));
    await page.goto('/');
    await expect(page.getByRole('button', { name: 'Nuova mappa' })).toBeVisible();
  });
});

test.describe('Service worker e pagine statiche', () => {
  test.use({ serviceWorkers: 'allow' });
  test.skip(({ isMobile }) => isMobile, 'the same worker runs on both: one run is enough');

  test('robots.txt, sitemap e pagine statiche non ricevono la pagina dell’app', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByRole('button', { name: 'Nuova mappa' })).toBeVisible();
    // Wait for the worker to be installed and in charge of the page.
    await page.evaluate(() => navigator.serviceWorker.ready.then(() => undefined));
    await page.reload();
    await expect.poll(() => page.evaluate(() => !!navigator.serviceWorker.controller)).toBe(true);

    for (const [path, text] of [
      ['/robots.txt', 'User-agent: *'],
      ['/sitemap.xml', '<urlset'],
      ['/og-image.png', ''],
    ] as const) {
      const body = await page.evaluate(async (p) => {
        // A navigation, the way the browser asks for a page; fetch() is not one.
        const frame = document.createElement('iframe');
        frame.src = p;
        document.body.append(frame);
        await new Promise((done) => frame.addEventListener('load', done, { once: true }));
        const doc = frame.contentDocument!;
        const result = { type: doc.contentType, text: doc.documentElement.outerHTML };
        frame.remove();
        return result;
      }, path);
      expect(body.text, path).not.toContain('id="root"');
      if (text) expect(body.text, path).toContain(text);
      else expect(body.type, path).toBe('image/png');
    }

    for (const [path, title] of [
      ['/privacy.html', 'Privacy – MappAmi'],
      ['/crediti.html', 'Crediti e licenze – MappAmi'],
      ['/mappe-concettuali-dsa.html', 'Mappe concettuali per DSA e dislessia | MappAmi'],
    ] as const) {
      await page.goto(path);
      await expect(page, path).toHaveTitle(title);
      await expect(page.locator('#root')).toHaveCount(0);
    }
    // A shared link often carries a tail (?ref=chat): it is still the page, not the app.
    for (const [path, title] of [
      ['/privacy.html?ref=chat', 'Privacy – MappAmi'],
      ['/mappe-concettuali-dsa.html?from=scuola', 'Mappe concettuali per DSA e dislessia | MappAmi'],
    ] as const) {
      await page.goto(path);
      await expect(page, path).toHaveTitle(title);
      await expect(page.locator('#root'), path).toHaveCount(0);
    }
    // And the app is still the app.
    await page.goto('/');
    await expect(page.getByRole('button', { name: 'Nuova mappa' })).toBeVisible();
  });

  test('l’immagine di anteprima, la sitemap e robots.txt non sono nella cache del worker', async ({ request }) => {
    const worker = await (await request.get('/sw.js')).text();
    // The precache list is made of {url:"…",revision:…} entries.
    const precached = [...worker.matchAll(/\{url:"([^"]+)"/g)].map((m) => m[1]);
    for (const file of ['og-image.png', 'sitemap.xml', 'robots.txt']) expect(precached).not.toContain(file);
    // The static pages are there: offline they open as themselves, not as the app.
    expect(precached).toEqual(expect.arrayContaining(['privacy.html', 'crediti.html', 'mappe-concettuali-dsa.html', 'theme-init.js', 'static-settings.js']));
    // And a navigation to any of these files never falls back to the app's page.
    expect(worker).toMatch(/denylist:\[[^\]]*robots[^\]]*sitemap[^\]]*\]/);
  });
});
