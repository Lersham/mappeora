import AxeBuilder from '@axe-core/playwright';
import { test, expect, freshInstall, PNG_1PX } from './fixtures';
import { fakeOcr, fakeOcrWorker, newMap, node, nodes, openCopy, photographPage, toolbar } from './helpers';

/** WCAG 2.2 A/AA problems that block or seriously hinder someone. */
async function seriousProblems(page: import('@playwright/test').Page) {
  const { violations } = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa']).analyze();
  return violations
    .filter((v) => v.impact === 'serious' || v.impact === 'critical')
    .map((v) => `${v.id}: ${v.help} (${v.nodes.length}) → ${v.nodes.slice(0, 3).map((n) => n.target.join(' ')).join(' | ')}`);
}

test.describe('Accessibilità (axe-core)', () => {
  test('schermata iniziale', async ({ page }) => {
    await page.goto('/');
    expect(await seriousProblems(page)).toEqual([]);
  });

  test('schermata iniziale con tante mappe, la ricerca e «Annulla»', async ({ page }) => {
    await openCopy(page, ['Uno', 'Due', 'Tre', 'Quattro', 'Cinque', 'Sei', 'Sette', 'Otto']);
    await page.getByRole('searchbox', { name: 'Cerca una mappa' }).fill('nulla');
    expect(await seriousProblems(page)).toEqual([]);
    await page.getByRole('searchbox', { name: 'Cerca una mappa' }).fill('');
    await page.getByRole('button', { name: 'Cancella Otto' }).click();
    expect(await seriousProblems(page)).toEqual([]);
  });

  test('informativa privacy', async ({ page }) => {
    await page.goto('/privacy.html');
    expect(await seriousProblems(page)).toEqual([]);
  });

  test('crediti e licenze', async ({ page }) => {
    await page.goto('/crediti.html');
    expect(await seriousProblems(page)).toEqual([]);
  });

  test('nuova mappa', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('button', { name: 'Nuova mappa' }).click();
    expect(await seriousProblems(page)).toEqual([]);
  });

  test('editor', async ({ page }) => {
    await newMap(page, 'Il sistema solare', 'Le 5 W');
    expect(await seriousProblems(page)).toEqual([]);
  });

  test('scelta dell’immagine', async ({ page }) => {
    await newMap(page, 'Il vulcano');
    await node(page, 'Il vulcano').click();
    await toolbar(page, 'Immagine');
    await expect(page.locator('.illustration-tile').first()).toBeVisible();
    expect(await seriousProblems(page)).toEqual([]);
  });
});

test.describe('Accessibilità (axe-core): finestre e passi', () => {
  test('accoglienza del primo avvio, prima e ultima pagina', async ({ page }) => {
    await freshInstall(page);
    const welcome = page.getByRole('dialog', { name: 'Come funziona' });
    await expect(welcome.getByRole('heading', { name: 'Benvenuto in MappAmi' })).toBeVisible();
    expect(await seriousProblems(page)).toEqual([]);
    for (let i = 0; i < 4; i++) await welcome.getByRole('button', { name: 'Avanti' }).click();
    await expect(welcome.getByRole('button', { name: 'Inizia' })).toBeVisible();
    expect(await seriousProblems(page)).toEqual([]);
  });

  test('Aspetto e voce', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('button', { name: 'Aspetto' }).click();
    await expect(page.getByRole('dialog', { name: 'Aspetto e voce' })).toBeVisible();
    expect(await seriousProblems(page)).toEqual([]);
  });

  test('Esempi, anche quando non si aprono', async ({ page }) => {
    await page.route('**/esempi/**', (route) => route.abort());
    await page.goto('/');
    await page.getByRole('button', { name: 'Esempi', exact: true }).click();
    const dialog = page.getByRole('dialog', { name: 'Mappe di esempio' });
    await expect(dialog).toBeVisible();
    expect(await seriousProblems(page)).toEqual([]);
    await dialog.getByRole('button', { name: /^La Rivoluzione francese/ }).click();
    await expect(dialog.getByRole('alert')).toBeVisible();
    expect(await seriousProblems(page)).toEqual([]);
  });

  test('Salva e manda, per ogni tipo di file', async ({ page }) => {
    await newMap(page, 'Il vulcano');
    await toolbar(page, 'Salva e manda');
    const dialog = page.getByRole('dialog', { name: 'Salva e manda' });
    await expect(dialog).toBeVisible();
    expect(await seriousProblems(page)).toEqual([]);
    for (const kind of [/^Immagine/, /^File modificabile/]) {
      await dialog.getByRole('button', { name: kind }).click();
      expect(await seriousProblems(page)).toEqual([]);
    }
  });

  test('Nome, colore e immagine, in ogni scheda', async ({ page }) => {
    await newMap(page, 'Il vulcano');
    await node(page, 'Il vulcano').click();
    await toolbar(page, 'Immagine');
    const dialog = page.getByRole('dialog', { name: 'Nome, colore e immagine' });
    await expect(dialog.locator('.illustration-tile').first()).toBeVisible();
    // the colour the concept has now is the one picked: the picked swatch is scanned too
    await expect(dialog.locator('.color-swatch[aria-pressed="true"]')).toHaveCount(1);
    expect(await seriousProblems(page)).toEqual([]);
    await dialog.getByRole('button', { name: /Foto e Google/ }).click();
    expect(await seriousProblems(page)).toEqual([]);
  });

  test('«Dal libro»: scelta della foto, lettura e parole scelte', async ({ page }) => {
    await fakeOcrWorker(page, 'self.onmessage = () => {};');
    await newMap(page, 'La cellula');
    await toolbar(page, 'Dal libro');
    const dialog = page.getByRole('dialog', { name: 'Dal libro' });
    await expect(dialog.getByRole('button', { name: 'Scegli una foto' })).toBeVisible();
    expect(await seriousProblems(page)).toEqual([]);

    // reading: the progress bar has a name
    const chooser = page.waitForEvent('filechooser');
    await dialog.getByRole('button', { name: 'Scegli una foto' }).click();
    await (await chooser).setFiles({ name: 'pagina.png', mimeType: 'image/png', buffer: PNG_1PX });
    await expect(dialog.getByRole('progressbar', { name: 'Sto leggendo la pagina…' })).toBeVisible();
    expect(await seriousProblems(page)).toEqual([]);
  });

  test('«Dal libro»: il testo con una parola scelta', async ({ page }) => {
    await fakeOcr(page, 'La fotosintesi avviene nelle foglie.\nLe piante producono ossigeno.');
    await newMap(page, 'Le piante');
    await toolbar(page, 'Dal libro');
    const dialog = await photographPage(page);
    await dialog.getByRole('button', { name: 'ossigeno', exact: true }).click();
    await expect(dialog.locator('.ocr-word.is-selected')).toHaveCount(1);
    expect(await seriousProblems(page)).toEqual([]);
    await dialog.getByRole('button', { name: 'Correggi' }).click();
    await expect(dialog.getByRole('textbox', { name: 'Testo letto dalla foto' })).toBeVisible();
    expect(await seriousProblems(page)).toEqual([]);
  });
});

/** The settings of a child who needs the most from the page: dark or pale paper, a wide font, big text. */
for (const theme of ['scuro', 'azzurro'] as const) {
  test.describe(`Accessibilità (axe-core): tema ${theme}, OpenDyslexic, testo grande`, () => {
    test.beforeEach(async ({ page }) => {
      await page.addInitScript((theme) => {
        if (!localStorage.getItem('mappeora-settings')) {
          const state = { font: 'opendyslexic', textScale: 1.8, uppercase: false, wideSpacing: true, theme, speechRate: 0.9, highlightWords: true };
          localStorage.setItem('mappeora-settings', JSON.stringify({ state, version: 1 }));
        }
      }, theme);
    });

    test('schermata iniziale, anche con tante mappe', async ({ page }) => {
      await page.goto('/');
      await expect(page.locator('html')).toHaveAttribute('data-theme', theme);
      expect(await seriousProblems(page)).toEqual([]);
      await openCopy(page, ['Uno', 'Due', 'Tre', 'Quattro', 'Cinque', 'Sei', 'Sette', 'Otto']);
      expect(await seriousProblems(page)).toEqual([]);
    });

    test('editor, con un concetto scelto', async ({ page }) => {
      await newMap(page, 'Il sistema solare', 'Le 5 W');
      expect(await seriousProblems(page)).toEqual([]);
      await node(page, 'Il sistema solare').click();
      await expect(node(page, 'Il sistema solare')).toHaveClass(/is-selected/);
      expect(await seriousProblems(page)).toEqual([]);
    });

    test('Aspetto e voce', async ({ page }) => {
      await page.goto('/');
      await page.getByRole('button', { name: 'Aspetto' }).click();
      await expect(page.getByRole('dialog', { name: 'Aspetto e voce' })).toBeVisible();
      expect(await seriousProblems(page)).toEqual([]);
    });
  });
}

test.describe('Tastiera', () => {
  test('Esc chiude il dialogo e il fuoco torna al pulsante che l’ha aperto', async ({ page, isMobile }) => {
    test.skip(isMobile, 'on a phone «Aspetto» is under «Altro», which closes');
    await newMap(page, 'I vulcani');
    await toolbar(page, 'Aspetto');
    const settings = page.getByRole('dialog', { name: 'Aspetto e voce' });
    await expect(settings).toBeVisible();
    await expect(settings).toBeFocused();
    await page.keyboard.press('Escape');
    await expect(settings).toHaveCount(0);
    await expect(page.locator('.topbar').getByRole('button', { name: 'Aspetto', exact: true })).toBeFocused();
  });

  test('Invio su un collegamento apre la parola di collegamento', async ({ page, isMobile }) => {
    await newMap(page, 'Il sistema solare', 'Le 5 W');
    const link = page.getByRole('group', { name: /^Collegamento da «Il sistema solare»/ }).first();
    await link.focus();
    await page.keyboard.press('Enter');
    const dialog = page.getByRole('dialog', { name: 'Parola di collegamento' });
    await expect(dialog).toBeVisible();
    const field = dialog.getByRole('textbox');
    if (isMobile) {
      // The on-screen keyboard would cover the words and «Togli freccia»: it
      // opens only when the child taps the field.
      await expect(field).not.toBeFocused();
      await field.click();
    }
    await expect(field).toBeFocused();
    await page.keyboard.type('ha');
    await dialog.getByRole('button', { name: 'Fatto' }).click();
    await expect(page.getByRole('group', { name: /^Collegamento da «Il sistema solare» a .*: ha$/ })).toHaveCount(1);
  });
});
