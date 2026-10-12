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

  test('senza schermo intero nel browser il pulsante non c’è', async ({ page }) => {
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
