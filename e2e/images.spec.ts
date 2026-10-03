import { test, expect, PNG_1PX } from './fixtures';
import { newMap, node, toolbar } from './helpers';

test.describe('Immagini nei concetti', () => {
  test('cerca un’illustrazione in italiano e la salva dentro la mappa', async ({ page }) => {
    await newMap(page, 'Il vulcano');
    await node(page, 'Il vulcano').click();
    await toolbar(page, 'Immagine');
    await expect(page.getByRole('tab', { name: /Illustrazioni/ })).toHaveAttribute('aria-selected', 'true');
    await page.getByRole('searchbox', { name: 'Cerca un\'immagine' }).fill('Vesuvio');
    await page.getByRole('button', { name: 'vulcano', exact: true }).click();
    await expect(node(page, 'Il vulcano').locator('.concept-illustration')).toHaveAttribute('src', /^data:image\/png;base64,/);
  });

  test('cerca i simboli CAA: frase pulita, risultati esatti prima, niente contenuti non adatti', async ({ page }) => {
    await newMap(page, 'Le piante');
    await node(page, 'Le piante').click();
    await toolbar(page, 'Immagine');
    await page.getByRole('tab', { name: /Simboli CAA/ }).click();
    // "Le piante": the article is dropped, the flagged pictogram is hidden
    const tiles = page.locator('.picto-tile');
    await expect(tiles).toHaveCount(2);
    await expect(tiles.first()).toHaveAttribute('aria-label', 'pianta');

    await page.getByRole('searchbox', { name: 'Cerca un\'immagine' }).fill("l'acqua");
    await expect(tiles).toHaveCount(2);
    await expect(tiles.first()).toHaveAttribute('aria-label', 'acqua');
    await expect(page.locator('.picto-tile[aria-label="battere i piedi in acqua"]')).toHaveCount(0);
    await tiles.first().click();
    await expect(node(page, 'Le piante').locator('.concept-picto')).toHaveAttribute('src', /^data:image\/png;base64,/);
    // reopening the dialog on a CAA concept starts from the CAA tab
    await toolbar(page, 'Immagine');
    await expect(page.getByRole('tab', { name: /Simboli CAA/ })).toHaveAttribute('aria-selected', 'true');
  });

  test('«Cerca su Google» apre Google Immagini con il filtro per ragazzi', async ({ page }) => {
    await newMap(page, 'Il Colosseo');
    await node(page, 'Il Colosseo').click();
    await toolbar(page, 'Immagine');
    await page.getByRole('tab', { name: /Foto e Google/ }).click();
    const popup = page.waitForEvent('popup');
    await page.getByRole('button', { name: 'Cerca su Google' }).click();
    const url = new URL((await popup).url());
    expect(url.hostname).toBe('www.google.com');
    expect(url.searchParams.get('q')).toBe('Il Colosseo');
    expect(url.searchParams.get('safe')).toBe('active');
  });

  test('incolla un’immagine copiata', async ({ page, isMobile }) => {
    test.skip(isMobile, 'gli appunti del browser si provano sul computer');
    await newMap(page, 'Il Colosseo');
    await node(page, 'Il Colosseo').click();
    await toolbar(page, 'Immagine');
    await page.getByRole('tab', { name: /Foto e Google/ }).click();
    await page.evaluate(async (b64) => {
      const bytes = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
      await navigator.clipboard.write([new ClipboardItem({ 'image/png': new Blob([bytes], { type: 'image/png' }) })]);
    }, PNG_1PX.toString('base64'));
    await page.getByRole('button', { name: 'Incolla immagine' }).click();
    await expect(node(page, 'Il Colosseo').locator('.concept-photo')).toHaveAttribute('src', /^data:image\/jpeg;base64,/);
  });

  test('se negli appunti c’è del testo spiega cosa fare', async ({ page, isMobile }) => {
    test.skip(isMobile, 'gli appunti del browser si provano sul computer');
    await newMap(page, 'Il Colosseo');
    await node(page, 'Il Colosseo').click();
    await toolbar(page, 'Immagine');
    await page.getByRole('tab', { name: /Foto e Google/ }).click();
    await page.evaluate(() => navigator.clipboard.writeText('ciao'));
    await page.getByRole('button', { name: 'Incolla immagine' }).click();
    await expect(page.getByRole('alert')).toContainText('Copia immagine');
  });

  test('aggiunge una foto dalla galleria, ridotta e salvata nella mappa', async ({ page }) => {
    await newMap(page, 'Il mio esperimento');
    await node(page, 'Il mio esperimento').click();
    await toolbar(page, 'Immagine');
    await page.getByRole('tab', { name: /Foto e Google/ }).click();
    const chooser = page.waitForEvent('filechooser');
    await page.getByRole('button', { name: 'Dalla galleria' }).click();
    await (await chooser).setFiles({ name: 'foto.png', mimeType: 'image/png', buffer: PNG_1PX });
    await expect(node(page, 'Il mio esperimento').locator('.concept-photo')).toHaveAttribute('src', /^data:image\/jpeg;base64,/);
  });
});
