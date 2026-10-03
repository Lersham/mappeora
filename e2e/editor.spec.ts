import { test, expect } from './fixtures';
import { addConcept, boxes, newMap, node, nodes, overlapping, rename, sampleMap, settled, tapLink, toolbar } from './helpers';

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

  test('«Riordina» mette in colonna la linea del tempo', async ({ page }) => {
    await newMap(page, 'Il Novecento', 'Linea del tempo');
    await toolbar(page, 'Riordina');
    await settled(page);
    const b = await boxes(page);
    const ys = b.map((x) => x.y);
    expect([...ys].sort((p, q) => p - q)).toEqual(ys); // top to bottom, in order
    expect(overlapping(b)).toEqual([]);
  });

  test('rinomina con doppio clic e il titolo resta quello della mappa', async ({ page }) => {
    await newMap(page, 'Le stagioni');
    await rename(page, 'Le stagioni', 'Le quattro stagioni');
    await expect(page.locator('.title-input')).toHaveValue('Le stagioni');
  });
});
