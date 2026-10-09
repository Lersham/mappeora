import { readFile } from 'node:fs/promises';
import { test, expect } from './fixtures';
import { newMap, node, nodes, sampleMap, toolbar } from './helpers';

test.describe('File .mappami', () => {
  test('salva la mappa come file e la riapre come copia, con le immagini', async ({ page }, info) => {
    await sampleMap(page);
    // an illustration, to check it travels inside the file
    await node(page, 'Neve').click();
    await toolbar(page, 'Immagine');
    await page.getByRole('searchbox', { name: 'Cerca un\'immagine' }).fill('neve');
    await page.locator('.illustration-tile').first().click();

    await toolbar(page, 'Salva');
    await page.getByRole('button', { name: /^File modificabile/ }).click();
    const download = page.waitForEvent('download');
    await page.locator('.dialog-actions').getByRole('button', { name: 'Salva' }).click();
    const file = info.outputPath('mappa.mappami');
    await (await download).saveAs(file);
    expect((await download).suggestedFilename()).toBe('il-ciclo-dell-acqua.mappami');
    const json = JSON.parse(await readFile(file, 'utf8'));
    expect(json.format).toBe('mappeora');

    await page.getByRole('button', { name: 'Mappe' }).click();
    const chooser = page.waitForEvent('filechooser');
    await page.getByRole('button', { name: 'Apri file' }).click();
    await (await chooser).setFiles(file);
    await expect(nodes(page)).toHaveCount(9);
    await expect(node(page, 'Neve').locator('.concept-illustration')).toHaveAttribute('src', /^data:image\/png/);
    await page.getByRole('button', { name: 'Mappe' }).click();
    await expect(page.locator('.map-card')).toHaveCount(2);
  });

  test('rifiuta un file che non è una mappa, con un messaggio chiaro', async ({ page }) => {
    await page.goto('/');
    const chooser = page.waitForEvent('filechooser');
    await page.getByRole('button', { name: 'Apri file' }).click();
    await (await chooser).setFiles({ name: 'compiti.mappeora', mimeType: 'application/json', buffer: Buffer.from('ciao') });
    await expect(page.getByRole('alert')).toHaveText('Questo file non è una mappa di MappAmi.');
  });

  test('esporta un’immagine PNG', async ({ page }) => {
    await newMap(page, 'Le stagioni');
    await toolbar(page, 'Salva');
    await page.getByRole('dialog').getByRole('button', { name: /^Immagine/ }).click();
    const download = page.waitForEvent('download');
    await page.locator('.dialog-actions').getByRole('button', { name: 'Salva' }).click();
    const buf = await readFile((await (await download).path())!);
    expect(buf.subarray(1, 4).toString()).toBe('PNG');
  });
});
