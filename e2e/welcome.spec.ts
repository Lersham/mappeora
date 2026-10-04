import { test, expect, freshInstall, spoken } from './fixtures';
import { fakeOcr, highlight, node, nodes, photographPage } from './helpers';

test.describe('Benvenuto', () => {
  test('al primo avvio spiega l’app pagina per pagina, poi non si ripresenta', async ({ page }) => {
    await freshInstall(page);
    const welcome = page.getByRole('dialog', { name: 'Come funziona' });
    await expect(welcome.getByRole('heading', { name: 'Benvenuto in Mappeora' })).toBeVisible();

    await welcome.getByRole('button', { name: 'Ascolta' }).click();
    await expect.poll(() => spoken(page)).toContainEqual(expect.stringContaining('Benvenuto in Mappeora.'));

    for (const title of ['Dal libro alla mappa', 'Scrivi o detta', 'Ascolta la mappa', 'Ripassa e personalizza']) {
      await welcome.getByRole('button', { name: 'Avanti' }).click();
      await expect(welcome.getByRole('heading', { name: title })).toBeVisible();
    }
    await expect(welcome.getByRole('button', { name: 'Salta' })).toHaveCount(0);
    await welcome.getByRole('button', { name: 'Indietro' }).click();
    await expect(welcome.getByRole('heading', { name: 'Ascolta la mappa' })).toBeVisible();
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

  test('«Provalo adesso» porta subito a fotografare una pagina, e la mappa nasce dalle parole scelte', async ({ page }) => {
    await fakeOcr(page, 'Il ciclo dell’acqua ha tre fasi: evaporazione, poi condensazione e infine precipitazione.');
    await freshInstall(page);
    const welcome = page.getByRole('dialog', { name: 'Come funziona' });
    await welcome.getByRole('button', { name: 'Avanti' }).click();
    await expect(welcome.getByRole('heading', { name: 'Dal libro alla mappa' })).toBeVisible();
    await welcome.getByRole('button', { name: 'Provalo adesso' }).click();
    await expect(welcome).toHaveCount(0);

    const dialog = await photographPage(page);
    const word = (w: string) => dialog.getByRole('button', { name: w, exact: true });
    await highlight(page, word('ciclo'), word('dell’acqua'));
    for (const w of ['evaporazione', 'condensazione', 'precipitazione']) await word(w).click();
    await expect(dialog.locator('.concept-preview .chip')).toHaveText(['Ciclo dell’acqua', 'Evaporazione', 'Condensazione', 'Precipitazione']);
    await dialog.getByRole('button', { name: 'Aggiungi 4 concetti' }).click();

    // the first words chosen name the map and are its main concept
    await expect(page.locator('.title-input')).toHaveValue('Ciclo dell’acqua');
    await expect(nodes(page)).toHaveCount(4);
    await expect(node(page, 'Nuova mappa')).toHaveCount(0);

    // back home, the welcome is not shown again and a new map opens as usual
    await page.getByRole('button', { name: 'Mappe' }).click();
    await expect(page.getByText('Ciclo dell’acqua')).toBeVisible();
    await expect(welcome).toHaveCount(0);
  });
});
