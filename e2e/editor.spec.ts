import { test, expect, spoken } from './fixtures';
import { addConcept, boxes, newMap, node, nodes, onScreen, overlapping, rename, sampleMap, settled, showAll, tapLink, toolbar } from './helpers';

test.describe('Editor', () => {
  test('aggiunge, rinomina, annulla, ripete ed elimina concetti', async ({ page }) => {
    await newMap(page, 'Gli animali');
    await addConcept(page, 'Gli animali', 'Vertebrati');
    await addConcept(page, 'Gli animali', 'Invertebrati');
    await expect(nodes(page)).toHaveCount(3);

    await page.getByRole('button', { name: 'Annulla' }).click(); // the rename
    await expect(node(page, 'Nuovo concetto')).toBeVisible();
    await page.getByRole('button', { name: 'Ripeti' }).click();
    await expect(node(page, 'Invertebrati')).toBeVisible();

    await node(page, 'Invertebrati').click();
    await toolbar(page, 'Elimina');
    await expect(nodes(page)).toHaveCount(2);
    await expect(page.locator('.react-flow__edge')).toHaveCount(1);
  });

  test('mette le parole di collegamento su una freccia', async ({ page }) => {
    await newMap(page, 'L’acqua');
    await addConcept(page, 'L’acqua', 'Idrogeno');
    await tapLink(page, 0);
    await page.getByRole('button', { name: 'è formato da' }).click();
    await expect(page.locator('.ladder-label')).toHaveText('è formato da');
  });

  test('nasconde e mostra i concetti sotto un ramo', async ({ page }) => {
    await sampleMap(page);
    await expect(nodes(page)).toHaveCount(9);
    await node(page, 'Precipitazione').getByRole('button', { name: 'Nascondi i concetti sotto' }).click();
    await expect(nodes(page)).toHaveCount(7);
    const toggle = node(page, 'Precipitazione').getByRole('button', { name: /Mostra 2 concetti/ });
    await expect(toggle).toHaveText('+2');
    await toggle.click();
    await expect(nodes(page)).toHaveCount(9);
  });

  test('dispone la mappa a misura di foglio A4: rami affiancati, nessuna sovrapposizione', async ({ page }) => {
    await sampleMap(page);
    const b = await boxes(page);
    expect(overlapping(b)).toEqual([]);
    const at = (label: string) => b.find((x) => x.label === label)!;
    const root = at('Il ciclo dell’acqua');
    for (const x of b.filter((x) => x !== root)) expect(x.y).toBeGreaterThan(root.y);
    // branches side by side, each one's concepts below it and indented
    expect(at('Condensazione').y).toBeCloseTo(at('Evaporazione').y, 0);
    expect(at('Condensazione').x).toBeGreaterThan(at('Evaporazione').x);
    expect(at('Calore del sole').y).toBeGreaterThan(at('Evaporazione').y);
    expect(at('Calore del sole').x).toBeGreaterThan(at('Evaporazione').x);
    expect(at('Vapore').y).toBeGreaterThan(at('Calore del sole').y);
  });

  test('trascinando un concetto si cambia l’ordine nel ramo', async ({ page, isMobile }) => {
    test.skip(isMobile, 'il trascinamento con il mouse si prova sul computer');
    await sampleMap(page);
    const vapore = await node(page, 'Vapore').boundingBox();
    const calore = await node(page, 'Calore del sole').boundingBox();
    await page.mouse.move(vapore!.x + 20, vapore!.y + 8);
    await page.mouse.down();
    // well above it: the view scrolls by itself when dragging near the edge
    await page.mouse.move(vapore!.x + 20, calore!.y - 60, { steps: 10 });
    await page.mouse.up();
    await settled(page);
    const [v, c] = [await node(page, 'Vapore').boundingBox(), await node(page, 'Calore del sole').boundingBox()];
    expect(v!.y).toBeLessThan(c!.y);
    // one undo puts it back
    await page.getByRole('button', { name: 'Annulla' }).click();
    await settled(page);
    expect((await node(page, 'Vapore').boundingBox())!.y).toBeGreaterThan((await node(page, 'Calore del sole').boundingBox())!.y);
  });

  test('«Sposta» lascia i concetti dove li metti, «Riordina» rimette la mappa sul foglio A4', async ({ page, isMobile }) => {
    test.skip(isMobile, 'il trascinamento con il mouse si prova sul computer');
    await sampleMap(page);
    const onSheet = await boxes(page);
    await toolbar(page, 'Sposta');
    await expect(page.getByRole('navigation', { name: 'Strumenti' }).getByRole('button', { name: 'Sposta' })).toHaveCount(0);

    // far to the right of its branch: on the sheet it would snap back
    const neve = (await node(page, 'Neve').boundingBox())!;
    await page.mouse.move(neve.x + 20, neve.y + 8);
    await page.mouse.down();
    await page.mouse.move(neve.x + 140, neve.y + 30, { steps: 10 });
    await page.mouse.up();
    await settled(page);
    const moved = (await node(page, 'Neve').boundingBox())!;
    expect(moved.x - neve.x).toBeGreaterThan(80);

    await toolbar(page, 'Riordina');
    await expect(page.getByRole('navigation', { name: 'Strumenti' }).getByRole('button', { name: 'Sposta' })).toBeVisible();
    await showAll(page);
    await settled(page);
    const tidy = await boxes(page);
    expect(overlapping(tidy)).toEqual([]);
    // back in its place on the sheet, below "Pioggia" in the same column
    const at = (b: typeof tidy, label: string) => b.find((x) => x.label === label)!;
    expect(at(tidy, 'Neve').x).toBeCloseTo(at(tidy, 'Pioggia').x, 0);
    expect(at(tidy, 'Neve').y).toBeGreaterThan(at(tidy, 'Pioggia').y);
    expect(tidy.length).toBe(onSheet.length);
    // and every other concept back where the sheet had it
    // (the view may frame it at another zoom: compare from the main concept, to scale)
    const [r0, r1] = [at(onSheet, 'Il ciclo dell’acqua'), at(tidy, 'Il ciclo dell’acqua')];
    const k = r1.w / r0.w;
    for (const b of onSheet) {
      expect(at(tidy, b.label).x - r1.x, b.label).toBeCloseTo((b.x - r0.x) * k, -1);
      expect(at(tidy, b.label).y - r1.y, b.label).toBeCloseTo((b.y - r0.y) * k, -1);
    }
  });

  test('«Riordina» mette in colonna la linea del tempo', async ({ page }) => {
    await newMap(page, 'Il Novecento', 'Linea del tempo');
    await toolbar(page, 'Riordina');
    await settled(page);
    const b = await boxes(page);
    const ys = b.map((x) => x.y);
    expect([...ys].sort((p, q) => p - q)).toEqual(ys); // top to bottom, in order
    expect(overlapping(b)).toEqual([]);
  });

  test('sulla linea del tempo un concetto nuovo non copre quelli che ci sono già', async ({ page }) => {
    await newMap(page, 'Il Novecento', 'Linea del tempo');
    await toolbar(page, 'Riordina');
    await settled(page);
    const before = (await boxes(page)).length;
    for (let i = 0; i < 3; i++) {
      await page.getByRole('button', { name: 'Concetto', exact: true }).click();
      await settled(page);
    }
    await showAll(page);
    await settled(page);
    const b = await boxes(page);
    expect(b.length).toBe(before + 3);
    expect(overlapping(b)).toEqual([]);
  });

  test('rinomina con doppio clic e il titolo resta quello della mappa', async ({ page }) => {
    await newMap(page, 'Le stagioni');
    await rename(page, 'Le stagioni', 'Le quattro stagioni');
    await expect(page.locator('.title-input')).toHaveValue('Le stagioni');
  });

  test('da tastiera: Invio rinomina, Canc elimina e un solo «Annulla» lo rimette', async ({ page, isMobile }) => {
    test.skip(isMobile, 'Tastiera fisica');
    await newMap(page, 'I pianeti');
    await addConcept(page, 'I pianeti', 'Marte');
    await settled(page);
    await page.locator('.react-flow__node', { has: node(page, 'Marte') }).focus();
    await page.keyboard.press('Enter');
    const input = page.getByRole('textbox', { name: 'Testo del concetto' });
    await input.fill('Giove');
    await input.press('Enter');
    await expect(node(page, 'Giove')).toBeVisible();

    await page.locator('.react-flow__node', { has: node(page, 'Giove') }).focus();
    await page.keyboard.press('Delete');
    await expect(nodes(page)).toHaveCount(1);
    await page.getByRole('button', { name: 'Annulla' }).click();
    await expect(nodes(page)).toHaveCount(2);
    await expect(page.locator('.react-flow__edge')).toHaveCount(1);
  });
});

test.describe('Editor: scrivere più in fretta e vedere meglio', () => {
  test('un concetto nuovo è subito pronto; Tab ne fa uno sotto, Maiusc+Tab uno accanto', async ({ page, isMobile }) => {
    test.skip(isMobile, 'la tastiera fisica si prova sul computer');
    await newMap(page, 'Gli animali');
    await node(page, 'Gli animali').click();
    await page.getByRole('button', { name: 'Concetto', exact: true }).click();
    const input = page.getByRole('textbox', { name: 'Testo del concetto' });
    await expect(input).toBeFocused();
    await page.keyboard.type('Vertebrati');
    await page.keyboard.press('Tab');
    await expect(input).toBeFocused();
    await page.keyboard.type('Mammiferi');
    await page.keyboard.press('Shift+Tab');
    await expect(input).toBeFocused();
    await page.keyboard.type('Uccelli');
    await page.keyboard.press('Enter');
    await expect(input).toHaveCount(0);
    await settled(page);

    await page.getByRole('navigation', { name: 'Strumenti' }).getByRole('button', { name: 'Leggi', exact: true }).click();
    await expect.poll(() => spoken(page)).toEqual(['Gli animali', 'Vertebrati', 'Mammiferi', 'Uccelli']);
    const b = await boxes(page);
    const at = (label: string) => b.find((x) => x.label === label)!;
    // «Mammiferi» and «Uccelli» are both under «Vertebrati»
    expect(at('Uccelli').x).toBeCloseTo(at('Mammiferi').x, 0);
    expect(at('Mammiferi').x).toBeGreaterThan(at('Vertebrati').x);
  });

  test('ogni ramo ha le linee del suo colore; i pallini per collegare solo sul concetto scelto', async ({ page }) => {
    await sampleMap(page);
    const colours = await page.locator('.react-flow__edge-path.branch-line').evaluateAll((paths) => [
      ...new Set(paths.map((p) => [...p.classList].find((c) => /^branch-\d$/.test(c)))),
    ]);
    expect(colours.sort()).toEqual(['branch-0', 'branch-1', 'branch-2']);

    await (await onScreen(page, node(page, 'Vapore'))).click();
    const handleOpacity = (label: string) =>
      page
        .locator('.react-flow__node', { has: page.locator('.concept-label', { hasText: label }) })
        .locator('.react-flow__handle:not(.handle-hidden)')
        .first()
        .evaluate((h) => getComputedStyle(h).opacity);
    await expect.poll(() => handleOpacity('Vapore')).toBe('1');
    await expect.poll(() => handleOpacity('Neve')).toBe('0');
  });

  test('sul telefono, toccando un concetto di una mappa vista da lontano, il suo ramo si avvicina', async ({ page, isMobile }) => {
    test.skip(!isMobile, 'sul computer la mappa d’esempio si legge già');
    await page.goto('/');
    await page.getByRole('button', { name: 'Esempi', exact: true }).click();
    await page.getByRole('button', { name: /^La Rivoluzione francese/ }).click();
    await expect(nodes(page)).toHaveCount(37);
    await showAll(page);
    const onScreenPx = (label: string) =>
      node(page, label)
        .locator('.concept-label')
        .evaluate((el) => (parseFloat(getComputedStyle(el).fontSize) * el.getBoundingClientRect().height) / (el as HTMLElement).offsetHeight);
    expect(await onScreenPx('Le cause')).toBeLessThan(12);
    await node(page, 'Le cause').click();
    await expect.poll(() => onScreenPx('Le cause'), { timeout: 5000 }).toBeGreaterThanOrEqual(12);
    await expect(node(page, 'Le cause')).toBeInViewport();
  });
});
