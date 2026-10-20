import { readFile } from 'node:fs/promises';
import { test, expect } from './fixtures';
import { toolbar } from './helpers';

/** Page count and sheet size of a PDF, read from its objects. */
function pdfInfo(pdf: Buffer) {
  const text = pdf.toString('latin1');
  const pages = text.match(/\/Type \/Page[^s]/g)?.length ?? 0;
  const box = /\/MediaBox \[0 0 ([\d.]+) ([\d.]+)\]/.exec(text);
  return { pages, width: Number(box?.[1]), height: Number(box?.[2]), kb: pdf.length / 1024 };
}

test.describe('Stampa e PDF', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.getByRole('button', { name: 'Esempi', exact: true }).click();
    await page.getByRole('button', { name: /^La Rivoluzione francese/ }).click();
    await expect(page.locator('.concept-node')).toHaveCount(39);
  });

  for (const [sheets, pages] of [
    ['1 foglio', 1],
    ['2 fogli', 2],
    ['4 fogli', 4],
  ] as const) {
    test(`PDF A4 su ${sheets}, leggero`, async ({ page }) => {
      await toolbar(page, 'Salva e manda');
      await page.getByRole('button', { name: /^PDF da stampare/ }).click();
      await page.getByRole('button', { name: sheets }).click();
      const download = page.waitForEvent('download');
      await page.locator('.dialog-actions').getByRole('button', { name: 'Salva', exact: true }).click();
      const info = pdfInfo(await readFile((await (await download).path())!));
      expect(info.pages).toBe(pages);
      // A4, turned if the map prints larger that way
      expect(Math.round(Math.min(info.width, info.height))).toBe(595);
      expect(Math.round(Math.max(info.width, info.height))).toBe(842);
      expect(info.kb).toBeLessThan(3000);
    });
  }

  test('«Salva e manda»: tre tipi, senza «Testo»; sul computer la finestra è larga e li mette uno accanto all’altro', async ({ page, isMobile }) => {
    await toolbar(page, 'Salva e manda');
    const dialog = page.getByRole('dialog', { name: 'Salva e manda' });
    const kinds = dialog.locator('.export-kinds .option-card');
    await expect(kinds).toHaveCount(3);
    await expect(kinds.nth(0)).toContainText('PDF da stampare');
    await expect(kinds.nth(1)).toContainText('Immagine');
    await expect(kinds.nth(2)).toContainText('File modificabile');
    await expect(dialog.getByRole('button', { name: /^Testo/ })).toHaveCount(0);
    if (isMobile) return;
    const card = (await page.locator('.overlay-card.export-dialog').boundingBox())!;
    expect(card.width).toBeGreaterThan(700);
    const tops = await Promise.all([0, 1, 2].map(async (i) => (await kinds.nth(i).boundingBox())!.y));
    expect(new Set(tops.map(Math.round)).size).toBe(1);
  });

  test('versione per la verifica, foglio A3', async ({ page }) => {
    await toolbar(page, 'Salva e manda');
    await page.getByRole('button', { name: 'A3 (grande)' }).click();
    await page.getByLabel(/Versione per la verifica/).check();
    const download = page.waitForEvent('download');
    await page.locator('.dialog-actions').getByRole('button', { name: 'Salva', exact: true }).click();
    expect((await download).suggestedFilename()).toBe('la-rivoluzione-francese-verifica.pdf');
    const info = pdfInfo(await readFile((await (await download).path())!));
    expect(Math.round(Math.min(info.width, info.height))).toBe(842); // A3
  });

  test('«Stampa» prepara il PDF per la finestra di stampa', async ({ page, isMobile }) => {
    test.skip(isMobile, 'sul telefono si condivide il PDF');
    await toolbar(page, 'Salva e manda');
    await page.getByRole('button', { name: 'Stampa', exact: true }).click();
    await expect(page.locator('iframe.print-frame')).toHaveCount(1);
  });
});
