import { readFile } from 'node:fs/promises';
import { test, expect, spoken } from './fixtures';
import { addConcept, newMap, node, toolbar } from './helpers';

const pages = (pdf: Buffer) => pdf.toString('latin1').match(/\/Type \/Page[^s]/g)?.length ?? 0;

test.describe('Approfondimenti', () => {
  test('si scrivono e si ascoltano dal 📝 del concetto; il PDF li mette in fondo, la verifica no', async ({ page }) => {
    await newMap(page, 'La Rivoluzione francese');
    await addConcept(page, 'La Rivoluzione francese', 'La presa della Bastiglia');

    // On the concept in hand, a 📝 to add one.
    await node(page, 'La presa della Bastiglia').getByRole('button', { name: 'Aggiungi un approfondimento a La presa della Bastiglia' }).click();
    const dialog = page.getByRole('dialog', { name: 'Approfondimento' });
    await dialog.getByRole('textbox', { name: 'Testo dell’approfondimento' }).fill('Il 14 luglio 1789 il popolo di Parigi assalta la Bastiglia.');
    await dialog.getByRole('button', { name: 'Fatto' }).click();
    await expect(dialog).toHaveCount(0);

    // Now the 📝 is always there, and it reads the note aloud.
    await page.locator('.react-flow__pane').click({ position: { x: 20, y: 20 } });
    const mark = node(page, 'La presa della Bastiglia').getByRole('button', { name: 'Approfondimento: La presa della Bastiglia' });
    await expect(mark).toBeVisible();
    await mark.click();
    await dialog.getByRole('button', { name: 'Ascolta' }).click();
    await expect.poll(() => spoken(page)).toContainEqual('Il 14 luglio 1789 il popolo di Parigi assalta la Bastiglia.');
    await page.keyboard.press('Escape');
    await expect(dialog).toHaveCount(0);

    // PDF: the map, then a page of notes. The «versione per la verifica» has no notes.
    await toolbar(page, 'Salva');
    await page.getByRole('button', { name: /^PDF da stampare/ }).click();
    await expect(page.getByLabel(/Con gli approfondimenti/)).toBeChecked();
    let download = page.waitForEvent('download');
    await page.locator('.dialog-actions').getByRole('button', { name: 'Salva' }).click();
    expect(pages(await readFile((await (await download).path())!))).toBe(2);

    await toolbar(page, 'Salva');
    await page.getByRole('button', { name: /^PDF da stampare/ }).click();
    await page.getByLabel(/Versione per la verifica/).check();
    await expect(page.getByLabel(/Con gli approfondimenti/)).toHaveCount(0);
    download = page.waitForEvent('download');
    await page.locator('.dialog-actions').getByRole('button', { name: 'Salva' }).click();
    expect(pages(await readFile((await (await download).path())!))).toBe(1);
  });

  test('all’Interrogazione l’approfondimento è un suggerimento, da leggere e basta', async ({ page }) => {
    await newMap(page, 'Le piante');
    await node(page, 'Le piante').click();
    await node(page, 'Le piante').getByRole('button', { name: /Aggiungi un approfondimento/ }).click();
    await page.getByRole('textbox', { name: 'Testo dell’approfondimento' }).fill('Producono ossigeno.');
    await page.getByRole('button', { name: 'Fatto' }).click();

    await page.getByRole('button', { name: 'Ripassa' }).click();
    await page.getByRole('button', { name: /^Interrogazione/ }).click();
    await node(page, 'Le piante').getByRole('button', { name: 'Approfondimento: Le piante' }).click();
    const hint = page.getByRole('dialog', { name: 'Suggerimento' });
    await expect(hint).toContainText('Producono ossigeno.');
    await expect(hint.getByRole('textbox')).toHaveCount(0);
    await hint.getByRole('button', { name: 'Chiudi' }).click();
    await expect(page.getByRole('button', { name: 'Esci' })).toBeVisible();
  });
});
