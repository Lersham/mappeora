import { readFile } from 'node:fs/promises';
import { test, expect } from './fixtures';
import { newMap } from './helpers';

test.describe('Copia di sicurezza', () => {
  test('«Salva tutte le mappe» fa un file solo; «Apri file» le rimette, senza doppioni', async ({ page }) => {
    for (const title of ['Le stagioni', 'Gli animali', 'Il ciclo dell’acqua']) await newMap(page, title);
    await page.getByRole('button', { name: 'Mappe' }).click();
    await expect(page.locator('.map-card')).toHaveCount(3);

    // Three maps and never a copy: the reminder shows, with its button.
    const reminder = page.getByRole('region', { name: 'Copia di sicurezza' });
    await expect(reminder).toContainText('Fai una copia delle tue mappe');
    const download = page.waitForEvent('download');
    await reminder.getByRole('button', { name: 'Salva tutte le mappe' }).click();
    // The file's contents, not its path: this test's folder has «» in its name.
    const buffer = await readFile((await (await download).path())!);
    expect((await download).suggestedFilename()).toMatch(/^mappami-tutte-le-mappe-\d{4}-\d{2}-\d{2}\.mappami$/);
    const json = JSON.parse(buffer.toString('utf8'));
    expect(json.format).toBe('mappeora-archivio');
    expect(json.maps.map((m: { title: string }) => m.title).sort()).toEqual(['Gli animali', 'Il ciclo dell’acqua', 'Le stagioni']);
    await expect(page.getByRole('status')).toContainText('Ho salvato 3 mappe');
    // Done: the reminder makes room for the quiet card at the bottom.
    await expect(page.getByText('Fai una copia delle tue mappe')).toHaveCount(0);

    // One map is lost...
    page.once('dialog', (d) => void d.accept());
    await page.getByRole('button', { name: 'Cancella Gli animali' }).click();
    await expect(page.locator('.map-card')).toHaveCount(2);

    // ...and comes back from the copy; the other two are not doubled.
    const chooser = page.waitForEvent('filechooser');
    await page.getByRole('button', { name: 'Apri file' }).click();
    await (await chooser).setFiles({ name: 'copia.mappeora', mimeType: 'application/json', buffer });
    await expect(page.getByRole('status')).toHaveText('Ho ritrovato 1 mappa (2 c’erano già).');
    await expect(page.locator('.map-card')).toHaveCount(3);
    await expect(page.locator('.map-title')).toContainText(['Gli animali']);
  });

  test('«Più tardi» rimanda il promemoria', async ({ page }) => {
    for (const title of ['Uno', 'Due', 'Tre']) await newMap(page, title);
    await page.getByRole('button', { name: 'Mappe' }).click();
    await page.getByRole('button', { name: 'Più tardi' }).click();
    await expect(page.getByText('Fai una copia delle tue mappe')).toHaveCount(0);
    await page.reload();
    await expect(page.locator('.map-card')).toHaveCount(3);
    await expect(page.getByText('Fai una copia delle tue mappe')).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Salva tutte le mappe' })).toBeVisible();
  });

  test('su iPhone e iPad, fuori dalla schermata Home, consiglia di aggiungerla', async ({ browser }) => {
    const context = await browser.newContext({
      userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1',
      viewport: { width: 390, height: 844 },
      serviceWorkers: 'block',
    });
    await context.addInitScript(() => localStorage.setItem('mappeora-welcome', 'visto'));
    const page = await context.newPage();
    await page.goto('/');
    const hint = page.getByRole('region', { name: 'Consiglio per iPhone e iPad' });
    await expect(hint).toContainText('Aggiungi alla schermata Home');
    await hint.getByRole('button', { name: 'Ho capito' }).click();
    await expect(hint).toHaveCount(0);
    await page.reload();
    await expect(page.getByRole('region', { name: 'Consiglio per iPhone e iPad' })).toHaveCount(0);
    await context.close();
  });
});
