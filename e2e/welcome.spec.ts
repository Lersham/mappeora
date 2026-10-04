import { test, expect, freshInstall, spoken } from './fixtures';

test.describe('Benvenuto', () => {
  test('al primo avvio spiega l’app pagina per pagina, poi non si ripresenta', async ({ page }) => {
    await freshInstall(page);
    const welcome = page.getByRole('dialog', { name: 'Come funziona' });
    await expect(welcome.getByRole('heading', { name: 'Benvenuto in Mappeora' })).toBeVisible();

    await welcome.getByRole('button', { name: 'Ascolta' }).click();
    await expect.poll(() => spoken(page)).toContainEqual(expect.stringContaining('Benvenuto in Mappeora.'));

    for (const title of ['Scrivi o detta', 'Ascolta la mappa', 'Dal libro alla mappa', 'Ripassa e personalizza']) {
      await welcome.getByRole('button', { name: 'Avanti' }).click();
      await expect(welcome.getByRole('heading', { name: title })).toBeVisible();
    }
    await expect(welcome.getByRole('button', { name: 'Salta' })).toHaveCount(0);
    await welcome.getByRole('button', { name: 'Indietro' }).click();
    await expect(welcome.getByRole('heading', { name: 'Dal libro alla mappa' })).toBeVisible();
    await welcome.getByRole('button', { name: 'Avanti' }).click();
    await welcome.getByRole('button', { name: 'Inizia' }).click();
    await expect(welcome).toHaveCount(0);

    await page.reload();
    await expect(page.getByRole('heading', { name: 'Le mie mappe' })).toBeVisible();
    await expect(welcome).toHaveCount(0);
  });

  test('si può saltare e riaprire da «Come funziona»', async ({ page }) => {
    await freshInstall(page);
    const welcome = page.getByRole('dialog', { name: 'Come funziona' });
    await welcome.getByRole('button', { name: 'Salta' }).click();
    await expect(welcome).toHaveCount(0);

    await page.getByRole('button', { name: 'Come funziona' }).click();
    await expect(welcome.getByRole('heading', { name: 'Benvenuto in Mappeora' })).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(welcome).toHaveCount(0);
  });

  test('dall’ultima pagina apre gli esempi', async ({ page }) => {
    await freshInstall(page);
    const welcome = page.getByRole('dialog', { name: 'Come funziona' });
    for (let i = 0; i < 4; i++) await welcome.getByRole('button', { name: 'Avanti' }).click();
    await welcome.getByRole('button', { name: 'Guarda un esempio' }).click();
    await expect(page.getByRole('dialog', { name: 'Mappe di esempio' })).toBeVisible();
  });
});
