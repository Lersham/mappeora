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
    await page.getByRole('button', { name: /La Rivoluzione francese/ }).click();
    await expect(page.locator('.concept-node')).toHaveCount(37);
  });

  for (const [sheets, pages] of [
    ['1 foglio', 1],
    ['2 fogli', 2],
    ['4 fogli', 4],
  ] as const) {
    test(`PDF A4 verticale su ${sheets}, leggero`, async ({ page }) => {
      await toolbar(page, 'Salva');
      await page.getByRole('button', { name: /PDF da stampare/ }).click();
      await page.getByRole('button', { name: sheets }).click();
      const download = page.waitForEvent('download');
      await page.locator('.dialog-actions').getByRole('button', { name: 'Salva' }).click();
      const info = pdfInfo(await readFile((await (await download).path())!));
      expect(info.pages).toBe(pages);
      expect(info.height).toBeGreaterThan(info.width); // portrait
      expect(Math.round(info.width)).toBe(595); // A4
      expect(info.kb).toBeLessThan(3000);
    });
  }

  test('versione per la verifica, foglio A3', async ({ page }) => {
    await toolbar(page, 'Salva');
    await page.getByRole('button', { name: 'A3 (grande)' }).click();
    await page.getByLabel(/Versione per la verifica/).check();
    const download = page.waitForEvent('download');
    await page.locator('.dialog-actions').getByRole('button', { name: 'Salva' }).click();
    expect((await download).suggestedFilename()).toBe('la-rivoluzione-francese-verifica.pdf');
    const info = pdfInfo(await readFile((await (await download).path())!));
    expect(Math.round(info.width)).toBe(842); // A3
  });

  test('«Stampa» prepara il PDF per la finestra di stampa', async ({ page, isMobile }) => {
    test.skip(isMobile, 'sul telefono si condivide il PDF');
    await toolbar(page, 'Salva');
    await page.getByRole('button', { name: 'Stampa', exact: true }).click();
    await expect(page.locator('iframe.print-frame')).toHaveCount(1);
  });
});
