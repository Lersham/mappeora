import { test, expect } from './fixtures';
import { addConcept, boxes, newMap, node, nodes, overlapping, rename, sampleMap, settled, showAll, tapLink, toolbar } from './helpers';

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
