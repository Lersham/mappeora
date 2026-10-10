import { test, expect, say } from './fixtures';
import { newMap, node, nodes, settled, toolbar } from './helpers';

test.describe('Scaletta', () => {
  test('costruisce la mappa da un elenco puntato e la rilegge come elenco', async ({ page }) => {
    await newMap(page, 'Il ciclo dell’acqua');
    await toolbar(page, 'Scaletta');
    const outline = page.getByRole('dialog', { name: 'Scaletta' });
    const row = (n: number, level: number) => outline.getByRole('textbox', { name: `Riga ${n}, livello ${level}` });
    await expect(row(1, 1)).toHaveValue('Il ciclo dell’acqua');

    await row(1, 1).press('Enter'); // a new line goes under the main concept
    await row(2, 2).fill('Evaporazione');
    await row(2, 2).press('Enter');
    await row(3, 2).fill('Calore del sole');
    await row(3, 2).press('Tab'); // under «Evaporazione»
    await row(3, 3).press('Enter');
    await row(4, 3).fill('Nuvole');
    await outline.getByRole('button', { name: 'Sposta a sinistra' }).nth(3).click();
    await expect(row(4, 2)).toHaveValue('Nuvole');

    await say(page, 'Pioggia');
    await outline.getByRole('button', { name: 'Detta una nuova riga' }).click();
    await expect(row(5, 2)).toHaveValue('Pioggia');

    await outline.getByRole('button', { name: 'Fatto' }).click();
    await expect(outline).toHaveCount(0);
    await expect(nodes(page)).toHaveCount(5);
    await expect(page.locator('.react-flow__edge')).toHaveCount(4);
    await settled(page);

    // The list read back from the map, in the order of the sheet.
    await toolbar(page, 'Scaletta');
    const values = () => outline.locator('.outline-input').evaluateAll((els) => els.map((e) => (e as HTMLInputElement).value));
    await expect.poll(values).toEqual(['Il ciclo dell’acqua', 'Evaporazione', 'Calore del sole', 'Nuvole', 'Pioggia']);
    await expect(row(3, 3)).toHaveValue('Calore del sole');
    await outline.getByRole('button', { name: 'Togli la riga' }).nth(1).click(); // «Calore del sole» moves up a level
    await expect(row(2, 2)).toHaveValue('Calore del sole');
    await outline.getByRole('button', { name: 'Fatto' }).click();
    await expect(nodes(page)).toHaveCount(4);
    await expect(node(page, 'Evaporazione')).toHaveCount(0);

    await page.getByRole('button', { name: 'Annulla', exact: true }).click(); // one step undoes it all
    await expect(nodes(page)).toHaveCount(5);
  });

  test('«Annulla» lascia la mappa com’era', async ({ page }) => {
    await newMap(page, 'Le piante');
    await toolbar(page, 'Scaletta');
    const outline = page.getByRole('dialog', { name: 'Scaletta' });
    await outline.getByRole('button', { name: 'Nuova riga', exact: true }).click();
    await page.keyboard.type('Radici');
    await outline.getByRole('button', { name: 'Annulla' }).click();
    await expect(nodes(page)).toHaveCount(1);
  });
});

test.describe('Strumenti', () => {
  test('🔊 compare solo sul concetto scelto e lo legge', async ({ page }) => {
    await newMap(page, 'I vulcani');
    const speak = page.getByRole('button', { name: 'Leggi: I vulcani' });
    await expect(speak).toHaveCount(0);
    await node(page, 'I vulcani').click();
    await speak.click();
    await expect.poll(() => page.evaluate(() => (window as unknown as { __spoken: string[] }).__spoken)).toContain('I vulcani');
  });

  test('sul telefono i comandi principali restano in vista, gli altri sono in «Altro»', async ({ page, isMobile }) => {
    test.skip(!isMobile, 'il menu «Altro» c’è solo sullo schermo piccolo');
    await newMap(page, 'La Rivoluzione francese');
    const bar = page.getByRole('navigation', { name: 'Strumenti' });
    const visible = await bar.getByRole('button').evaluateAll((els) =>
      els.filter((e) => (e as HTMLElement).offsetParent !== null).map((e) => e.querySelector('.big-button-label')?.textContent),
    );
    expect(visible).toEqual(['Concetto', 'Detta', 'Leggi', 'Ripassa', 'Altro']);

    // One thin row above the map: back, the title (a long one ends with «…»), undo and redo.
    const top = await page.locator('.topbar').boundingBox();
    expect(top!.height).toBeLessThan(64);
    expect(await page.locator('.title-input').evaluate((e) => getComputedStyle(e).textOverflow)).toBe('ellipsis');

    await bar.getByRole('button', { name: 'Altro' }).click();
    const more = page.getByRole('dialog', { name: 'Altro' });
    // It comes up from the bottom, where the bar it was opened from is (once it has slid in).
    const card = more.locator('.overlay-card');
    await expect.poll(async () => card.boundingBox().then((b) => Math.round(b!.y + b!.height))).toBe(page.viewportSize()!.height);
    for (const name of ['Scaletta', 'Dal libro', 'Sposta', 'Salva', 'Aspetto'])
      await expect(more.getByRole('button', { name, exact: true })).toBeVisible();
    await more.getByRole('button', { name: 'Chiudi' }).click();
    await expect(more).toHaveCount(0);
  });
});
