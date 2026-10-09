import { test, expect } from './fixtures';
import { newMap, node, rename } from './helpers';

test('Aspetto: carattere, sfondo e maiuscolo si applicano e restano dopo aver ricaricato', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Aspetto' }).click();
  const panel = page.getByRole('dialog', { name: 'Aspetto e voce' });
  await panel.getByRole('button', { name: 'Atkinson' }).click();
  await panel.getByRole('button', { name: 'Scuro' }).click();
  await panel.getByLabel('TUTTO IN STAMPATELLO MAIUSCOLO').check();
  const html = page.locator('html');
  await expect(html).toHaveAttribute('data-font', 'atkinson');
  await expect(html).toHaveAttribute('data-theme', 'scuro');
  await expect(html).toHaveAttribute('data-uppercase', 'true');
  await panel.getByRole('button', { name: 'Chiudi' }).click();
  await page.reload();
  await expect(html).toHaveAttribute('data-theme', 'scuro');
  await expect(html).toHaveAttribute('data-font', 'atkinson');
  await expect(html).toHaveAttribute('data-uppercase', 'true');
});

test('Testo grande in stampatello: le parole lunghe di un concetto non vanno a capo a metà', async ({ page }) => {
  await page.addInitScript(() => {
    if (!localStorage.getItem('mappeora-settings')) {
      const state = { font: 'lexend', textScale: 1.8, uppercase: true, wideSpacing: true, theme: 'crema' };
      localStorage.setItem('mappeora-settings', JSON.stringify({ state, version: 1 }));
    }
  });
  await newMap(page, 'Acqua');
  await rename(page, 'Acqua', 'La precipitazione');
  const words = await node(page, 'La precipitazione')
    .locator('.concept-label')
    .evaluate((label) => {
      // One box per line the word is drawn on.
      const text = label.firstChild!;
      const at = (label.textContent ?? '').indexOf('precipitazione');
      const range = document.createRange();
      range.setStart(text, at);
      range.setEnd(text, at + 'precipitazione'.length);
      return new Set([...range.getClientRects()].map((r) => Math.round(r.top))).size;
    });
  expect(words).toBe(1);
});

test('Aspetto: i cursori dicono quanto valgono', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Aspetto' }).click();
  const panel = page.getByRole('dialog', { name: 'Aspetto e voce' });
  await expect(panel.getByText('Grandezza testo: 115%')).toBeVisible();
  await expect(panel.getByText('Velocità della voce: normale (0,9×)')).toBeVisible();
  await panel.getByRole('slider', { name: /Velocità della voce/ }).fill('0.6');
  await expect(panel.getByText('Velocità della voce: lenta (0,6×)')).toBeVisible();
});
