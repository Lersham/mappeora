import type { Locator } from '@playwright/test';
import { test, expect } from './fixtures';
import { drawnBadly, newMap, node, rename, toolbar } from './helpers';

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

test('OpenDyslexic: si sceglie in Aspetto e il carattere arriva davvero', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Aspetto' }).click();
  await page.getByRole('dialog', { name: 'Aspetto e voce' }).getByRole('button', { name: 'OpenDyslexic' }).click();
  await expect(page.locator('html')).toHaveAttribute('data-font', 'opendyslexic');
  // Not a stand-in: the font file itself is loaded.
  await expect
    .poll(() => page.evaluate(() => [...document.fonts].some((f) => f.family.replace(/"/g, '') === 'OpenDyslexic' && f.status === 'loaded')))
    .toBe(true);
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

test('Testo grande, OpenDyslexic e spaziatura ampia: le finestre di scelta restano dentro lo schermo', async ({ page }) => {
  await page.addInitScript(() => {
    if (!localStorage.getItem('mappeora-settings')) {
      const state = { font: 'opendyslexic', textScale: 1.8, uppercase: true, wideSpacing: true, theme: 'crema' };
      localStorage.setItem('mappeora-settings', JSON.stringify({ state, version: 1 }));
    }
  });
  // Measured with the real font, not the one shown while it loads.
  const fits = async (dialog: Locator) => {
    await expect(dialog).toBeVisible();
    await page.evaluate(() => document.fonts.ready);
    return dialog.locator('.overlay-card').evaluate((card) => card.scrollWidth <= card.clientWidth + 1);
  };
  await page.goto('/');
  await page.getByRole('button', { name: 'Nuova mappa' }).click();
  const create = page.getByRole('dialog', { name: 'Nuova mappa' });
  expect(await fits(create)).toBe(true);
  await create.getByRole('button', { name: 'Crea' }).click();
  await page.getByRole('navigation', { name: 'Strumenti' }).getByRole('button', { name: 'Ripassa', exact: true }).click();
  expect(await fits(page.getByRole('dialog', { name: 'Ripassa' }))).toBe(true);
});

test('Testo grande, OpenDyslexic e spaziatura ampia: in nessuna schermata parole spezzate, tagliate o pulsanti uno sopra l’altro', async ({
  page,
  isMobile,
}) => {
  test.slow();
  // On a computer: the size of a tablet held sideways, where it was seen.
  if (!isMobile) await page.setViewportSize({ width: 1024, height: 768 });
  await page.addInitScript(() => {
    if (!localStorage.getItem('mappeora-settings')) {
      const state = { font: 'opendyslexic', textScale: 1.8, uppercase: true, wideSpacing: true, theme: 'crema' };
      localStorage.setItem('mappeora-settings', JSON.stringify({ state, version: 1 }));
    }
  });
  const looks = async (where: string) => {
    await page.evaluate(() => document.fonts.ready);
    // Windows slide in: measured where they stop.
    await expect.poll(() => drawnBadly(page), { message: where, intervals: [300, 300, 500] }).toEqual([]);
  };
  const close = async (name: string) => {
    await page.keyboard.press('Escape');
    await expect(page.getByRole('dialog', { name })).toHaveCount(0);
  };

  await page.goto('/');
  await page.getByRole('button', { name: 'Esempi', exact: true }).click();
  await looks('Esempi');
  await page.getByRole('button', { name: /^La Rivoluzione francese/ }).click();
  await expect(page.locator('.concept-node')).toHaveCount(37);
  await looks('la mappa');
  const bar = page.getByRole('navigation', { name: 'Strumenti' });
  if (await bar.getByRole('button', { name: 'Altro', exact: true }).isVisible()) {
    await bar.getByRole('button', { name: 'Altro', exact: true }).click();
    await looks('Altro');
    await close('Altro');
  }
  for (const [tool, dialog] of [
    ['Ripassa', 'Ripassa'],
    ['Salva', 'Salva, esporta o stampa'],
    ['Scaletta', 'Scaletta'],
    ['Aspetto', 'Aspetto e voce'],
  ]) {
    await toolbar(page, tool);
    await expect(page.getByRole('dialog', { name: dialog })).toBeVisible();
    await looks(dialog);
    await close(dialog);
  }
  await page.locator('.react-flow__edge').first().locator('.react-flow__edge-interaction').last().dispatchEvent('click');
  await looks('Parola di collegamento');
  await close('Parola di collegamento');
  await toolbar(page, 'Ripassa');
  await page.getByRole('button', { name: /^Interrogazione/ }).click();
  await looks('Interrogazione');

  await page.goto('/');
  await looks('le mie mappe');
  await page.getByRole('button', { name: 'Nuova mappa' }).click();
  await looks('Nuova mappa');
  await close('Nuova mappa');
  await page.getByRole('button', { name: 'Impara facendo' }).click();
  await expect(page.getByText('Passo 1 di')).toBeVisible();
  await looks('Impara facendo');
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
