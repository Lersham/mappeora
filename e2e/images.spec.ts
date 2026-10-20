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

  test('«Cerca su Google» apre Google Immagini con il filtro per ragazzi', async ({ page }) => {
    await newMap(page, 'Il Colosseo');
    await node(page, 'Il Colosseo').click();
    await toolbar(page, 'Immagine');
    await page.getByRole('button', { name: /Foto e Google/ }).click();
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
    await page.getByRole('button', { name: /Foto e Google/ }).click();
    await page.evaluate(async (b64) => {
      const bytes = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
      await navigator.clipboard.write([new ClipboardItem({ 'image/png': new Blob([bytes], { type: 'image/png' }) })]);
    }, PNG_1PX.toString('base64'));
    await page.getByRole('button', { name: 'Incolla immagine' }).click();
    await expect(node(page, 'Il Colosseo').locator('.concept-photo')).toHaveAttribute('src', /^data:image\/jpeg;base64,/);
  });

  test('stringendo il concetto la foto resta dentro il riquadro', async ({ page, isMobile }) => {
    test.skip(isMobile, 'gli appunti del browser si provano sul computer');
    await newMap(page, 'Il Colosseo');
    const concept = node(page, 'Il Colosseo');
    await concept.click();
    await toolbar(page, 'Immagine');
    await page.getByRole('button', { name: /Foto e Google/ }).click();
    // A wide photo, larger than the narrowest concept.
    await page.evaluate(async () => {
      const canvas = document.createElement('canvas');
      canvas.width = 400;
      canvas.height = 300;
      const ctx = canvas.getContext('2d')!;
      ctx.fillStyle = '#c96';
      ctx.fillRect(0, 0, 400, 300);
      const blob = await new Promise<Blob>((done) => canvas.toBlob((b) => done(b!), 'image/png'));
      await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })]);
    });
    await page.getByRole('button', { name: 'Incolla immagine' }).click();
    const photo = concept.locator('.concept-photo');
    await expect(photo).toHaveAttribute('src', /^data:image\/jpeg;base64,/);
    await concept.click();
    await concept.getByRole('button', { name: /Larghezza di Il Colosseo/ }).focus();
    for (let i = 0; i < 30; i++) await page.keyboard.press('ArrowLeft');
    const inside = () =>
      photo.evaluate((img) => {
        const p = img.getBoundingClientRect();
        const n = img.closest('.concept-node')!.getBoundingClientRect();
        return p.left >= n.left - 0.5 && p.right <= n.right + 0.5;
      });
    await expect.poll(inside).toBe(true);
  });

  test('tornando da Google l’immagine copiata arriva da sola', async ({ page, isMobile }) => {
    test.skip(isMobile, 'gli appunti del browser si provano sul computer');
    await newMap(page, 'Il Colosseo');
    await node(page, 'Il Colosseo').click();
    await toolbar(page, 'Immagine');
    await page.getByRole('button', { name: /Foto e Google/ }).click();
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

  test('l’immagine arriva da sola anche se il telefono dà il focus alla pagina un attimo dopo', async ({ page, isMobile }) => {
    test.skip(isMobile, 'gli appunti del browser si provano sul computer');
    await newMap(page, 'La Luna');
    await node(page, 'La Luna').click();
    await toolbar(page, 'Immagine');
    await page.getByRole('button', { name: /Foto e Google/ }).click();
    // As on Android: the page shows again before it has the focus, and
    // until then the clipboard can't be read.
    await page.evaluate(() => {
      const clipboard = navigator.clipboard;
      const read = clipboard.read.bind(clipboard);
      const w = window as unknown as { unfocused: boolean; tries: number };
      Object.assign(w, { unfocused: true, tries: 0 });
      Object.defineProperty(clipboard, 'read', {
        value: () => (w.tries++, w.unfocused ? Promise.reject(new DOMException('Document is not focused.', 'NotAllowedError')) : read()),
      });
    });
    const popup = page.waitForEvent('popup');
    await page.getByRole('button', { name: 'Cerca su Google' }).click();
    await page.evaluate(async (b64) => {
      const bytes = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
      await navigator.clipboard.write([new ClipboardItem({ 'image/png': new Blob([bytes], { type: 'image/png' }) })]);
    }, PNG_1PX.toString('base64'));
    await (await popup).close();
    await page.evaluate(() => document.dispatchEvent(new Event('visibilitychange')));
    await expect.poll(() => page.evaluate(() => (window as unknown as { tries: number }).tries)).toBeGreaterThan(0);
    // The focus comes, with no event of its own: the picture still arrives.
    await page.evaluate(() => ((window as unknown as { unfocused: boolean }).unfocused = false));
    await expect(node(page, 'La Luna').locator('.concept-photo')).toHaveAttribute('src', /^data:image\/jpeg;base64,/);
    await expect(page.getByRole('button', { name: 'Incolla immagine' })).toHaveCount(0);
  });

  test('tornando da Google senza un’immagine copiata indica «Incolla immagine»', async ({ page, isMobile }) => {
    test.skip(isMobile, 'gli appunti del browser si provano sul computer');
    await newMap(page, 'Il Colosseo');
    await node(page, 'Il Colosseo').click();
    await toolbar(page, 'Immagine');
    await page.getByRole('button', { name: /Foto e Google/ }).click();
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
    await page.getByRole('button', { name: /Foto e Google/ }).click();
    await page.evaluate(() => navigator.clipboard.writeText('ciao'));
    await page.getByRole('button', { name: 'Incolla immagine' }).click();
    await expect(page.getByRole('alert')).toContainText('Copia immagine');
  });

  test('aggiunge una foto dalla galleria, ridotta e salvata nella mappa', async ({ page }) => {
    await newMap(page, 'Il mio esperimento');
    await node(page, 'Il mio esperimento').click();
    await toolbar(page, 'Immagine');
    await page.getByRole('button', { name: /Foto e Google/ }).click();
    const chooser = page.waitForEvent('filechooser');
    await page.getByRole('button', { name: 'Dalla galleria' }).click();
    await (await chooser).setFiles({ name: 'foto.png', mimeType: 'image/png', buffer: PNG_1PX });
    await expect(node(page, 'Il mio esperimento').locator('.concept-photo')).toHaveAttribute('src', /^data:image\/jpeg;base64,/);
  });
  test('nel concetto ovale con la foto le parole restano dentro il bordo curvo', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('button', { name: 'esempio' }).click();
    await page.getByRole('button', { name: /^La nascita di Roma/ }).click();
    const root = page.locator('.concept-node.shape-ellisse').filter({ has: page.locator('.concept-photo') });
    await expect(root).toHaveCount(1);
    await expect(root.locator('.concept-photo')).toHaveJSProperty('complete', true);
    // How far in the curved border is at the height of the last line, against where the line starts.
    const gap = await root.evaluate((el: HTMLElement) => {
      const s = getComputedStyle(el);
      const r = el.getBoundingClientRect();
      const scale = r.width / el.offsetWidth;
      const w = el.offsetWidth;
      const h = el.offsetHeight;
      const [a, b = a] = s.borderBottomLeftRadius.split(' ');
      const px = (v: string, size: number) => (v.endsWith('%') ? (parseFloat(v) / 100) * size : parseFloat(v));
      // Radii larger than the box are scaled down together, as the browser draws them.
      const f = Math.min(1, w / (2 * px(a, w)), h / (2 * px(b, h)));
      const rx = px(a, w) * f;
      const ry = px(b, h) * f;
      const range = document.createRange();
      range.selectNodeContents(el.querySelector('.concept-label')!);
      const last = [...range.getClientRects()].at(-1)!;
      const fromBottom = (r.bottom - last.bottom) / scale;
      const dy = Math.max(0, ry - fromBottom);
      const inset = rx * (1 - Math.sqrt(Math.max(0, 1 - (dy / ry) ** 2))) + parseFloat(s.borderLeftWidth);
      return Math.min(last.left - r.left, r.right - last.right) / scale - inset;
    });
    expect(gap).toBeGreaterThan(0);
  });
});
