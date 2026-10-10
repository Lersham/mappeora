import { test, expect, spoken } from './fixtures';
import { addConcept, boxes, holdOn, newMap, node, nodes, onScreen, overlapping, rename, sampleMap, settled, showAll, tapLink, toolbar } from './helpers';

test.describe('Editor', () => {
  test('aggiunge, rinomina, annulla, ripete ed elimina concetti', async ({ page }) => {
    await newMap(page, 'Gli animali');
    await addConcept(page, 'Gli animali', 'Vertebrati');
    await addConcept(page, 'Gli animali', 'Invertebrati');
    await expect(nodes(page)).toHaveCount(3);

    await page.getByRole('button', { name: 'Annulla' }).click(); // the rename
    await expect(node(page, 'Nuovo concetto')).toBeVisible();
    await page.getByRole('button', { name: 'Ripeti' }).click();
    await expect(node(page, 'Invertebrati')).toBeVisible();

    // A concept just named is the one in hand: another tap on it would open «Immagine e colore».
    await expect(node(page, 'Invertebrati')).toHaveClass(/is-selected/);
    await toolbar(page, 'Elimina');
    await expect(nodes(page)).toHaveCount(2);
    await expect(page.locator('.react-flow__edge')).toHaveCount(1);
  });

  test('mette le parole di collegamento su una freccia', async ({ page }) => {
    await newMap(page, 'L’acqua');
    await addConcept(page, 'L’acqua', 'Idrogeno');
    await tapLink(page, 0);
    await page.getByRole('button', { name: 'è formato da' }).click();
    await expect(page.locator('.ladder-label')).toHaveText('è formato da');
  });

  test('nasconde e mostra i concetti sotto un ramo', async ({ page }) => {
    await sampleMap(page);
    await expect(nodes(page)).toHaveCount(9);
    await node(page, 'Precipitazione').getByRole('button', { name: 'Nascondi i concetti sotto' }).click();
    await expect(nodes(page)).toHaveCount(7);
    const toggle = node(page, 'Precipitazione').getByRole('button', { name: /Mostra 2 concetti/ });
    await expect(toggle).toHaveText('+2');
    await toggle.click();
    await expect(nodes(page)).toHaveCount(9);
  });

  test('dispone la mappa a misura di foglio A4: rami affiancati, nessuna sovrapposizione', async ({ page }) => {
    await sampleMap(page);
    const b = await boxes(page);
    expect(overlapping(b)).toEqual([]);
    const at = (label: string) => b.find((x) => x.label === label)!;
    const root = at('Il ciclo dell’acqua');
    for (const x of b.filter((x) => x !== root)) expect(x.y).toBeGreaterThan(root.y);
    // branches side by side, each one's concepts below it and indented
    expect(at('Condensazione').y).toBeCloseTo(at('Evaporazione').y, 0);
    expect(at('Condensazione').x).toBeGreaterThan(at('Evaporazione').x);
    expect(at('Calore del sole').y).toBeGreaterThan(at('Evaporazione').y);
    expect(at('Calore del sole').x).toBeGreaterThan(at('Evaporazione').x);
    expect(at('Vapore').y).toBeGreaterThan(at('Calore del sole').y);
  });

  test('trascinando un concetto si cambia l’ordine nel ramo', async ({ page, isMobile }) => {
    test.skip(isMobile, 'il trascinamento con il mouse si prova sul computer');
    await sampleMap(page);
    const vapore = await node(page, 'Vapore').boundingBox();
    const calore = await node(page, 'Calore del sole').boundingBox();
    await page.mouse.move(vapore!.x + 20, vapore!.y + 8);
    await page.mouse.down();
    // well above it: the view scrolls by itself when dragging near the edge
    await page.mouse.move(vapore!.x + 20, calore!.y - 60, { steps: 10 });
    await page.mouse.up();
    await settled(page);
    const [v, c] = [await node(page, 'Vapore').boundingBox(), await node(page, 'Calore del sole').boundingBox()];
    expect(v!.y).toBeLessThan(c!.y);
    // one undo puts it back
    await page.getByRole('button', { name: 'Annulla' }).click();
    await settled(page);
    expect((await node(page, 'Vapore').boundingBox())!.y).toBeGreaterThan((await node(page, 'Calore del sole').boundingBox())!.y);
  });

  test('«Sposta» lascia i concetti dove li metti, «Riordina» rimette la mappa sul foglio A4', async ({ page, isMobile }) => {
    test.skip(isMobile, 'il trascinamento con il mouse si prova sul computer');
    await sampleMap(page);
    const onSheet = await boxes(page);
    await toolbar(page, 'Sposta');
    await expect(page.getByRole('navigation', { name: 'Strumenti' }).getByRole('button', { name: 'Sposta' })).toHaveCount(0);

    // far to the right of its branch: on the sheet it would snap back
    const neve = (await node(page, 'Neve').boundingBox())!;
    await page.mouse.move(neve.x + 20, neve.y + 8);
    await page.mouse.down();
    await page.mouse.move(neve.x + 140, neve.y + 30, { steps: 10 });
    await page.mouse.up();
    await settled(page);
    const moved = (await node(page, 'Neve').boundingBox())!;
    expect(moved.x - neve.x).toBeGreaterThan(80);

    await toolbar(page, 'Riordina');
    await expect(page.getByRole('navigation', { name: 'Strumenti' }).getByRole('button', { name: 'Sposta' })).toBeVisible();
    await showAll(page);
    await settled(page);
    const tidy = await boxes(page);
    expect(overlapping(tidy)).toEqual([]);
    // back in its place on the sheet, below "Pioggia" in the same column
    const at = (b: typeof tidy, label: string) => b.find((x) => x.label === label)!;
    expect(at(tidy, 'Neve').x).toBeCloseTo(at(tidy, 'Pioggia').x, 0);
    expect(at(tidy, 'Neve').y).toBeGreaterThan(at(tidy, 'Pioggia').y);
    expect(tidy.length).toBe(onSheet.length);
    // and every other concept back where the sheet had it
    // (the view may frame it at another zoom: compare from the main concept, to scale)
    const [r0, r1] = [at(onSheet, 'Il ciclo dell’acqua'), at(tidy, 'Il ciclo dell’acqua')];
    const k = r1.w / r0.w;
    for (const b of onSheet) {
      expect(at(tidy, b.label).x - r1.x, b.label).toBeCloseTo((b.x - r0.x) * k, -1);
      expect(at(tidy, b.label).y - r1.y, b.label).toBeCloseTo((b.y - r0.y) * k, -1);
    }
  });

  test('«Riordina» mette in colonna la linea del tempo', async ({ page }) => {
    await newMap(page, 'Il Novecento', 'Linea del tempo');
    await toolbar(page, 'Riordina');
    await settled(page);
    const b = await boxes(page);
    const ys = b.map((x) => x.y);
    expect([...ys].sort((p, q) => p - q)).toEqual(ys); // top to bottom, in order
    expect(overlapping(b)).toEqual([]);
  });

  test('sulla linea del tempo un concetto nuovo non copre quelli che ci sono già', async ({ page }) => {
    await newMap(page, 'Il Novecento', 'Linea del tempo');
    await toolbar(page, 'Riordina');
    await settled(page);
    const before = (await boxes(page)).length;
    for (let i = 0; i < 3; i++) {
      await page.getByRole('button', { name: 'Concetto', exact: true }).click();
      await settled(page);
    }
    await showAll(page);
    await settled(page);
    const b = await boxes(page);
    expect(b.length).toBe(before + 3);
    expect(overlapping(b)).toEqual([]);
  });

  test('rinomina tenendo premuto e il titolo resta quello della mappa', async ({ page }) => {
    await newMap(page, 'Le stagioni');
    await rename(page, 'Le stagioni', 'Le quattro stagioni');
    await expect(page.locator('.title-input')).toHaveValue('Le stagioni');
  });

  test('da tastiera: Invio rinomina, Canc elimina e un solo «Annulla» lo rimette', async ({ page, isMobile }) => {
    test.skip(isMobile, 'Tastiera fisica');
    await newMap(page, 'I pianeti');
    await addConcept(page, 'I pianeti', 'Marte');
    await settled(page);
    await page.locator('.react-flow__node', { has: node(page, 'Marte') }).focus();
    await page.keyboard.press('Enter');
    const input = page.getByRole('textbox', { name: 'Testo del concetto' });
    await input.fill('Giove');
    await input.press('Enter');
    await expect(node(page, 'Giove')).toBeVisible();

    await page.locator('.react-flow__node', { has: node(page, 'Giove') }).focus();
    await page.keyboard.press('Delete');
    await expect(nodes(page)).toHaveCount(1);
    await page.getByRole('button', { name: 'Annulla' }).click();
    await expect(nodes(page)).toHaveCount(2);
    await expect(page.locator('.react-flow__edge')).toHaveCount(1);
  });
});

test.describe('Editor: scrivere più in fretta e vedere meglio', () => {
  test('un concetto nuovo è subito pronto; Tab ne fa uno sotto, Maiusc+Tab uno accanto', async ({ page, isMobile }) => {
    test.skip(isMobile, 'la tastiera fisica si prova sul computer');
    await newMap(page, 'Gli animali');
    await node(page, 'Gli animali').click();
    await page.getByRole('button', { name: 'Concetto', exact: true }).click();
    const input = page.getByRole('textbox', { name: 'Testo del concetto' });
    await expect(input).toBeFocused();
    await page.keyboard.type('Vertebrati');
    await page.keyboard.press('Tab');
    await expect(input).toBeFocused();
    await page.keyboard.type('Mammiferi');
    await page.keyboard.press('Shift+Tab');
    await expect(input).toBeFocused();
    await page.keyboard.type('Uccelli');
    await page.keyboard.press('Enter');
    await expect(input).toHaveCount(0);
    await settled(page);

    await page.getByRole('navigation', { name: 'Strumenti' }).getByRole('button', { name: 'Leggi', exact: true }).click();
    await expect.poll(() => spoken(page)).toEqual(['Gli animali', 'Vertebrati', 'Mammiferi', 'Uccelli']);
    const b = await boxes(page);
    const at = (label: string) => b.find((x) => x.label === label)!;
    // «Mammiferi» and «Uccelli» are both under «Vertebrati»
    expect(at('Uccelli').x).toBeCloseTo(at('Mammiferi').x, 0);
    expect(at('Mammiferi').x).toBeGreaterThan(at('Vertebrati').x);
  });

  test('ogni ramo ha le linee del suo colore; i pallini per collegare solo sul concetto scelto', async ({ page, isMobile }) => {
    await sampleMap(page);
    // On a phone the concepts start locked, with no dots at all: free them first.
    if (isMobile) await page.getByRole('button', { name: /^Concetti bloccati/ }).click();
    const colours = await page.locator('.react-flow__edge-path.branch-line').evaluateAll((paths) => [
      ...new Set(paths.map((p) => [...p.classList].find((c) => /^branch-\d$/.test(c)))),
    ]);
    expect(colours.sort()).toEqual(['branch-0', 'branch-1', 'branch-2']);

    await (await onScreen(page, node(page, 'Vapore'))).click();
    const handleOpacity = (label: string) =>
      page
        .locator('.react-flow__node', { has: page.locator('.concept-label', { hasText: label }) })
        .locator('.react-flow__handle:not(.handle-hidden)')
        .first()
        .evaluate((h) => getComputedStyle(h).opacity);
    await expect.poll(() => handleOpacity('Vapore')).toBe('1');
    await expect.poll(() => handleOpacity('Neve')).toBe('0');
  });

  test('sul telefono, toccando un concetto di una mappa vista da lontano, il suo ramo si avvicina', async ({ page, isMobile }) => {
    test.skip(!isMobile, 'sul computer la mappa d’esempio si legge già');
    await page.goto('/');
    await page.getByRole('button', { name: 'Esempi', exact: true }).click();
    await page.getByRole('button', { name: /^La Rivoluzione francese/ }).click();
    await expect(nodes(page)).toHaveCount(37);
    await showAll(page);
    const onScreenPx = (label: string) =>
      node(page, label)
        .locator('.concept-label')
        .evaluate((el) => (parseFloat(getComputedStyle(el).fontSize) * el.getBoundingClientRect().height) / (el as HTMLElement).offsetHeight);
    expect(await onScreenPx('Le cause')).toBeLessThan(12);
    await node(page, 'Le cause').click();
    await expect.poll(() => onScreenPx('Le cause'), { timeout: 5000 }).toBeGreaterThanOrEqual(12);
    await expect(node(page, 'Le cause')).toBeInViewport();
  });

  test('sul telefono una mappa grande si apre tutta, anche se le immagini arrivano dopo', async ({ page, isMobile }) => {
    test.skip(!isMobile, 'sullo schermo largo si apre come una pagina');
    await page.goto('/');
    await page.getByRole('button', { name: 'Esempi', exact: true }).click();
    await page.getByRole('button', { name: /^La Rivoluzione francese/ }).click();
    await expect(nodes(page)).toHaveCount(37);
    await settled(page);
    const canvas = (await page.locator('.react-flow').boundingBox())!;
    for (const b of await boxes(page)) {
      expect(b.x, b.label).toBeGreaterThanOrEqual(canvas.x - 1);
      expect(b.x + b.w, b.label).toBeLessThanOrEqual(canvas.x + canvas.width + 1);
    }
  });

  test('sullo schermo largo una mappa lunga si apre come una pagina: larga quanto lo schermo, leggibile, e la rotella la scorre', async ({
    page,
    isMobile,
  }) => {
    test.skip(isMobile, 'sul telefono si vede tutta, e un tocco avvicina un ramo');
    await page.goto('/');
    await page.getByRole('button', { name: 'Esempi', exact: true }).click();
    await page.getByRole('button', { name: /^La Rivoluzione francese/ }).click();
    await expect(nodes(page)).toHaveCount(37);
    await settled(page);
    const onScreenPx = (label: string) =>
      node(page, label)
        .locator('.concept-label')
        .evaluate((el) => (parseFloat(getComputedStyle(el).fontSize) * el.getBoundingClientRect().height) / (el as HTMLElement).offsetHeight);
    // The main concept on top, names that can be read, no empty bands at the sides.
    await expect(node(page, 'La Rivoluzione francese')).toBeInViewport();
    expect(await onScreenPx('Le cause')).toBeGreaterThanOrEqual(12);
    const canvas = (await page.locator('.react-flow').boundingBox())!;
    const all = await boxes(page);
    const width = Math.max(...all.map((b) => b.x + b.w)) - Math.min(...all.map((b) => b.x));
    expect(width).toBeGreaterThan(canvas.width * 0.8);

    // The wheel scrolls down the sheet, like a page: it does not zoom.
    const zoom = () => page.locator('.react-flow__viewport').evaluate((el) => new DOMMatrix(getComputedStyle(el).transform).a);
    const before = await zoom();
    const top = (await node(page, 'Le cause').boundingBox())!.y;
    await page.mouse.move(canvas.x + canvas.width / 2, canvas.y + canvas.height / 2);
    await page.mouse.wheel(0, 300);
    await expect.poll(async () => (await node(page, 'Le cause').boundingBox())!.y).toBeLessThan(top - 100);
    expect(await zoom()).toBeCloseTo(before, 3);

    // The button still shows all of it, from afar.
    await showAll(page);
    expect(await onScreenPx('Le cause')).toBeLessThan(12);
  });

  test('sul telefono con il testo grande una mappa troppo grande per starci tutta si apre dalla cima, con il concetto principale', async ({
    page,
    isMobile,
  }) => {
    test.skip(!isMobile, 'sullo schermo largo si apre come una pagina');
    await page.addInitScript(() => {
      if (!localStorage.getItem('mappeora-settings')) {
        const state = { font: 'opendyslexic', textScale: 1.8, uppercase: true, wideSpacing: true, theme: 'crema' };
        localStorage.setItem('mappeora-settings', JSON.stringify({ state, version: 1 }));
      }
    });
    await page.goto('/');
    await page.getByRole('button', { name: 'Esempi', exact: true }).click();
    await page.getByRole('button', { name: /^La Rivoluzione francese/ }).click();
    await expect(nodes(page)).toHaveCount(37);
    await settled(page);
    // Not centred and cut at both ends: the main concept, whole, under the bar.
    const main = node(page, 'La Rivoluzione francese');
    const insideCanvas = async () => {
      const [b, c] = [(await main.boundingBox())!, (await page.locator('.react-flow').boundingBox())!];
      return b.y >= c.y && b.y + b.height <= c.y + c.height;
    };
    expect(await insideCanvas()).toBe(true);
    // «Mostra tutta la mappa» too.
    await page.locator('.react-flow__controls-fitview').click();
    await expect.poll(insideCanvas).toBe(true);
  });

  test('sullo schermo largo la barra in alto è una riga sottile: ogni parola accanto alla sua icona', async ({ page, isMobile }) => {
    test.skip(isMobile, 'sul telefono il titolo ha una riga sua');
    await newMap(page, 'I vulcani');
    expect((await page.locator('.topbar').boundingBox())!.height).toBeLessThanOrEqual(52);
    const back = page.locator('.topbar').getByRole('button', { name: 'Mappe' });
    const [icon, word] = [(await back.locator('.big-button-icon').boundingBox())!, (await back.locator('.big-button-label').boundingBox())!];
    expect(icon.x + icon.width).toBeLessThanOrEqual(word.x);
    expect((await back.boundingBox())!.height).toBeGreaterThanOrEqual(44);
  });
});

test.describe('Sul telefono i concetti non si spostano per sbaglio', () => {
  test('bloccati di partenza: il dito su un concetto muove la mappa; 🔓 li libera, e la scelta resta', async ({ page, isMobile }) => {
    test.skip(!isMobile, 'il blocco di partenza vale per i touch screen');
    await sampleMap(page);
    const lock = page.getByRole('button', { name: /^Concetti bloccati/ });
    await expect(lock).toBeVisible();
    await expect(page.locator('.react-flow__node.draggable')).toHaveCount(0);

    // One finger from «Calore del sole» downwards: the whole map follows, nothing changes order.
    const before = await boxes(page);
    const at = (b: typeof before, label: string) => b.find((x) => x.label === label)!;
    const start = at(before, 'Calore del sole');
    const [x, y] = [start.x + start.w / 2, start.y + start.h / 2];
    const cdp = await page.context().newCDPSession(page);
    const touch = (type: 'touchStart' | 'touchMove' | 'touchEnd', points: { x: number; y: number }[]) =>
      cdp.send('Input.dispatchTouchEvent', { type, touchPoints: points });
    await touch('touchStart', [{ x, y }]);
    for (let i = 1; i <= 8; i++) await touch('touchMove', [{ x: x + i * 5, y: y + i * 12 }]);
    await touch('touchEnd', []);
    await settled(page);
    const after = await boxes(page);
    expect(at(after, 'Calore del sole').y - at(before, 'Calore del sole').y).toBeGreaterThan(50);
    for (const b of before) {
      expect(at(after, b.label).x - at(after, 'Calore del sole').x, b.label).toBeCloseTo(b.x - start.x, 0);
      expect(at(after, b.label).y - at(after, 'Calore del sole').y, b.label).toBeCloseTo(b.y - start.y, 0);
    }

    await lock.click();
    await expect(page.getByRole('alert')).toContainText('Ora puoi spostare i concetti');
    await expect(page.getByRole('button', { name: /^Concetti liberi/ })).toBeVisible();
    await expect(page.locator('.react-flow__node.draggable')).toHaveCount(9);
    // Remembered on the device, for every map.
    await page.reload();
    await page.locator('.map-open').first().click();
    await expect(page.getByRole('button', { name: /^Concetti liberi/ })).toBeVisible();
  });
});

test.describe('Editor: un tocco per immagine e colore, tenere premuto per rinominare', () => {
  test('il primo tocco seleziona; un secondo tocco apre «Immagine e colore» subito', async ({ page }) => {
    await newMap(page, 'Gli animali');
    await settled(page);
    const target = await onScreen(page, node(page, 'Gli animali'));
    const dialog = page.getByRole('dialog', { name: 'Immagine e colore' });

    await target.click({ delay: 60 }); // selects
    await page.waitForTimeout(600);
    await expect(dialog).toHaveCount(0);

    await target.click({ delay: 60 }); // the one in hand: restyle
    await expect(dialog).toBeVisible();
    await dialog.getByRole('button', { name: 'Colore giallo' }).click();
    await dialog.getByRole('button', { name: 'Fatto' }).click();
    await expect(dialog).toHaveCount(0);
  });

  test('tenendo premuto un concetto (anche non scelto) si rinomina, senza aprire il dialogo', async ({ page }) => {
    await newMap(page, 'Gli animali');
    await settled(page);
    await rename(page, 'Gli animali', 'I mammiferi');
    await page.waitForTimeout(600);
    await expect(page.getByRole('dialog', { name: 'Immagine e colore' })).toHaveCount(0);
    await expect(page.getByRole('textbox', { name: 'Testo del concetto' })).toHaveCount(0);
    // Chosen by the hold itself: «Elimina» is now enabled.
    await expect(node(page, 'I mammiferi')).toHaveClass(/is-selected/);
  });

  test('un tocco breve non rinomina e un dito che si muove non rinomina', async ({ page }) => {
    await newMap(page, 'Gli animali');
    await settled(page);
    const target = await onScreen(page, node(page, 'Gli animali'));
    await target.click({ delay: 100 });
    await page.waitForTimeout(700);
    await expect(page.getByRole('textbox', { name: 'Testo del concetto' })).toHaveCount(0);
    // Held, but dragged away before letting go.
    const box = (await target.boundingBox())!;
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await page.mouse.down();
    await page.mouse.move(box.x + box.width / 2 + 30, box.y + box.height / 2 + 30, { steps: 4 });
    await page.waitForTimeout(700);
    await page.mouse.up();
    await expect(page.getByRole('textbox', { name: 'Testo del concetto' })).toHaveCount(0);
  });

  test('al tocco vero (telefono): tocco, secondo tocco e pressione prolungata si distinguono', async ({ page, isMobile }) => {
    test.skip(!isMobile, 'il tocco vero si prova sul telefono');
    await newMap(page, 'Gli animali');
    await settled(page);
    const dialog = page.getByRole('dialog', { name: 'Immagine e colore' });
    const field = page.getByRole('textbox', { name: 'Testo del concetto' });
    const target = await onScreen(page, node(page, 'Gli animali'));

    await target.tap(); // selects
    await page.waitForTimeout(600);
    await expect(dialog).toHaveCount(0);

    await target.tap(); // again: restyle
    await expect(dialog).toBeVisible();
    await dialog.getByRole('button', { name: 'Fatto' }).click();
    await expect(dialog).toHaveCount(0);

    // Held: the name opens, with the keyboard's field focused and kept open after the lift.
    await holdOn(page, target);
    await expect(field).toBeFocused();
    await page.waitForTimeout(600);
    await expect(field).toBeFocused();
    await expect(dialog).toHaveCount(0);
    await field.fill('I mammiferi');
    await field.press('Enter');
    await expect(node(page, 'I mammiferi')).toBeVisible();
  });
});
