import { test, expect } from './fixtures';
import { fakeOcr, highlight, newMap, node, nodes, photographPage, toolbar } from './helpers';

/*
 * The text recognition itself (Tesseract on the web, ML Kit / Vision in the
 * apps) needs its engine and the Italian model from the network: it is
 * covered by the unit tests of the text processing (src/lib/ocrText.test.ts)
 * and by hand on real devices. Here: the dialog, what happens offline, and
 * choosing the words from a page "read" by a stand-in engine.
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

test('dal testo della foto si scelgono le parole: col dito come un evidenziatore, o una alla volta', async ({ page }) => {
  await fakeOcr(page, 'La fotosintesi avviene nelle foglie.\nLe piante producono ossigeno grazie alla clorofilla.');
  await newMap(page, 'Le piante');
  await toolbar(page, 'Dal libro');
  const dialog = await photographPage(page);
  const word = (w: string) => dialog.getByRole('button', { name: w, exact: true });
  const chosen = dialog.locator('.concept-preview .chip');

  // one stroke across two words: one concept
  await highlight(page, word('producono'), word('ossigeno'));
  await expect(chosen).toHaveText(['Producono ossigeno']);
  // a stroke that starts on a highlighted word rubs it out
  await highlight(page, word('producono'), word('producono'));
  await expect(chosen).toHaveText(['Ossigeno']);
  // a tap marks a single word, a second tap unmarks it
  await word('fotosintesi').click();
  await word('foglie').click();
  await word('foglie').click();
  await expect(word('foglie')).toHaveAttribute('aria-pressed', 'false');
  // the keyboard works too
  await word('clorofilla').focus();
  await page.keyboard.press('Enter');
  await expect(chosen).toHaveText(['Fotosintesi', 'Ossigeno', 'Clorofilla']);

  await dialog.getByRole('button', { name: 'Aggiungi 3 concetti' }).click();
  await expect(dialog).toHaveCount(0);
  // the map already had its main concept: the words hang from it
  await expect(page.locator('.title-input')).toHaveValue('Le piante');
  await expect(nodes(page)).toHaveCount(4);
  for (const label of ['Fotosintesi', 'Ossigeno', 'Clorofilla']) await expect(node(page, label)).toBeVisible();
});
