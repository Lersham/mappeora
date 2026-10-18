import type { Page } from '@playwright/test';
import { test, expect } from './fixtures';
import { fakeOcr, newMap, node, photographPage, toolbar } from './helpers';

/*
 * Colours that must be seen by everyone: the frame of a field and the ring of
 * the keyboard need 3:1 against the paper (WCAG 1.4.11), in every theme; and
 * in Windows' High Contrast mode (forced colours) a choice that is picked
 * must still look picked.
 */

type Rgb = [number, number, number];

function rgb(color: string): Rgb {
  const m = /^rgba?\((\d+), (\d+), (\d+)/.exec(color);
  if (!m) throw new Error(`not a plain colour: ${color}`);
  return [Number(m[1]), Number(m[2]), Number(m[3])];
}

function contrast(a: string, b: string) {
  const lum = (c: Rgb) => {
    const [r, g, bl] = c.map((v) => v / 255).map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
    return 0.2126 * r + 0.7152 * g + 0.0722 * bl;
  };
  const [hi, lo] = [lum(rgb(a)), lum(rgb(b))].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

/** A child's own settings, as the app stores them. */
async function seed(page: Page, theme: string) {
  await page.addInitScript((theme) => {
    if (!localStorage.getItem('mappeora-settings')) {
      localStorage.setItem('mappeora-settings', JSON.stringify({ state: { theme }, version: 1 }));
    }
  }, theme);
}

const style = (page: Page, selector: string, props: string[]) =>
  page.locator(selector).first().evaluate((el, props) => {
    const s = getComputedStyle(el);
    return Object.fromEntries(props.map((p) => [p, s.getPropertyValue(p)]));
  }, props);

test.describe('Contrasto di campi e fuoco, in ogni sfondo', () => {
  for (const theme of ['crema', 'bianco', 'azzurro', 'scuro']) {
    test(`sfondo ${theme}: il bordo dei campi e l’anello del fuoco si vedono (3:1)`, async ({ page }) => {
      await seed(page, theme);
      await page.goto('/');
      await expect(page.locator('html')).toHaveAttribute('data-theme', theme);
      await page.getByRole('button', { name: 'Nuova mappa' }).click();
      const dialog = page.getByRole('dialog', { name: 'Nuova mappa' });
      const field = dialog.getByPlaceholder("es. Il ciclo dell'acqua");
      await expect(field).toBeFocused();

      const f = await style(page, '.text-field', ['border-top-color', 'background-color', 'outline-color', 'outline-style']);
      const card = await style(page, '.overlay-card', ['background-color']);
      const border = f['border-top-color'];
      // the frame against the paper around it and the field's own fill
      expect(contrast(border, card['background-color']), `bordo su ${card['background-color']}`).toBeGreaterThanOrEqual(3);
      expect(contrast(border, f['background-color']), `bordo su ${f['background-color']}`).toBeGreaterThanOrEqual(3);

      // the ring around the field with the keyboard's focus
      await page.keyboard.press('Shift+Tab');
      await page.keyboard.press('Tab');
      await expect(field).toBeFocused();
      const ring = await style(page, '.text-field', ['outline-color', 'outline-style', 'outline-width']);
      expect(ring['outline-style']).toBe('solid');
      expect(contrast(ring['outline-color'], card['background-color']), 'anello su carta').toBeGreaterThanOrEqual(3);
      // the page itself is the other paper the ring can be on (the map, the home)
      const page_ = await style(page, 'body', ['background-color']);
      expect(contrast(ring['outline-color'], page_['background-color']), 'anello sulla pagina').toBeGreaterThanOrEqual(3);

      // the same on the settings: a menu is a field too
      await dialog.getByRole('button', { name: 'Annulla' }).click();
      await page.getByRole('button', { name: 'Aspetto' }).click();
      const select = page.getByRole('dialog', { name: 'Aspetto e voce' }).getByRole('combobox', { name: 'Voce', exact: true });
      await expect(select).toBeVisible();
      const s = await style(page, '.setting select', ['border-top-color', 'background-color']);
      const panel = await style(page, '.overlay-card.settings', ['background-color']);
      expect(contrast(s['border-top-color'], panel['background-color'])).toBeGreaterThanOrEqual(3);
      expect(contrast(s['border-top-color'], s['background-color'])).toBeGreaterThanOrEqual(3);
    });
  }

  test('il testo letto dalla foto e il suo editor hanno il bordo che si vede', async ({ page }) => {
    await fakeOcr(page, 'Le piante producono ossigeno.');
    await newMap(page, 'Le piante');
    await toolbar(page, 'Dal libro');
    const dialog = await photographPage(page);
    const card = await style(page, '.overlay-card', ['background-color']);
    const text = await style(page, '.ocr-text', ['border-top-color']);
    expect(contrast(text['border-top-color'], card['background-color'])).toBeGreaterThanOrEqual(3);
    await dialog.getByRole('button', { name: 'Correggi' }).click();
    await expect(dialog.getByRole('textbox', { name: 'Testo letto dalla foto' })).toBeVisible();
    const editor = await style(page, '.ocr-editor', ['border-top-color']);
    expect(contrast(editor['border-top-color'], card['background-color'])).toBeGreaterThanOrEqual(3);
  });
});

test.describe('Contrasto forzato (Windows ad alto contrasto)', () => {
  test.beforeEach(async ({ page }) => {
    await page.emulateMedia({ forcedColors: 'active' });
  });

  const picked = (page: Page, selector: string) =>
    page.locator(selector).first().evaluate((el) => {
      const s = getComputedStyle(el);
      return { outlineStyle: s.outlineStyle, outlineWidth: s.outlineWidth, outlineColor: s.outlineColor, borderColor: s.borderTopColor };
    });

  test('Aspetto: la scelta fatta ha una cornice spessa, le altre no', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('button', { name: 'Aspetto' }).click();
    const panel = page.getByRole('dialog', { name: 'Aspetto e voce' });
    await panel.getByRole('button', { name: 'Atkinson' }).click();
    await panel.getByRole('heading').first().click(); // the click leaves the button: no keyboard ring on it
    const on = await picked(page, '.choice[aria-pressed="true"]');
    const off = await picked(page, '.choice[aria-pressed="false"]');
    expect([on.outlineStyle, on.outlineWidth]).toEqual(['solid', '3px']);
    expect(off.outlineStyle).toBe('none');
    expect(on.borderColor).not.toBe(off.borderColor);
    expect(on.outlineColor).toBe(on.borderColor);
  });

  test('Nuova mappa: il modello scelto si distingue dagli altri', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('button', { name: 'Nuova mappa' }).click();
    const dialog = page.getByRole('dialog', { name: 'Nuova mappa' });
    await dialog.locator('.template-pick', { hasText: 'Le 5 W' }).click();
    const on = await picked(page, '.template-card.is-selected');
    const off = await picked(page, '.template-card:not(.is-selected)');
    expect([on.outlineStyle, on.outlineWidth]).toEqual(['solid', '3px']);
    expect(off.outlineStyle).toBe('none');
    expect(on.borderColor).not.toBe(off.borderColor);
  });

  test('un concetto scelto, un colore, una forma e una parola del libro scelti si vedono', async ({ page }) => {
    await newMap(page, 'Il vulcano');
    const concept = node(page, 'Il vulcano');
    await concept.click();
    await expect(concept).toHaveClass(/is-selected/);
    // not the keyboard's focus: that one has its own ring
    await page.mouse.move(5, 5);
    const sel = await picked(page, '.concept-node.is-selected');
    expect([sel.outlineStyle, sel.outlineWidth]).toEqual(['solid', '3px']);

    await concept.click();
    const dialog = page.getByRole('dialog', { name: 'Immagine e colore' });
    await expect(dialog).toBeVisible();
    const swatch = dialog.locator('.color-swatch[aria-pressed="true"]');
    await expect(swatch).toHaveCount(1);
    const color = await picked(page, '.color-swatch[aria-pressed="true"]');
    expect([color.outlineStyle, color.outlineWidth]).toEqual(['solid', '3px']);
    // the colour itself still shows: a swatch is not turned into a plain button
    const [pressedBackground, otherBackground] = await Promise.all([
      swatch.evaluate((el) => getComputedStyle(el).backgroundColor),
      dialog.locator('.color-swatch[aria-pressed="false"]').first().evaluate((el) => getComputedStyle(el).backgroundColor),
    ]);
    expect(pressedBackground).not.toBe(otherBackground);
    const shape = await picked(page, '.choice[aria-pressed="true"]');
    expect([shape.outlineStyle, shape.outlineWidth]).toEqual(['solid', '3px']);
  });

  test('«Dal libro»: la parola scelta è sottolineata di spesso', async ({ page }) => {
    await fakeOcr(page, 'Le piante producono ossigeno.');
    await newMap(page, 'Le piante');
    await toolbar(page, 'Dal libro');
    const dialog = await photographPage(page);
    await dialog.getByRole('button', { name: 'ossigeno', exact: true }).click();
    await page.mouse.move(5, 5);
    const word = dialog.locator('.ocr-word.is-selected');
    await expect(word).toHaveCount(1);
    const line = await word.evaluate((el) => {
      const s = getComputedStyle(el);
      return { line: s.textDecorationLine, thickness: s.textDecorationThickness };
    });
    expect(line.line).toBe('underline');
    expect(line.thickness).toBe('3px');
  });
});
