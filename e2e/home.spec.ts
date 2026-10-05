import { test, expect } from './fixtures';
import { newMap, nodes, type TemplateName } from './helpers';

test.describe('Schermata iniziale', () => {
  const templates: [TemplateName, number][] = [
    ['Libera', 1],
    ['Le 5 W', 6],
    ['Causa ed effetto', 5],
    ['Linea del tempo', 5],
    ['Confronto', 6],
  ];
  for (const [template, count] of templates) {
    test(`crea una mappa dal modello «${template}»`, async ({ page }) => {
      await newMap(page, `Prova ${template}`, template);
      await expect(nodes(page)).toHaveCount(count);
    });
  }

  test('la mappa si salva da sola e resta dopo aver ricaricato la pagina', async ({ page }) => {
    await newMap(page, 'La fotosintesi');
    await page.locator('.title-input').fill('La fotosintesi delle piante');
    await page.getByRole('button', { name: 'Mappe' }).click();
    await expect(page.locator('.map-title')).toHaveText(['La fotosintesi delle piante']);
    await page.reload();
    await page.locator('.map-open', { hasText: 'La fotosintesi delle piante' }).click();
    await expect(nodes(page)).toHaveCount(1);
  });

  test('se la mappa è cambiata in un’altra finestra non la sovrascrive: si salva come copia', async ({ page, context }) => {
    await newMap(page, 'Le piante');
    await page.getByRole('button', { name: 'Mappe' }).click();
    await page.locator('.map-open', { hasText: 'Le piante' }).click();
    const other = await context.newPage();
    await other.goto('/');
    await other.locator('.map-open', { hasText: 'Le piante' }).click();
    await other.locator('.title-input').fill('Le piante (altra finestra)');
    await other.getByRole('button', { name: 'Mappe' }).click();
    await expect(other.locator('.map-title')).toHaveText(['Le piante (altra finestra)']);

    await page.locator('.title-input').fill('Le piante (qui)');
    const notice = page.getByRole('alert').filter({ hasText: 'cambiata in un’altra finestra' });
    await expect(notice).toBeVisible();
    await notice.getByRole('button', { name: 'Salva come copia' }).click();
    await expect(notice).toBeHidden();
    await expect(page.locator('.title-input')).toHaveValue('Le piante (qui) (copia)');
    await page.getByRole('button', { name: 'Mappe' }).click();
    await expect(page.locator('.map-title')).toHaveText(['Le piante (qui) (copia)', 'Le piante (altra finestra)']);
  });

  test('cancella una mappa dopo la conferma', async ({ page }) => {
    await newMap(page, 'Da cancellare');
    await page.getByRole('button', { name: 'Mappe' }).click();
    page.once('dialog', (d) => void d.accept());
    await page.getByRole('button', { name: 'Cancella Da cancellare' }).click();
    await expect(page.locator('.map-card')).toHaveCount(0);
    await expect(page.getByText('Non hai ancora mappe')).toBeVisible();
  });

  test('apre la mappa di esempio sulla Rivoluzione francese', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('button', { name: 'esempio' }).click();
    await page.getByRole('button', { name: /^La Rivoluzione francese/ }).click();
    await expect(nodes(page)).toHaveCount(37);
    await expect(page.locator('.concept-illustration').first()).toHaveAttribute('src', /^data:image\/png/);
    await page.getByRole('button', { name: 'Mappe' }).click();
    await expect(page.locator('.map-title')).toHaveText(['La Rivoluzione francese']);
  });

  test('l’informativa privacy si apre dalla schermata iniziale e riporta all’app', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('link', { name: 'Privacy' }).click();
    await expect(page.getByRole('heading', { level: 1, name: 'Privacy' })).toBeVisible();
    await expect(page.getByText('Le tue mappe restano')).toBeVisible();
    await page.getByRole('link', { name: 'Torna a Mappeora' }).first().click();
    await expect(page.getByRole('heading', { name: 'Le mie mappe' })).toBeVisible();
  });
});
