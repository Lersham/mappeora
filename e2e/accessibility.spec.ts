import AxeBuilder from '@axe-core/playwright';
import { test, expect } from './fixtures';
import { newMap, node, nodes, toolbar } from './helpers';

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

  test('crediti e licenze', async ({ page }) => {
    await page.goto('/crediti.html');
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

test.describe('Tastiera', () => {
  test('Esc chiude il dialogo e il fuoco torna al pulsante che l’ha aperto', async ({ page, isMobile }) => {
    test.skip(isMobile, 'on a phone «Aspetto» is under «Altro», which closes');
    await newMap(page, 'I vulcani');
    await toolbar(page, 'Aspetto');
    const settings = page.getByRole('dialog', { name: 'Aspetto e voce' });
    await expect(settings).toBeVisible();
    await expect(settings).toBeFocused();
    await page.keyboard.press('Escape');
    await expect(settings).toHaveCount(0);
    await expect(page.locator('.topbar').getByRole('button', { name: 'Aspetto', exact: true })).toBeFocused();
  });

  test('Invio su un collegamento apre la parola di collegamento', async ({ page }) => {
    await newMap(page, 'Il sistema solare', 'Le 5 W');
    const link = page.getByRole('group', { name: /^Collegamento da «Il sistema solare»/ }).first();
    await link.focus();
    await page.keyboard.press('Enter');
    const dialog = page.getByRole('dialog', { name: 'Parola di collegamento' });
    await expect(dialog).toBeVisible();
    await page.keyboard.type('ha');
    await dialog.getByRole('button', { name: 'Fatto' }).click();
    await expect(page.getByRole('group', { name: /^Collegamento da «Il sistema solare» a .*: ha$/ })).toHaveCount(1);
  });

  test('Scaletta: Esc dopo aver scritto chiede prima di perdere le righe', async ({ page }) => {
    await newMap(page, 'Le piante');
    await toolbar(page, 'Scaletta');
    const outline = page.getByRole('dialog', { name: 'Scaletta' });
    await outline.getByRole('button', { name: 'Nuova riga', exact: true }).click();
    await page.keyboard.type('Radici');
    page.once('dialog', (d) => void d.dismiss());
    await page.keyboard.press('Escape');
    await expect(outline).toBeVisible();
    await expect(outline.locator('.outline-input').nth(1)).toHaveValue('Radici');
    page.once('dialog', (d) => void d.accept());
    await page.keyboard.press('Escape');
    await expect(outline).toHaveCount(0);
    await expect(nodes(page)).toHaveCount(1);
  });
});
