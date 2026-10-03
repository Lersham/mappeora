import { test, expect } from './fixtures';
import { newMap, toolbar } from './helpers';

/*
 * The text recognition itself (Tesseract on the web, ML Kit / Vision in the
 * apps) needs its engine and the Italian model from the network: it is
 * covered by the unit tests of the text processing (src/lib/ocrText.test.ts)
 * and by hand on real devices. Here: the dialog and what happens offline.
 */
test('«Dal libro» offre fotocamera e galleria, e spiega se manca internet', async ({ page, consoleErrors }) => {
  await newMap(page, 'La cellula');
  await toolbar(page, 'Dal libro');
  const dialog = page.getByRole('dialog', { name: 'Dal libro' });
  await expect(dialog.getByRole('button', { name: 'Scatta una foto' })).toBeVisible();
  const chooser = page.waitForEvent('filechooser');
  await dialog.getByRole('button', { name: 'Scegli una foto' }).click();
  await (await chooser).setFiles({
    name: 'pagina.png',
    mimeType: 'image/png',
    buffer: Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==', 'base64'),
  });
  // the OCR engine can't be downloaded in the test: a friendly error, a way back
  await expect(dialog.getByRole('button', { name: 'Riprova' })).toBeVisible({ timeout: 20_000 });
  // Expected here: Tesseract's worker reports the failed download itself.
  const unrelated = consoleErrors.filter((e) => !/tesseract/i.test(e));
  consoleErrors.splice(0, consoleErrors.length, ...unrelated);
});
