import { test, expect, micError, spoken } from './fixtures';
import { newMap, node, toolbar } from './helpers';

/**
 * Every error message has a 🔊 «Ascolta» beside it (issue #19): it reads the
 * message only when asked, and sits outside the alert so that a screen reader
 * does not announce it together with the message.
 */
test.describe('Messaggi da ascoltare', () => {
  test('il microfono di un campo: l’errore si ascolta solo se lo chiedi', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('button', { name: 'Nuova mappa' }).click();
    const dialog = page.getByRole('dialog', { name: 'Nuova mappa' });
    await micError(page, 'not-allowed');
    await dialog.getByRole('button', { name: 'Detta', exact: true }).click();

    const alert = dialog.getByRole('alert');
    await expect(alert).toContainText('permetti a MappAmi di usare il microfono');
    await expect(alert.getByRole('button')).toHaveCount(0);
    expect(await spoken(page), 'niente si legge da solo').toEqual([]);

    // On its own line, under the field: the field keeps its width.
    const [field, message] = [await dialog.getByPlaceholder("es. Il ciclo dell'acqua").boundingBox(), await alert.boundingBox()];
    expect(message!.y).toBeGreaterThan(field!.y + field!.height - 1);
    expect(field!.width).toBeGreaterThan(120);

    await dialog.getByRole('button', { name: 'Ascolta', exact: true }).click();
    await expect.poll(() => spoken(page)).toContainEqual(expect.stringContaining('permetti a MappAmi di usare il microfono'));
  });

  test('«Detta» dell’editor: il messaggio d’errore si ascolta', async ({ page }) => {
    await newMap(page, 'Le stagioni');
    await micError(page, 'network');
    await toolbar(page, 'Detta');
    const overlay = page.getByRole('dialog', { name: 'Dettatura' });
    await expect(overlay.getByRole('alert')).toContainText('Per dettare serve internet');
    await expect(overlay.getByRole('alert').getByRole('button')).toHaveCount(0);
    expect(await spoken(page)).toEqual([]);

    await overlay.getByRole('button', { name: 'Ascolta', exact: true }).click();
    await expect.poll(() => spoken(page)).toContainEqual(expect.stringContaining('Per dettare serve internet'));
    // «Ok» is still the button that has the focus when the message opens, and closes it
    await overlay.getByRole('button', { name: 'Ok' }).click();
    await expect(overlay).toHaveCount(0);
  });

  test('«Esempi» senza internet: l’errore si ascolta', async ({ page }) => {
    await page.route('**/esempi/**', (route) => route.abort());
    await page.goto('/');
    await page.getByRole('button', { name: 'Esempi', exact: true }).click();
    const dialog = page.getByRole('dialog', { name: 'Mappe di esempio' });
    await dialog.getByRole('button', { name: /^La Rivoluzione francese/ }).click();

    const alert = dialog.getByRole('alert');
    await expect(alert).toHaveText('Non riesco ad aprire l’esempio. Controlla la connessione a internet.');
    expect(await spoken(page)).toEqual([]);
    await dialog.getByRole('button', { name: 'Ascolta', exact: true }).click();
    await expect.poll(() => spoken(page)).toEqual(['Non riesco ad aprire l’esempio. Controlla la connessione a internet.']);
  });

  test('«Salva e manda» che non riesce: l’errore si ascolta', async ({ page }) => {
    // The file cannot be made: the download link needs this.
    await page.addInitScript(() => {
      URL.createObjectURL = () => {
        throw new Error('no space');
      };
    });
    await newMap(page, 'Il vulcano');
    await toolbar(page, 'Salva e manda');
    const dialog = page.getByRole('dialog', { name: 'Salva e manda' });
    await dialog.getByRole('button', { name: /^File modificabile/ }).click();
    await dialog.locator('.dialog-actions').getByRole('button', { name: /^(Salva|Condividi)$/ }).click();

    await expect(dialog.getByRole('alert')).toHaveText('Non sono riuscito a preparare il file. Riprova.');
    await dialog.getByRole('button', { name: 'Ascolta', exact: true }).click();
    await expect.poll(() => spoken(page)).toEqual(['Non sono riuscito a preparare il file. Riprova.']);
  });

  test('«Nome, colore e immagine»: l’errore degli appunti si ascolta, e «Ascolta come fare» resta distinto', async ({ page, isMobile }) => {
    test.skip(isMobile, 'gli appunti del browser si provano sul computer');
    await newMap(page, 'Il Colosseo');
    await node(page, 'Il Colosseo').click();
    await toolbar(page, 'Immagine');
    const dialog = page.getByRole('dialog', { name: 'Nome, colore e immagine' });
    await dialog.getByRole('button', { name: /Foto e Google/ }).click();
    await page.evaluate(() => navigator.clipboard.writeText('ciao'));
    await dialog.getByRole('button', { name: 'Incolla immagine' }).click();

    const alert = dialog.getByRole('alert');
    await expect(alert).toContainText('Copia immagine');
    await expect(alert.getByRole('button')).toHaveCount(0);
    expect(await spoken(page)).toEqual([]);
    await dialog.getByRole('button', { name: 'Ascolta', exact: true }).click();
    await expect.poll(() => spoken(page)).toEqual([(await alert.textContent())!]);
  });

  test('la mappa cambiata in un’altra finestra: l’avviso si ascolta e i suoi pulsanti restano nell’avviso', async ({ page, context }) => {
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
    await expect(notice.getByRole('button', { name: 'Salva come copia' })).toBeVisible();
    await expect(notice.getByRole('button', { name: 'Ascolta' })).toHaveCount(0);

    await page.getByRole('button', { name: 'Ascolta', exact: true }).click();
    await expect.poll(() => spoken(page)).toContainEqual(expect.stringMatching(/^Questa mappa è stata cambiata in un’altra finestra\./));
  });
});
