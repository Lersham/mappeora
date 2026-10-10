import { test, expect, say, spoken } from './fixtures';
import { newMap, node, nodes, rename, tapLink, toolbar } from './helpers';

test.describe('Impara facendo', () => {
  test('dalla home costruisce una mappa vera, un passo alla volta', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('button', { name: 'Impara facendo' }).click();
    const coach = page.getByRole('region', { name: 'Tutorial' });
    const bar = page.getByRole('navigation', { name: 'Strumenti' });
    const next = async (title: string) => {
      await expect(coach.getByRole('status')).toContainText('Ben fatto');
      await coach.getByRole('button', { name: 'Avanti' }).click();
      await expect(coach.getByRole('heading', { name: title })).toBeVisible();
    };

    await expect(coach.getByRole('heading', { name: 'L’idea principale' })).toBeVisible();
    await expect(coach).toContainText('Passo 1 di 8');
    await expect(page.locator('.title-input')).toHaveValue('La mia prima mappa');
    // Until the step is done there is only «Salta».
    await expect(coach.getByRole('button', { name: 'Avanti' })).toHaveCount(0);
    await coach.getByRole('button', { name: 'Ascolta' }).click();
    await expect.poll(() => spoken(page)).toContainEqual(expect.stringContaining('L’idea principale.'));

    await rename(page, 'La mia prima mappa', 'Il sole');
    await next('Un nuovo concetto');

    const concept = bar.getByRole('button', { name: 'Concetto', exact: true });
    await expect(concept).toHaveClass(/tutorial-target/);
    await concept.click();
    await next('Dagli un nome');
    await expect(concept).not.toHaveClass(/tutorial-target/);

    await rename(page, 'Nuovo concetto', 'Luce e calore');
    await next('Le parole che collegano');

    await tapLink(page, 0);
    await page.getByRole('dialog', { name: 'Parola di collegamento' }).getByRole('button', { name: 'serve per' }).click();
    await next('Ascolta la mappa');

    await bar.getByRole('button', { name: 'Leggi', exact: true }).click();
    await next('Detta un concetto');
    // «Avanti» does not cut the reading short.
    await expect.poll(() => spoken(page)).toContainEqual(expect.stringContaining('Il sole'));

    await say(page, 'Estate');
    await toolbar(page, 'Detta');
    await expect(node(page, 'Estate')).toBeVisible();
    await next('Un’immagine');

    // «Estate», just dictated, is already the concept in hand: its tools are there.
    const image = page.getByRole('toolbar', { name: 'Concetto scelto' }).getByRole('button', { name: 'Immagine', exact: true });
    await expect(image).toHaveClass(/tutorial-target/);
    await image.click();
    await page.getByRole('searchbox', { name: 'Cerca un\'immagine' }).fill('sole');
    await page.locator('.illustration-tile').first().click();
    await expect(node(page, 'Estate').locator('.concept-illustration, .concept-emoji')).toBeVisible();
    await next('Ce l’hai fatta!');

    await expect(coach.getByRole('button', { name: 'Chiudi' })).toHaveCount(0);
    await coach.getByRole('button', { name: 'Fine' }).click();
    await expect(coach).toHaveCount(0);
    await expect(nodes(page)).toHaveCount(3);

    // The map is a real one: it is in «Le mie mappe».
    await page.getByRole('button', { name: 'Mappe', exact: true }).click();
    await expect(page.locator('.map-title', { hasText: 'La mia prima mappa' })).toBeVisible();
  });

  test('«Salta» va avanti senza fare il passo, «Chiudi» toglie la guida', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('button', { name: 'Impara facendo' }).click();
    const coach = page.getByRole('region', { name: 'Tutorial' });
    await coach.getByRole('button', { name: 'Salta' }).click();
    await expect(coach.getByRole('heading', { name: 'Un nuovo concetto' })).toBeVisible();
    await expect(coach).toContainText('Passo 2 di 8');
    await coach.getByRole('button', { name: 'Chiudi' }).click();
    await expect(coach).toHaveCount(0);
    await expect(page.locator('.tutorial-target')).toHaveCount(0);
  });

  test('una mappa nuova qualsiasi non ha la guida', async ({ page }) => {
    await newMap(page, 'Le piante');
    await expect(page.getByRole('region', { name: 'Tutorial' })).toHaveCount(0);
  });
});
