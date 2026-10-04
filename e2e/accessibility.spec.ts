import AxeBuilder from '@axe-core/playwright';
import { test, expect } from './fixtures';
import { newMap, node, toolbar } from './helpers';

/** WCAG 2.2 A/AA problems that block or seriously hinder someone. */
async function seriousProblems(page: import('@playwright/test').Page) {
  const { violations } = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa']).analyze();
  return violations
    .filter((v) => v.impact === 'serious' || v.impact === 'critical')
    .map((v) => `${v.id}: ${v.help} (${v.nodes.length}) → ${v.nodes.slice(0, 3).map((n) => n.target.join(' ')).join(' | ')}`);
}

test.describe('Accessibilità (axe-core)', () => {
  test('schermata iniziale', async ({ page }) => {
    await page.goto('/');
    expect(await seriousProblems(page)).toEqual([]);
  });

  test('informativa privacy', async ({ page }) => {
    await page.goto('/privacy.html');
    expect(await seriousProblems(page)).toEqual([]);
  });

  test('nuova mappa', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('button', { name: 'Nuova mappa' }).click();
    expect(await seriousProblems(page)).toEqual([]);
  });

  test('editor', async ({ page }) => {
    await newMap(page, 'Il sistema solare', 'Le 5 W');
    expect(await seriousProblems(page)).toEqual([]);
  });

  test('scelta dell’immagine', async ({ page }) => {
    await newMap(page, 'Il vulcano');
    await node(page, 'Il vulcano').click();
    await toolbar(page, 'Immagine');
    await expect(page.locator('.illustration-tile').first()).toBeVisible();
    expect(await seriousProblems(page)).toEqual([]);
  });
});
