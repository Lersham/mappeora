import { readFile } from 'node:fs/promises';
import { inflateSync } from 'node:zlib';
import { test, expect } from './fixtures';
import { toolbar } from './helpers';

/** Page count and sheet size of a PDF, read from its objects. */
function pdfInfo(pdf: Buffer) {
  const text = pdf.toString('latin1');
  const pages = text.match(/\/Type \/Page[^s]/g)?.length ?? 0;
  const box = /\/MediaBox \[0 0 ([\d.]+) ([\d.]+)\]/.exec(text);
  return { pages, width: Number(box?.[1]), height: Number(box?.[2]), kb: pdf.length / 1024 };
}

/** The map on the first sheet, in mm from the bottom left: the largest picture drawn. */
function mapOnSheet(pdf: Buffer) {
  const mm = 25.4 / 72;
  return [...pdf.toString('latin1').matchAll(/stream\r?\n([\s\S]*?)\r?\nendstream/g)]
    .flatMap((m) => {
      try {
        return [inflateSync(Buffer.from(m[1], 'latin1')).toString('latin1')];
      } catch {
        return []; // not a page (a picture, a font)
      }
    })
    .flatMap((page) => [...page.matchAll(/([\d.]+) 0 0 ([\d.]+) ([\d.]+) ([\d.]+) cm\s*\/I\d+ Do/g)])
    .map((c) => ({ w: +c[1] * mm, h: +c[2] * mm, x: +c[3] * mm, y: +c[4] * mm }))
    .sort((a, b) => b.w * b.h - a.w * a.h)[0];
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

  test('la mappa prende il foglio fino a 8 mm dai bordi, senza una cornice bianca in più', async ({ page }) => {
    await toolbar(page, 'Salva e manda');
    const download = page.waitForEvent('download');
    await page.locator('.dialog-actions').getByRole('button', { name: 'Salva', exact: true }).click();
    const pdf = await readFile((await (await download).path())!);
    const map = mapOnSheet(pdf);
    // A wide map, on its side: as wide as the sheet less two margins.
    expect(map.x).toBeCloseTo(8, 0);
    expect(map.w).toBeCloseTo(297 - 16, 0);
    // No title over it: the main concept already says «La Rivoluzione francese».
    expect(210 - (map.y + map.h)).toBeCloseTo(8, 0);
  });

  test('sfondo bianco e linee scure anche se sullo schermo lo sfondo è scuro', async ({ page }) => {
    await toolbar(page, 'Aspetto');
    const panel = page.getByRole('dialog', { name: 'Aspetto e voce' });
    await panel.getByRole('button', { name: 'Scuro', exact: true }).click();
    await page.keyboard.press('Escape');
    await expect(panel).toBeHidden();
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'scuro');
    await toolbar(page, 'Salva e manda');
    await page.getByRole('button', { name: /^Immagine/ }).click();
    const download = page.waitForEvent('download');
    await page.locator('.dialog-actions').getByRole('button', { name: 'Salva', exact: true }).click();
    const png = await readFile((await (await download).path())!);
    const { corner, lines } = await page.evaluate(async (src) => {
      const img = new Image();
      img.src = src;
      await img.decode();
      const ctx = Object.assign(document.createElement('canvas'), { width: img.width, height: img.height }).getContext('2d')!;
      ctx.drawImage(img, 0, 0);
      const { data } = ctx.getImageData(0, 0, img.width, img.height);
      let lines = 0; // pixels in the grey of the lines on white paper (--edge), not the light grey of the dark screen
      for (let i = 0; i < data.length; i += 4) if (data[i] === 0x55 && data[i + 1] === 0x60 && data[i + 2] === 0x70) lines++;
      return { corner: [...data.slice(0, 4)], lines };
    }, `data:image/png;base64,${png.toString('base64')}`);
    expect(corner).toEqual([255, 255, 255, 255]);
    expect(lines).toBeGreaterThan(1000);
  });

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
