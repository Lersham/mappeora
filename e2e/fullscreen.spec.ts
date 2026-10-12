import { test, expect } from './fixtures';
import { newMap, sampleMap, toolbar } from './helpers';

const inFullscreen = (page: import('@playwright/test').Page) => page.evaluate(() => !!document.fullscreenElement);
/** Playwright's WebKit has no Fullscreen API (nor has Safari on iPhone): there the button is not shown, as tested below. */
const NO_FULLSCREEN = 'il WebKit di Playwright non ha lo schermo intero';

test.describe('Schermo intero', () => {
  test('dall’elenco si entra e si esce con lo stesso pulsante, che dice cosa farà', async ({ page, browserName }) => {
    test.skip(browserName === 'webkit', NO_FULLSCREEN);
    await page.goto('/');
    await page.getByRole('button', { name: 'Schermo intero', exact: true }).click();
    await expect.poll(() => inFullscreen(page)).toBe(true);
    await page.getByRole('button', { name: 'Esci da schermo intero', exact: true }).click();
    await expect.poll(() => inFullscreen(page)).toBe(false);
    await expect(page.getByRole('button', { name: 'Schermo intero', exact: true })).toBeVisible();
  });

  test('senza schermo intero nel browser il pulsante non c’è', async ({ page, browserName }) => {
    test.skip(browserName === 'webkit', 'su iPhone e iPad il pulsante c’è sempre: spiega la schermata Home (test sotto)');
    await page.addInitScript(() => {
      for (const k of ['fullscreenEnabled', 'webkitFullscreenEnabled']) Object.defineProperty(document, k, { value: false });
    });
    await page.goto('/');
    await expect(page.getByRole('button', { name: 'Come funziona' })).toBeVisible();
    await expect(page.getByRole('button', { name: /schermo intero/i })).toHaveCount(0);
  });

  test('nell’editor il pulsante c’è (sul telefono sotto «Altro») e un dialogo funziona a schermo intero', async ({ page, browserName }) => {
    test.skip(browserName === 'webkit', NO_FULLSCREEN);
    await newMap(page, 'Le stagioni');
    await toolbar(page, 'Schermo intero');
    await expect.poll(() => inFullscreen(page)).toBe(true);
    await toolbar(page, 'Aspetto');
    await expect(page.getByRole('dialog')).toBeVisible();
    await page.keyboard.press('Escape');
    await toolbar(page, 'Esci da schermo intero');
    await expect.poll(() => inFullscreen(page)).toBe(false);
  });

  test('l’Interrogazione entra a schermo intero da sola e lo lascia uscendo', async ({ page, browserName }) => {
    test.skip(browserName === 'webkit', NO_FULLSCREEN);
    await sampleMap(page);
    await toolbar(page, 'Ripassa');
    await page.getByRole('button', { name: /^Interrogazione/ }).click();
    await expect.poll(() => inFullscreen(page)).toBe(true);
    await page.getByRole('button', { name: 'Esci', exact: true }).click();
    await expect.poll(() => inFullscreen(page)).toBe(false);
  });

  test('se il bambino era già a schermo intero, l’Interrogazione non lo toglie uscendo', async ({ page, browserName }) => {
    test.skip(browserName === 'webkit', NO_FULLSCREEN);
    await sampleMap(page);
    await toolbar(page, 'Schermo intero');
    await expect.poll(() => inFullscreen(page)).toBe(true);
    await toolbar(page, 'Ripassa');
    await page.getByRole('button', { name: /^Interrogazione/ }).click();
    await expect(page.locator('.present-caption')).toBeVisible();
    await page.getByRole('button', { name: 'Esci', exact: true }).click();
    await expect(page.locator('.present-caption')).toHaveCount(0);
    expect(await inFullscreen(page)).toBe(true);
    await toolbar(page, 'Esci da schermo intero');
    await expect.poll(() => inFullscreen(page)).toBe(false);
  });
});

test.describe('Schermo intero su iPhone e iPad', () => {
  test.use({ userAgent: 'Mozilla/5.0 (iPad; CPU OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1' });

  test('il pulsante spiega la schermata Home: quello di Safari si chiude con uno swipe, anche spostando la mappa', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('button', { name: 'Schermo intero', exact: true }).click();
    const hint = page.getByRole('dialog', { name: 'Schermo intero' });
    await expect(hint).toContainText('Aggiungi alla schermata Home');
    await hint.getByRole('button', { name: 'Ho capito' }).click();
    await expect(hint).toHaveCount(0);
    expect(await inFullscreen(page)).toBe(false);

    // The same in the editor; the Interrogazione no longer goes to Safari's on its own.
    await sampleMap(page);
    await toolbar(page, 'Schermo intero');
    await expect(hint).toContainText('Aggiungi alla schermata Home');
    await hint.getByRole('button', { name: 'Ho capito' }).click();
    await toolbar(page, 'Ripassa');
    await page.getByRole('button', { name: /^Interrogazione/ }).click();
    await expect(page.locator('.present-caption')).toBeVisible();
    expect(await inFullscreen(page)).toBe(false);
  });
});
