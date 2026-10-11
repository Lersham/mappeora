import { test, expect } from './fixtures';
import { addConcept, newMap, toolbar } from './helpers';

const PLUS = { name: 'Aggiungi le parole che collegano' };

test.describe('Il «+» sulle linee senza parole', () => {
  test('foglio: il «+» sul ramo e dentro il ramo apre le parole che collegano', async ({ page }) => {
    await newMap(page, 'Il sole');
    await addConcept(page, 'Il sole', 'Luce');
    await addConcept(page, 'Luce', 'Colori');
    const plus = page.getByRole('button', PLUS);
    await expect(plus).toHaveCount(2);
    const dialog = page.getByRole('dialog', { name: 'Parola di collegamento' });
    for (const word of ['dà', 'si divide in'] as const) {
      await plus.first().click();
      if (word === 'dà') {
        await dialog.getByRole('textbox').fill(word);
        await dialog.getByRole('button', { name: 'Fatto' }).click();
      } else await dialog.getByRole('button', { name: word }).click();
      await expect(dialog).toHaveCount(0);
      await expect(page.locator('.ladder-label', { hasText: word })).toBeVisible();
    }
    await expect(plus).toHaveCount(0);
  });

  test('albero: anche la linea curva ha il suo «+»', async ({ page }) => {
    await newMap(page, 'La pioggia', 'Causa ed effetto');
    const edges = await page.locator('.react-flow__edge').count();
    const labelled = await page.locator('.react-flow__edge-text').count();
    const plus = page.getByRole('button', PLUS);
    await expect(plus).toHaveCount(edges - labelled);
    if (edges > labelled) {
      await plus.first().click();
      await expect(page.getByRole('dialog', { name: 'Parola di collegamento' })).toBeVisible();
    }
  });

  test('nel ripasso il «+» non c’è', async ({ page }) => {
    await newMap(page, 'Il sole');
    await addConcept(page, 'Il sole', 'Luce');
    await expect(page.getByRole('button', PLUS)).toHaveCount(1);
    await toolbar(page, 'Ripassa');
    await page.getByRole('button', { name: /^Un passo alla volta/ }).click();
    await page.getByRole('button', { name: 'Avanti' }).click();
    await expect(page.locator('.react-flow__edge')).toHaveCount(1);
    await expect(page.getByRole('button', PLUS)).toHaveCount(0);
  });
});
