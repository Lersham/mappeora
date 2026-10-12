import { test, expect } from './fixtures';
import { fakeOcr, fakeOcrWorker, highlight, newMap, node, nodes, photographPage, toolbar } from './helpers';

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
  // even if the browser thinks it is online (e.g. a school network blocking the CDN)
  await expect(dialog.getByRole('alert')).toContainText('La prima volta serve internet');
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

test('col dito l’evidenziatore va anche a capo; dal bordo il testo scorre', async ({ page, isMobile }) => {
  test.skip(!isMobile, 'il dito');
  const long = Array.from({ length: 12 }, (_, i) => `Frase ${i} sulle radici profonde degli alberi del bosco.`).join(' ');
  await fakeOcr(page, 'Le piante hanno radici robuste e foglie verdi. ' + long);
  await newMap(page, 'Le piante');
  await toolbar(page, 'Dal libro');
  const dialog = await photographPage(page);
  const word = (w: string) => dialog.getByRole('button', { name: w, exact: true }).first();
  const [a, b] = [(await word('hanno').boundingBox())!, (await word('robuste').boundingBox())!];
  expect(b.y).toBeGreaterThan(a.y); // the stroke goes down to the next line
  // A real phone decides at the first touch whether to scroll: up and down
  // scrolls even from a word, a stroke that starts sideways highlights.
  expect(await word('hanno').evaluate((el) => getComputedStyle(el).touchAction)).toBe('pan-y');
  await highlight(page, word('hanno'), word('robuste'));
  await expect(dialog.locator('.concept-preview .chip')).toHaveText(['Hanno radici robuste']);

  // a finger on the margin of the text scrolls it, and highlights nothing
  const text = dialog.locator('.ocr-pick');
  const box = (await text.boundingBox())!;
  const cdp = await page.context().newCDPSession(page);
  const touch = (type: 'touchStart' | 'touchMove' | 'touchEnd', y: number) =>
    cdp.send('Input.dispatchTouchEvent', { type, touchPoints: type === 'touchEnd' ? [] : [{ x: box.x + box.width - 6, y }] });
  const mid = box.y + box.height / 2;
  await touch('touchStart', mid);
  for (let i = 1; i <= 8; i++) await touch('touchMove', mid - i * 15);
  await touch('touchEnd', mid - 120);
  await expect.poll(() => text.evaluate((e) => e.scrollTop)).toBeGreaterThan(0);
  await expect(dialog.locator('.concept-preview .chip')).toHaveText(['Hanno radici robuste']);

  // a finger that goes down from a word scrolls back up: the words cover almost all the text
  const from = await text.evaluate((e) => {
    const r = e.getBoundingClientRect();
    const word = document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 3)?.closest<HTMLElement>('[data-word]')!.getBoundingClientRect();
    return { x: word!.x + word!.width / 2, y: word!.y + word!.height / 2 };
  });
  const scrolled = await text.evaluate((e) => e.scrollTop);
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [from] });
  for (let i = 1; i <= 8; i++) await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: from.x, y: from.y + i * 15 }] });
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  await expect.poll(() => text.evaluate((e) => e.scrollTop)).toBeLessThan(scrolled);
  await expect(dialog.locator('.concept-preview .chip')).toHaveText(['Hanno radici robuste']);
});

test('i concetti scelti si uniscono o si dividono a piacere, e la pagina resta per la volta dopo', async ({ page }) => {
  await fakeOcr(page, 'Le radici, il fusto e le foglie.');
  await newMap(page, 'Le piante');
  await toolbar(page, 'Dal libro');
  let dialog = await photographPage(page);
  const word = (w: string) => dialog.getByRole('button', { name: w, exact: true });
  const chosen = dialog.locator('.concept-preview .chip');

  // across a comma the stroke makes two concepts: the chain joins them
  await highlight(page, word('radici'), word('fusto'));
  await expect(chosen).toHaveText(['Radici', 'Il fusto']);
  await dialog.getByRole('button', { name: 'Unisci «Radici» e «Il fusto»' }).click();
  await expect(chosen).toHaveText(['Radici, il fusto']);
  // the scissors split one into its words
  await dialog.getByRole('button', { name: 'Dividi «Radici, il fusto» in parole' }).click();
  await expect(chosen).toHaveText(['Radici', 'Il', 'Fusto']);
  await dialog.getByRole('button', { name: 'Unisci «Il» e «Fusto»' }).click();
  await expect(chosen).toHaveText(['Radici', 'Il fusto']);
  await dialog.getByRole('button', { name: 'Aggiungi 2 concetti' }).click();
  await expect(nodes(page)).toHaveCount(3);

  // back later: the same page, no new photo, with the words already taken marked
  await toolbar(page, 'Dal libro');
  dialog = page.getByRole('dialog', { name: 'Dal libro' });
  await expect(dialog.locator('.ocr-pick')).toBeVisible();
  await expect(dialog.getByText('È la pagina dell’ultima volta')).toBeVisible();
  await expect(word('radici')).toHaveClass(/is-used/);
  await expect(word('foglie')).not.toHaveClass(/is-used/);
  await word('foglie').click();
  await dialog.getByRole('button', { name: 'Aggiungi 1 concetto' }).click();
  await expect(node(page, 'Foglie')).toBeVisible();
  // «Altra foto» is still there for a new page
  await toolbar(page, 'Dal libro');
  await expect(page.getByRole('dialog', { name: 'Dal libro' }).getByRole('button', { name: 'Altra foto' })).toBeVisible();
});

test('se il modello italiano non si scarica, lo dice invece di restare fermo; «Annulla» interrompe', async ({ page, consoleErrors }) => {
  // the engine starts, but the Italian model fails: before the fix it waited forever
  await fakeOcrWorker(page, `self.onmessage = ({ data }) => postMessage({
    workerId: data.workerId, jobId: data.jobId, action: data.action,
    status: data.action === 'loadLanguage' ? 'reject' : 'resolve', data: data.action === 'loadLanguage' ? 'NetworkError' : {},
  });`);
  await newMap(page, 'La cellula');
  await toolbar(page, 'Dal libro');
  const dialog = page.getByRole('dialog', { name: 'Dal libro' });
  await choosePage(page);
  await expect(dialog.getByRole('alert')).toContainText('La prima volta serve internet', { timeout: 20_000 });
  consoleErrors.splice(0, consoleErrors.length, ...consoleErrors.filter((e) => !/tesseract|NetworkError/i.test(e)));

  // a download that never answers: the child can stop waiting
  await fakeOcrWorker(page, 'self.onmessage = () => {};');
  await dialog.getByRole('button', { name: 'Riprova' }).click();
  await choosePage(page);
  await expect(dialog.getByText('Sto leggendo la pagina…')).toBeVisible();
  await dialog.getByRole('button', { name: 'Annulla' }).click();
  await expect(dialog.getByRole('button', { name: 'Scegli una foto' })).toBeVisible();
});

test('«Correggi» senza cambiare nulla tiene le parole scelte; «Altra foto» permette di tornare al testo', async ({ page }) => {
  await fakeOcr(page, 'Le piante producono ossigeno.');
  await newMap(page, 'Le piante');
  await toolbar(page, 'Dal libro');
  const dialog = await photographPage(page);
  const chosen = dialog.locator('.concept-preview .chip');
  await dialog.getByRole('button', { name: 'ossigeno', exact: true }).click();
  await expect(chosen).toHaveText(['Ossigeno']);

  await dialog.getByRole('button', { name: 'Correggi' }).click();
  // while editing, nothing can be added from words that may have moved
  await expect(dialog.getByRole('button', { name: /^Aggiungi/ })).toBeDisabled();
  await dialog.getByRole('button', { name: 'Fatto' }).click();
  await expect(chosen).toHaveText(['Ossigeno']);

  // a real correction moves the words: the choice starts over
  await dialog.getByRole('button', { name: 'Correggi' }).click();
  await dialog.getByRole('textbox', { name: 'Testo letto dalla foto' }).fill('Le piante producono molto ossigeno.');
  await dialog.getByRole('button', { name: 'Fatto' }).click();
  await expect(chosen).toHaveCount(0);
  await dialog.getByRole('button', { name: 'molto', exact: true }).click();

  await dialog.getByRole('button', { name: 'Altra foto' }).click();
  await dialog.getByRole('button', { name: 'Torna al testo' }).click();
  await expect(chosen).toHaveText(['Molto']);
});

async function choosePage(page: import('@playwright/test').Page) {
  const chooser = page.waitForEvent('filechooser');
  await page.getByRole('dialog', { name: 'Dal libro' }).getByRole('button', { name: 'Scegli una foto' }).click();
  await (await chooser).setFiles({
    name: 'pagina.png',
    mimeType: 'image/png',
    buffer: Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==', 'base64'),
  });
}

test('dopo aver letto la foto, Esc chiude ancora «Dal libro»', async ({ page }) => {
  await fakeOcr(page, 'Le piante producono ossigeno.');
  await newMap(page, 'Le piante');
  await toolbar(page, 'Dal libro');
  const dialog = await photographPage(page);
  await page.keyboard.press('Escape');
  await expect(dialog).toHaveCount(0);
});

test('su un telefono lento il clic che arriva dopo un tocco non riaccende la parola appena spenta', async ({ page }) => {
  await fakeOcr(page, 'Le piante producono ossigeno.');
  await newMap(page, 'Le piante');
  await toolbar(page, 'Dal libro');
  const dialog = await photographPage(page);
  const word = dialog.getByRole('button', { name: 'ossigeno', exact: true });
  await word.click();
  await expect(word).toHaveAttribute('aria-pressed', 'true');
  // A tap to rub it out: pointerdown and pointerup now, the click 300 ms later.
  await word.evaluate(async (el) => {
    el.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, button: 0, pointerType: 'touch' }));
    window.dispatchEvent(new PointerEvent('pointerup', { bubbles: true, pointerType: 'touch' }));
    await new Promise((r) => setTimeout(r, 300));
    el.dispatchEvent(new MouseEvent('click', { bubbles: true, detail: 1 }));
  });
  await expect(word).toHaveAttribute('aria-pressed', 'false');
  // The keyboard still toggles.
  await word.focus();
  await page.keyboard.press('Enter');
  await expect(word).toHaveAttribute('aria-pressed', 'true');
});
