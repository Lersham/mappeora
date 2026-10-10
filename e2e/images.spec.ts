import { test, expect, PNG_1PX } from './fixtures';
import { newMap, node, toolbar } from './helpers';

test.describe('Immagini nei concetti', () => {
  test('cerca un’illustrazione in italiano e la salva dentro la mappa', async ({ page }) => {
    await newMap(page, 'Il vulcano');
    await node(page, 'Il vulcano').click();
    await toolbar(page, 'Immagine');
    await expect(page.getByRole('button', { name: /Illustrazioni/ })).toHaveAttribute('aria-pressed', 'true');
    await expect(page.getByRole('group', { name: 'Scegli da dove' }).getByRole('button')).toHaveCount(2); // illustrations, photos and Google: no CAA symbols
    await page.getByRole('searchbox', { name: 'Cerca un\'immagine' }).fill('Vesuvio');
    await page.getByRole('button', { name: 'vulcano', exact: true }).click();
    await expect(node(page, 'Il vulcano').locator('.concept-illustration')).toHaveAttribute('src', /^data:image\/png;base64,/);
  });

  test('senza internet l’illustrazione diventa il suo simbolo, non un riquadro vuoto', async ({ page }) => {
    await newMap(page, 'Il vulcano');
    await page.context().route(/cdn\.jsdelivr\.net\/gh\/microsoft/, (route) => route.abort('internetdisconnected'));
    await node(page, 'Il vulcano').click();
    await toolbar(page, 'Immagine');
    await page.getByRole('searchbox', { name: 'Cerca un\'immagine' }).fill('vulcano');
    const tile = page.getByRole('button', { name: 'vulcano', exact: true });
    await expect(tile).toHaveText('🌋'); // the preview could not load
    await tile.click();
    await expect(node(page, 'Il vulcano').locator('.concept-emoji')).toHaveText('🌋');
    await expect(page.getByRole('dialog')).toHaveCount(0);
  });

  test('cerca su Wikipedia dentro l’app: un tocco e l’immagine è nel concetto', async ({ page }) => {
    await newMap(page, 'Il Colosseo');
    await node(page, 'Il Colosseo').click();
    await toolbar(page, 'Immagine');
    // No drawing for «Il Colosseo»: the dialog opens on the photos by itself.
    await expect(page.getByRole('button', { name: 'Foto', exact: true })).toHaveAttribute('aria-pressed', 'true');
    // Already searching the concept's name.
    const tile = page.getByRole('button', { name: 'Il Colosseo', exact: true });
    await expect(tile).toBeVisible();
    await expect(page.getByRole('button', { name: 'Il Colosseo (storia)', exact: true })).toBeVisible();
    await tile.click();
    await expect(page.getByRole('dialog')).toHaveCount(0);
    await expect(node(page, 'Il Colosseo').locator('.concept-photo')).toHaveAttribute('src', /^data:image\/jpeg;base64,/);
  });

  test('se Wikipedia non ha immagini lo dice e indica Google', async ({ page }) => {
    await newMap(page, 'Il Colosseo');
    await node(page, 'Il Colosseo').click();
    await toolbar(page, 'Immagine');
    await page.getByRole('button', { name: 'Foto', exact: true }).click();
    await page.getByRole('searchbox', { name: 'Cerca un\'immagine' }).fill('nulla da trovare');
    await expect(page.getByRole('status').filter({ hasText: 'Su Wikipedia non c’è un’immagine' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Cerca su Google' })).toBeEnabled();
  });

  test('senza internet Wikipedia non risponde e lo dice', async ({ page }) => {
    await newMap(page, 'Il Colosseo');
    await page.context().route(/it\.wikipedia\.org/, (route) => route.abort('internetdisconnected'));
    await node(page, 'Il Colosseo').click();
    await toolbar(page, 'Immagine');
    await page.getByRole('button', { name: 'Foto', exact: true }).click();
    await expect(page.getByRole('status').filter({ hasText: 'Wikipedia non risponde' })).toBeVisible();
  });

  test('«Cerca su Google» apre Google Immagini con il filtro per ragazzi', async ({ page }) => {
    await newMap(page, 'Il Colosseo');
    await node(page, 'Il Colosseo').click();
    await toolbar(page, 'Immagine');
    await page.getByRole('button', { name: 'Foto', exact: true }).click();
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
    await page.getByRole('button', { name: 'Foto', exact: true }).click();
    await page.evaluate(async (b64) => {
      const bytes = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
      await navigator.clipboard.write([new ClipboardItem({ 'image/png': new Blob([bytes], { type: 'image/png' }) })]);
    }, PNG_1PX.toString('base64'));
    await page.getByRole('button', { name: 'Incolla immagine' }).click();
    await expect(node(page, 'Il Colosseo').locator('.concept-photo')).toHaveAttribute('src', /^data:image\/jpeg;base64,/);
  });

  test('tornando da Google l’immagine copiata arriva da sola', async ({ page, isMobile }) => {
    test.skip(isMobile, 'gli appunti del browser si provano sul computer');
    await newMap(page, 'Il Colosseo');
    await node(page, 'Il Colosseo').click();
    await toolbar(page, 'Immagine');
    await page.getByRole('button', { name: 'Foto', exact: true }).click();
    const popup = page.waitForEvent('popup');
    await page.getByRole('button', { name: 'Cerca su Google' }).click();
    // On Google: «Copia immagine», then back to MappAmi.
    await page.evaluate(async (b64) => {
      const bytes = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
      await navigator.clipboard.write([new ClipboardItem({ 'image/png': new Blob([bytes], { type: 'image/png' }) })]);
    }, PNG_1PX.toString('base64'));
    await (await popup).close();
    await page.evaluate(() => window.dispatchEvent(new Event('focus')));
    await expect(node(page, 'Il Colosseo').locator('.concept-photo')).toHaveAttribute('src', /^data:image\/jpeg;base64,/);
  });

  test('tornando da Google senza un’immagine copiata indica «Incolla immagine»', async ({ page, isMobile }) => {
    test.skip(isMobile, 'gli appunti del browser si provano sul computer');
    await newMap(page, 'Il Colosseo');
    await node(page, 'Il Colosseo').click();
    await toolbar(page, 'Immagine');
    await page.getByRole('button', { name: 'Foto', exact: true }).click();
    await page.evaluate(() => navigator.clipboard.writeText('un testo copiato prima'));
    const popup = page.waitForEvent('popup');
    await page.getByRole('button', { name: 'Cerca su Google' }).click();
    await (await popup).close();
    await page.evaluate(() => window.dispatchEvent(new Event('focus')));
    await expect(page.getByRole('status').filter({ hasText: 'Hai copiato un’immagine?' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Incolla immagine' })).toHaveClass(/primary/);
    await expect(node(page, 'Il Colosseo').locator('.concept-photo')).toHaveCount(0);
  });

  test('se negli appunti c’è del testo spiega cosa fare', async ({ page, isMobile }) => {
    test.skip(isMobile, 'gli appunti del browser si provano sul computer');
    await newMap(page, 'Il Colosseo');
    await node(page, 'Il Colosseo').click();
    await toolbar(page, 'Immagine');
    await page.getByRole('button', { name: 'Foto', exact: true }).click();
    await page.evaluate(() => navigator.clipboard.writeText('ciao'));
    await page.getByRole('button', { name: 'Incolla immagine' }).click();
    await expect(page.getByRole('alert')).toContainText('Copia immagine');
  });

  test('aggiunge una foto dalla galleria, ridotta e salvata nella mappa', async ({ page }) => {
    await newMap(page, 'Il mio esperimento');
    await node(page, 'Il mio esperimento').click();
    await toolbar(page, 'Immagine');
    await page.getByRole('button', { name: 'Foto', exact: true }).click();
    const chooser = page.waitForEvent('filechooser');
    await page.getByRole('button', { name: 'Dalla galleria' }).click();
    await (await chooser).setFiles({ name: 'foto.png', mimeType: 'image/png', buffer: PNG_1PX });
    await expect(node(page, 'Il mio esperimento').locator('.concept-photo')).toHaveAttribute('src', /^data:image\/jpeg;base64,/);
  });
});
