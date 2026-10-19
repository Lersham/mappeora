import AxeBuilder from '@axe-core/playwright';
import type { Page } from '@playwright/test';
import { test, expect } from './fixtures';
import { sampleMap, toolbar } from './helpers';

/** Every problem axe finds, whatever its weight: the page is short and static. */
async function problems(page: Page) {
  const { violations } = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa', 'best-practice']).analyze();
  return violations.map((v) => `${v.id}: ${v.help} → ${v.nodes.slice(0, 3).map((n) => n.target.join(' ')).join(' | ')}`);
}

/** The same, for the app's own screens: only what blocks or seriously hinders. */
async function seriousProblems(page: Page) {
  const { violations } = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa']).analyze();
  return violations.filter((v) => v.impact === 'serious' || v.impact === 'critical').map((v) => `${v.id}: ${v.help} → ${v.nodes.slice(0, 3).map((n) => n.target.join(' ')).join(' | ')}`);
}

test.describe('Come installare MappAmi (public/installa.html)', () => {
  test('ha titolo, descrizione e indirizzo canonico, e ogni dispositivo ha la sua sezione', async ({ page }) => {
    await page.goto('/installa.html');
    await expect(page.locator('html')).toHaveAttribute('lang', 'it');
    const title = await page.title();
    expect(title.length).toBeLessThanOrEqual(60);
    expect(title).toContain('MappAmi');
    expect(await page.locator('meta[name="description"]').getAttribute('content')).toMatch(/iPad/);
    await expect(page.locator('link[rel="canonical"]')).toHaveAttribute('href', 'https://mapp-ami.vercel.app/installa.html');
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Come installare MappAmi');
    for (const id of ['ipad', 'android', 'chromebook', 'computer', 'lim']) {
      await expect(page.locator(`section#${id}`)).toBeVisible();
      await expect(page.locator(`section#${id} h2`)).toHaveCount(1);
    }
    // The way back into the app.
    await expect(page.getByRole('link', { name: 'Apri MappAmi' }).first()).toHaveAttribute('href', '/');
  });

  test('iPad: dice cosa toccare, perché, e di salvare le mappe', async ({ page }) => {
    await page.goto('/installa.html');
    const ipad = page.locator('#ipad');
    await expect(ipad).toContainText('Condividi');
    await expect(ipad).toContainText('«Aggiungi alla schermata Home»');
    await expect(ipad).toContainText('dalla sua icona');
    await expect(ipad).toContainText('nessun sito può spegnerlo');
    await expect(ipad).toContainText('7 giorni');
    await expect(ipad).toContainText('«Salva tutte le mappe»');
    await expect(page.locator('#android')).toContainText('«Installa app»');
    await expect(page.locator('#android')).toContainText('«Aggiungi a schermata Home»');
    await expect(page.locator('#chromebook')).toContainText('«Installa»');
    await expect(page.locator('#computer')).toContainText('«Installa MappAmi»');
    await expect(page.locator('#lim')).toContainText('«Solo la mappa»');
    await expect(page.locator('#lim')).toContainText('«Interrogazione»');
  });

  test('non chiede niente fuori dal sito: nessuna richiesta esterna', async ({ page }) => {
    const outside: string[] = [];
    page.on('request', (r) => {
      if (!/^(http:\/\/localhost[:/]|data:|blob:)/.test(r.url())) outside.push(r.url());
    });
    await page.goto('/installa.html');
    await page.waitForLoadState('networkidle');
    expect(outside).toEqual([]);
  });

  test('si arriva dritti alla sezione con l’ancora (#ipad) e si evidenzia', async ({ page }) => {
    await page.goto('/installa.html#ipad');
    await expect(page.locator('#ipad')).toBeInViewport();
    await expect(page.locator('#ipad')).toHaveCSS('border-top-color', 'rgb(43, 84, 176)');
  });

  test('si usa con la tastiera: i collegamenti si raggiungono e si vedono', async ({ page, isMobile }) => {
    test.skip(isMobile, 'la tastiera si prova sul computer');
    await page.goto('/installa.html');
    const seen: string[] = [];
    for (let i = 0; i < 6; i++) {
      await page.keyboard.press('Tab');
      const focused = await page.evaluate(() => {
        const el = document.activeElement as HTMLElement;
        return { text: el.textContent?.trim() ?? '', outline: getComputedStyle(el).outlineStyle };
      });
      expect(focused.outline, `contorno visibile su «${focused.text}»`).not.toBe('none');
      seen.push(focused.text);
    }
    expect(seen).toEqual(['Apri MappAmi', 'iPad e iPhone', 'Tablet e telefono Android', 'Chromebook', 'Computer', 'LIM']);
    await page.keyboard.press('Enter');
    await expect(page.locator('#lim')).toBeInViewport();
  });

  test('senza problemi di accessibilità, col tema chiaro e con quello scuro', async ({ page }) => {
    await page.emulateMedia({ colorScheme: 'light' });
    await page.goto('/installa.html');
    expect(await problems(page)).toEqual([]);
    await page.emulateMedia({ colorScheme: 'dark' });
    expect(await problems(page)).toEqual([]);
  });

  test('sul telefono non scorre di lato e il testo è grande', async ({ page, isMobile }) => {
    test.skip(!isMobile, 'solo sul telefono');
    await page.goto('/installa.html');
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    expect(await page.evaluate(() => parseFloat(getComputedStyle(document.body).fontSize))).toBeGreaterThanOrEqual(18);
  });
});

test.describe('«Guarda come si fa» nell’avviso dello schermo intero', () => {
  test.use({ userAgent: 'Mozilla/5.0 (iPad; CPU OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1' });

  test('apre la pagina «Come installare» sull’iPad, in un’altra scheda', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('button', { name: 'Schermo intero', exact: true }).click();
    const hint = page.getByRole('dialog', { name: 'Schermo intero' });
    const link = hint.getByRole('link', { name: 'Guarda come si fa' });
    // The window covers the whole screen: from the header of the home it was a strip of 60 px.
    const [box, view] = [await hint.boundingBox(), page.viewportSize()!];
    expect([box?.x, box?.y, box?.width, box?.height]).toEqual([0, 0, view.width, view.height]);
    await expect(link).toBeInViewport({ ratio: 1 });
    await expect(link).toHaveAttribute('href', '/installa.html#ipad');
    await expect(link).toHaveAttribute('target', '_blank');
    // A screen reader is told that it leaves this window; the child sees only «Guarda come si fa».
    await expect(link).toHaveAccessibleName(/si apre in un’altra scheda/);
    await expect(link).toHaveAttribute('rel', /noopener/);
    expect(await seriousProblems(page)).toEqual([]);
    // The dialog keeps its place: the child comes back to it.
    const popup = page.waitForEvent('popup');
    await link.click();
    const guide = await popup;
    await expect(guide.locator('#ipad')).toBeVisible();
    expect(new URL(guide.url()).pathname).toBe('/installa.html');
    await expect(hint).toBeVisible();
    await hint.getByRole('button', { name: 'Ho capito' }).click();
    await expect(hint).toHaveCount(0);
  });

  test('anche dall’editor, senza lasciare la mappa', async ({ page }) => {
    await sampleMap(page);
    await toolbar(page, 'Schermo intero');
    const hint = page.getByRole('dialog', { name: 'Schermo intero' });
    await expect(hint.getByRole('link', { name: 'Guarda come si fa' })).toHaveAttribute('href', '/installa.html#ipad');
    await hint.getByRole('button', { name: 'Ho capito' }).click();
    await expect(page.locator('.title-input')).toHaveValue('Il ciclo dell’acqua');
  });
});
