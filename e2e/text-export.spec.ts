import { readFile } from 'node:fs/promises';
import AxeBuilder from '@axe-core/playwright';
import type { Locator, Page } from '@playwright/test';
import { test, expect, spoken } from './fixtures';
import { nodes, sampleMap, toolbar } from './helpers';

const WATER = 'Il ciclo dell’acqua';

const at = (id: string, label: string, y: number, extra: object = {}) => ({ id, label, position: { x: 0, y }, ...extra });
const link = (source: string, target: string, label?: string) => ({ id: `${source}-${target}`, source, target, ...(label === undefined ? {} : { label }) });

/** Opens a map from a file, like one a teacher sends. */
async function openMap(page: Page, title: string, nodeList: object[], edges: object[], visible: number) {
  const map = { id: 'prova', title, createdAt: 1, updatedAt: 1, template: 'libera', nodes: nodeList, edges };
  await page.goto('/');
  const chooser = page.waitForEvent('filechooser');
  await page.getByRole('button', { name: 'Apri file' }).click();
  await (await chooser).setFiles({ name: 'prova.mappami', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify({ format: 'mappeora', version: 1, map })) });
  await expect(nodes(page)).toHaveCount(visible);
}

/** A small map with linking words and a closed branch («Condensazione» hides «Nuvole»). */
async function openSmallMap(page: Page) {
  await openMap(
    page,
    WATER,
    [at('a', 'Acqua', 0), at('e', 'Evaporazione', 100), at('s', 'Sole', 200), at('c', 'Condensazione', 300, { collapsed: true }), at('n', 'Nuvole', 400)],
    [link('a', 'e', 'comincia con'), link('e', 's', 'è causata da'), link('a', 'c', 'continua con'), link('c', 'n', 'forma le')],
    4, // «Nuvole» is hidden
  );
}

/** What a child needs to be told «Copiato!»: the message in the window, not under the buttons at the bottom of the card. */
async function expectSeen(message: Locator) {
  await expect
    .poll(() =>
      message.evaluate((el) => {
        const box = el.getBoundingClientRect();
        const top = document.elementFromPoint(box.x + box.width / 2, box.y + box.height / 2);
        return box.height > 0 && box.top >= 0 && box.bottom <= window.innerHeight && !!top && el.contains(top);
      }),
    )
    .toBe(true);
}

/** «Salva e manda» → «Testo». */
async function openText(page: Page) {
  await toolbar(page, 'Salva e manda');
  const dialog = page.getByRole('dialog', { name: 'Salva e manda' });
  await dialog.getByRole('button', { name: /^Testo/ }).click();
  await expect(dialog.getByRole('textbox', { name: 'Testo della mappa' })).toBeVisible();
  return dialog;
}

test.describe('Dalla mappa al testo', () => {
  test('«Scaletta»: i concetti a elenco, ogni livello rientrato di due spazi', async ({ page }) => {
    await sampleMap(page);
    const dialog = await openText(page);
    const preview = dialog.getByRole('textbox', { name: 'Testo della mappa' });
    // The first concept has the name of the map: it is the title, not a bullet again.
    await expect(preview).toHaveValue(
      [WATER, '- Evaporazione', '  - Calore del sole', '  - Vapore', '- Condensazione', '  - Nuvole', '- Precipitazione', '  - Pioggia', '  - Neve'].join('\n'),
    );
    // Scaletta is what is shown first, and the preview can only be read
    await expect(dialog.getByRole('button', { name: 'Scaletta', exact: true })).toHaveAttribute('aria-pressed', 'true');
    await expect(preview).toHaveJSProperty('readOnly', true);
  });

  test('«Frasi» dice le frasi con le parole di collegamento, un capoverso per ramo', async ({ page }) => {
    await openSmallMap(page);
    const dialog = await openText(page);
    const preview = dialog.getByRole('textbox', { name: 'Testo della mappa' });
    await dialog.getByRole('button', { name: 'Frasi', exact: true }).click();
    await expect(dialog.getByRole('button', { name: 'Frasi', exact: true })).toHaveAttribute('aria-pressed', 'true');
    // «Nuvole» is in the closed branch: like the reading, the text leaves it out.
    await expect(preview).toHaveValue(
      [WATER, 'Acqua.', 'Acqua comincia con Evaporazione. Evaporazione è causata da Sole.', 'Acqua continua con Condensazione.'].join('\n\n'),
    );
    await expect(dialog.getByText('Le parti chiuse della mappa qui non ci sono.')).toBeVisible();
    // and back
    await dialog.getByRole('button', { name: 'Scaletta', exact: true }).click();
    await expect(preview).toHaveValue([WATER, '- Acqua', '  - Evaporazione', '    - Sole', '  - Condensazione'].join('\n'));
  });

  test('«Frasi» di un esempio: le frasi con le parole di collegamento dell’insegnante', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('button', { name: 'Esempi', exact: true }).click();
    await page.getByRole('button', { name: /^La Rivoluzione francese/ }).click();
    await expect(nodes(page)).toHaveCount(37);
    const dialog = await openText(page);
    await dialog.getByRole('button', { name: 'Frasi', exact: true }).click();
    const text = await dialog.getByRole('textbox', { name: 'Testo della mappa' }).inputValue();
    expect(text.startsWith('La Rivoluzione francese\n\n')).toBe(true);
    expect(text).toContain('La Rivoluzione francese 1789 – 1799 nasce da Le cause.');
    expect(text.split('\n\n').length).toBeGreaterThan(4);
  });

  test('«Copia» mette il testo negli appunti e lo dice', async ({ page }, info) => {
    await sampleMap(page);
    const dialog = await openText(page);
    const shown = await dialog.getByRole('textbox', { name: 'Testo della mappa' }).inputValue();
    await dialog.getByRole('button', { name: 'Copia', exact: true }).click();
    await expect(dialog.getByRole('status')).toHaveText('Copiato!');
    await expectSeen(dialog.getByRole('status'));
    // Only the desktop project is allowed to read the clipboard
    if (info.project.name === 'desktop') expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(shown);
    // another style, another message: «Copiato!» is not left behind for text that was not copied
    await dialog.getByRole('button', { name: 'Frasi', exact: true }).click();
    await expect(dialog.getByRole('status')).toHaveText('');
  });

  test('se il browser non lascia copiare, evidenzia il testo e lo spiega', async ({ page }) => {
    await page.addInitScript(() => {
      Object.defineProperty(navigator, 'clipboard', { value: { writeText: () => Promise.reject(new Error('negato')) } });
      document.execCommand = () => false;
    });
    await sampleMap(page);
    const dialog = await openText(page);
    const preview = dialog.getByRole('textbox', { name: 'Testo della mappa' });
    await dialog.getByRole('button', { name: 'Copia', exact: true }).click();
    await expect(dialog.getByRole('status')).toHaveText('Non sono riuscito a copiare. Ho evidenziato il testo: copialo tu.');
    await expectSeen(dialog.getByRole('status'));
    await expect(preview).toBeFocused();
    expect(await preview.evaluate((el: HTMLTextAreaElement) => el.value.slice(el.selectionStart, el.selectionEnd) === el.value && el.value.length > 0)).toBe(true);
  });

  test('«Salva .txt» scarica il testo in un file col nome della mappa', async ({ page }, info) => {
    await sampleMap(page);
    const dialog = await openText(page);
    const shown = await dialog.getByRole('textbox', { name: 'Testo della mappa' }).inputValue();
    const download = page.waitForEvent('download');
    await dialog.getByRole('button', { name: 'Salva .txt', exact: true }).click();
    const file = await download;
    expect(file.suggestedFilename()).toBe('il-ciclo-dell-acqua-scaletta.txt');
    const saved = info.outputPath('scaletta.txt');
    await file.saveAs(saved);
    expect(await readFile(saved, 'utf8')).toBe(shown);
    await expect(dialog.getByRole('status')).toHaveText('Salvato nei Download.');
    await expectSeen(dialog.getByRole('status'));

    await dialog.getByRole('button', { name: 'Frasi', exact: true }).click();
    const sentences = await dialog.getByRole('textbox', { name: 'Testo della mappa' }).inputValue();
    const second = page.waitForEvent('download');
    await dialog.getByRole('button', { name: 'Salva .txt', exact: true }).click();
    const other = await second;
    expect(other.suggestedFilename()).toBe('il-ciclo-dell-acqua-frasi.txt');
    await other.saveAs(saved);
    expect(await readFile(saved, 'utf8')).toBe(sentences);
  });

  test('se il file non si può salvare, lo dice dove si vede', async ({ page }) => {
    await sampleMap(page);
    const dialog = await openText(page);
    await page.evaluate(() => {
      HTMLAnchorElement.prototype.click = () => {
        throw new Error('disco pieno');
      };
    });
    await dialog.getByRole('button', { name: 'Salva .txt', exact: true }).click();
    const alert = dialog.getByRole('alert');
    await expect(alert).toHaveText('Non sono riuscito a salvare il testo. Riprova.');
    await expectSeen(alert);
    await expect(dialog.getByRole('status')).toHaveText('');
  });

  test('i collegamenti fuori dall’albero (anche un giro che torna indietro) ci sono in «Frasi», non vanno persi', async ({ page }) => {
    await openMap(
      page,
      'Acqua',
      [at('a', 'Acqua', 0), at('e', 'Evaporazione', 100), at('s', 'Sole', 200), at('c', 'Condensazione', 300), at('n', 'Nuvole', 400)],
      [link('a', 'e', 'comincia con'), link('e', 's', 'è causata da'), link('a', 'c', 'continua con'), link('c', 'n', 'forma le'), link('s', 'c'), link('n', 'a', 'fanno cadere')],
      5,
    );
    const dialog = await openText(page);
    const preview = dialog.getByRole('textbox', { name: 'Testo della mappa' });
    const hint = dialog.getByText('Alcuni collegamenti tra i concetti si vedono solo in «Frasi».');
    // The outline is the tree: it says that some links are in «Frasi»
    await expect(preview).toHaveValue(['Acqua', '- Evaporazione', '  - Sole', '- Condensazione', '  - Nuvole'].join('\n'));
    await expect(hint).toBeVisible();
    await dialog.getByRole('button', { name: 'Frasi', exact: true }).click();
    await expect(preview).toHaveValue(
      [
        'Acqua',
        'Acqua comincia con Evaporazione. Evaporazione è causata da Sole.',
        'Acqua continua con Condensazione. Condensazione forma le Nuvole.',
        'C’è un collegamento da Sole a Condensazione. Nuvole fanno cadere Acqua.',
      ].join('\n\n'),
    );
    await expect(hint).toHaveCount(0);
  });

  test('«Ascolta» legge il testo a voce, senza dire i trattini', async ({ page }) => {
    await sampleMap(page);
    const dialog = await openText(page);
    await dialog.getByRole('button', { name: 'Ascolta', exact: true }).click();
    await expect.poll(async () => (await spoken(page)).join('|')).toContain('Neve');
    const said = await spoken(page);
    expect(said.slice(0, 4).map((s) => s.trim())).toEqual([WATER, 'Evaporazione', 'Calore del sole', 'Vapore']);
    expect(said.join(' ')).not.toContain('- ');
    await expect(dialog.getByRole('button', { name: 'Ascolta', exact: true })).toBeVisible();
  });

  test('il testo si vede subito, sopra i pulsanti, e non ha problemi di accessibilità', async ({ page }) => {
    await sampleMap(page);
    const dialog = await openText(page);
    const preview = dialog.getByRole('textbox', { name: 'Testo della mappa' });
    // The kinds fill the card: opening «Testo» scrolls to the text instead of leaving it below the fold
    await expect
      .poll(async () => {
        const [text, buttons] = [await preview.boundingBox(), await dialog.locator('.dialog-actions').boundingBox()];
        return !!text && !!buttons && text.y >= 0 && text.y + 80 < buttons.y;
      })
      .toBe(true);
    await dialog.getByRole('button', { name: 'Copia', exact: true }).click();
    await expect(dialog.getByRole('status')).toHaveText('Copiato!');
    await expectSeen(dialog.getByRole('status'));
    const { violations } = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa']).analyze();
    expect(violations.filter((v) => v.impact === 'serious' || v.impact === 'critical').map((v) => `${v.id}: ${v.help}`)).toEqual([]);
  });

  test('si torna agli altri formati: «Testo» non cambia «PDF da stampare»', async ({ page }) => {
    await sampleMap(page);
    const dialog = await openText(page);
    await dialog.getByRole('button', { name: /^PDF da stampare/ }).click();
    await expect(dialog.getByRole('textbox', { name: 'Testo della mappa' })).toHaveCount(0);
    await expect(dialog.getByRole('button', { name: 'A3 (grande)' })).toBeVisible();
    await expect(dialog.getByRole('button', { name: 'Annulla' })).toBeVisible();
    await dialog.getByRole('button', { name: /^Testo/ }).click();
    await dialog.getByRole('button', { name: 'Chiudi', exact: true }).click();
    await expect(dialog).toHaveCount(0);
  });

  test('mentre si prepara un PDF non si cambia formato: la finestra si chiuderebbe sul testo', async ({ page }) => {
    await sampleMap(page);
    // Hold the PDF library back, so the export stays «in progress» as long as the test wants
    let release!: () => void;
    const gate = new Promise<void>((resolve) => (release = resolve));
    await page.route(/jspdf/, async (route) => {
      await gate;
      await route.continue();
    });
    await toolbar(page, 'Salva e manda');
    const dialog = page.getByRole('dialog', { name: 'Salva e manda' });
    await dialog.getByRole('button', { name: /^PDF da stampare/ }).click();
    await dialog.locator('.dialog-actions').getByRole('button', { name: 'Salva', exact: true }).click();
    await expect(dialog.getByRole('button', { name: 'Preparo…' })).toBeDisabled();
    for (const kind of [/^Testo/, /^Immagine/, /^File modificabile/, /^PDF da stampare/]) await expect(dialog.getByRole('button', { name: kind })).toBeDisabled();
    release();
    await expect(dialog).toHaveCount(0);
  });
});
