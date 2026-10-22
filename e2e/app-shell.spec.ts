import { mkdir, open } from 'node:fs/promises';
import { dirname } from 'node:path';
import { test, expect } from './fixtures';
import { newMap, openCopy } from './helpers';

/** Opens «Aspetto» from the list. */
async function settings(page: import('@playwright/test').Page) {
  await page.goto('/');
  await page.getByRole('button', { name: 'Aspetto' }).click();
  return page.getByRole('dialog', { name: 'Aspetto e voce' });
}

test.describe('Aspetto: Ripristina si può annullare', () => {
  test('«Annulla» rimette carattere, sfondo, maiuscolo e voce di prima', async ({ page }) => {
    const panel = await settings(page);
    const voiceSelect = panel.locator('select');
    const html = page.locator('html');
    await panel.getByRole('button', { name: 'Atkinson' }).click();
    await panel.getByRole('button', { name: 'Scuro' }).click();
    await panel.getByLabel('TUTTO IN STAMPATELLO MAIUSCOLO').check();
    await voiceSelect.selectOption({ label: 'Italiano (test)' });
    const voice = await voiceSelect.inputValue();
    expect(voice).not.toBe('');

    await panel.getByRole('button', { name: 'Ripristina' }).click();
    const note = panel.getByRole('status').filter({ hasText: 'Ho rimesso le impostazioni di partenza.' });
    await expect(note).toBeVisible();
    await expect(html).toHaveAttribute('data-font', 'lexend');
    await expect(html).toHaveAttribute('data-theme', 'bianco');
    await expect(html).toHaveAttribute('data-spacing', 'normal');
    await expect(html).toHaveAttribute('data-uppercase', 'false');
    await expect(voiceSelect).toHaveValue('');

    await note.getByRole('button', { name: 'Annulla' }).click();
    await expect(html).toHaveAttribute('data-font', 'atkinson');
    await expect(html).toHaveAttribute('data-theme', 'scuro');
    await expect(html).toHaveAttribute('data-uppercase', 'true');
    await expect(voiceSelect).toHaveValue(voice);
    await expect(panel.getByText('Ho rimesso le impostazioni di partenza.')).toHaveCount(0);
    // The focus does not fall on the page behind: it is back on «Ripristina».
    await expect(panel.getByRole('button', { name: 'Ripristina' })).toBeFocused();

    // What «Annulla» restored is also what stays saved.
    await panel.getByRole('button', { name: 'Chiudi' }).click();
    await page.reload();
    await expect(html).toHaveAttribute('data-font', 'atkinson');
    await expect(html).toHaveAttribute('data-theme', 'scuro');
  });

  test('premendo «Ripristina» due volte, «Annulla» rimette comunque quello di prima', async ({ page }) => {
    const panel = await settings(page);
    const voiceSelect = panel.locator('select');
    const html = page.locator('html');
    await panel.getByRole('button', { name: 'Atkinson' }).click();
    await panel.getByRole('button', { name: 'Scuro' }).click();
    await panel.getByLabel('TUTTO IN STAMPATELLO MAIUSCOLO').check();
    await voiceSelect.selectOption({ label: 'Italiano (test)' });
    const voice = await voiceSelect.inputValue();
    expect(voice).not.toBe('');

    // A double tap, then a press that changes no setting, then a third tap.
    await panel.getByRole('button', { name: 'Ripristina' }).click();
    await panel.getByRole('button', { name: 'Ripristina' }).click();
    await expect(html).toHaveAttribute('data-font', 'lexend');
    await panel.getByRole('button', { name: 'Prova la voce' }).click();
    await panel.getByRole('button', { name: 'Ripristina' }).click();
    const note = panel.getByRole('status').filter({ hasText: 'Ho rimesso le impostazioni di partenza.' });
    await expect(note).toBeVisible();

    await note.getByRole('button', { name: 'Annulla' }).click();
    await expect(html).toHaveAttribute('data-font', 'atkinson');
    await expect(html).toHaveAttribute('data-theme', 'scuro');
    await expect(html).toHaveAttribute('data-uppercase', 'true');
    await expect(voiceSelect).toHaveValue(voice);
  });

  test('già alle impostazioni di partenza, «Ripristina» lo dice comunque', async ({ page }) => {
    const panel = await settings(page);
    await panel.getByRole('button', { name: 'Ripristina' }).click();
    await expect(panel.getByRole('status').filter({ hasText: 'Ho rimesso le impostazioni di partenza.' })).toBeVisible();
    await expect(page.locator('html')).toHaveAttribute('data-font', 'lexend');
  });

  test('con la voce predefinita, «Annulla» la lascia predefinita', async ({ page }) => {
    const panel = await settings(page);
    const voiceSelect = panel.locator('select');
    await panel.getByRole('button', { name: 'OpenDyslexic' }).click();
    await panel.getByRole('button', { name: 'Ripristina' }).click();
    await panel.getByRole('button', { name: 'Annulla' }).click();
    await expect(page.locator('html')).toHaveAttribute('data-font', 'opendyslexic');
    await expect(voiceSelect).toHaveValue('');
  });

  test('chiudendo la finestra, o cambiando altro dopo, non resta niente da annullare', async ({ page }) => {
    const panel = await settings(page);
    await panel.getByRole('button', { name: 'Atkinson' }).click();
    await panel.getByRole('button', { name: 'Ripristina' }).click();
    await expect(panel.getByRole('button', { name: 'Annulla' })).toBeVisible();
    // A new choice: «Annulla» would also take it back.
    await panel.getByRole('button', { name: 'Crema' }).click();
    await expect(panel.getByRole('button', { name: 'Annulla' })).toHaveCount(0);

    await panel.getByRole('button', { name: 'Atkinson' }).click();
    await panel.getByRole('button', { name: 'Ripristina' }).click();
    await expect(panel.getByRole('button', { name: 'Annulla' })).toBeVisible();
    await panel.getByRole('button', { name: 'Chiudi' }).click();
    await page.getByRole('button', { name: 'Aspetto' }).click();
    await expect(panel.getByRole('button', { name: 'Annulla' })).toHaveCount(0);
    await expect(page.locator('html')).toHaveAttribute('data-font', 'lexend');
  });
});

test.describe('Aspetto: versione e dettagli per chi aiuta', () => {
  test('la versione è scritta in fondo, e i dettagli si copiano negli appunti', async ({ page, context }) => {
    await context.grantPermissions(['clipboard-read', 'clipboard-write']);
    const panel = await settings(page);
    await expect(panel.getByText(/^Versione \S+$/)).toBeVisible();
    await panel.getByRole('button', { name: 'Copia i dettagli per chi ti aiuta' }).click();
    await expect(panel.getByText('Copiato: incollalo in un messaggio a chi ti aiuta.')).toBeVisible();
    const copied = await page.evaluate(() => navigator.clipboard.readText());
    expect(copied).toContain('Versione: ');
    expect(copied).toContain('Sistema: web');
    expect(copied).toContain('Nessun errore registrato.');
  });

  test('senza appunti il testo si mostra da selezionare', async ({ page }) => {
    await page.addInitScript(() => {
      Object.defineProperty(navigator, 'clipboard', { value: { writeText: () => Promise.reject(new Error('no')) }, configurable: true });
    });
    const panel = await settings(page);
    await panel.getByRole('button', { name: 'Copia i dettagli per chi ti aiuta' }).click();
    const box = panel.getByRole('textbox', { name: 'Dettagli per chi ti aiuta' });
    await expect(box).toBeVisible();
    await expect(box).toHaveJSProperty('readOnly', true);
    await expect(box).toHaveValue(/Versione: /);
    await expect(panel.getByText('Non riesco a copiare da solo.')).toBeVisible();
  });
});

test.describe('Aspetto: cerca aggiornamenti', () => {
  test('senza internet dice che serve internet', async ({ page, context }) => {
    const panel = await settings(page);
    await context.setOffline(true);
    await panel.getByRole('button', { name: 'Cerca aggiornamenti' }).click();
    await expect(panel.getByRole('status').filter({ hasText: 'Serve internet per cercare una versione nuova.' })).toBeVisible();
    await context.setOffline(false);
  });

  test('se non può chiedere al server, dice di riprovare più tardi', async ({ page }) => {
    // The tests block service workers: there is nobody to ask.
    const panel = await settings(page);
    await panel.getByRole('button', { name: 'Cerca aggiornamenti' }).click();
    await expect(panel.getByRole('status').filter({ hasText: 'Non riesco a cercare adesso. Riprova più tardi.' })).toBeVisible();
  });
});

test.describe('Aggiorna con una mappa aperta', () => {
  test('la versione nuova riapre la mappa che era aperta', async ({ page }) => {
    await newMap(page, 'Vulcani');
    const id = await page.evaluate(
      () =>
        new Promise<string>((resolve, reject) => {
          const request = indexedDB.open('mappeora');
          request.onerror = () => reject(request.error);
          request.onsuccess = () => {
            const db = request.result;
            const all = db.transaction('summaries').objectStore('summaries').getAll();
            all.onsuccess = () => (db.close(), resolve(all.result.find((m: { title: string }) => m.title === 'Vulcani').id));
            all.onerror = () => reject(all.error);
          };
        }),
    );
    // What «Aggiorna» leaves behind (see applyUpdate), then the new page.
    await page.evaluate((mapId) => sessionStorage.setItem('mappeora-reopen', mapId), id);
    await page.reload();
    await expect(page.locator('.title-input')).toHaveValue('Vulcani');
    // Only once: the next reload starts on the list.
    await page.reload();
    await expect(page.getByRole('button', { name: 'Nuova mappa' })).toBeVisible();
  });
});

test.describe('Se qualcosa si rompe', () => {
  test('la schermata di aiuto offre le tre strade e ricorda l’errore, solo sul dispositivo', async ({ page, context, consoleErrors }) => {
    await context.grantPermissions(['clipboard-read', 'clipboard-write']);
    await page.goto('/');
    await expect(page.getByRole('button', { name: 'Apri file' })).toBeVisible();
    // A record whose date is not a date: drawing the list fails.
    await page.evaluate(
      () =>
        new Promise<void>((resolve, reject) => {
          const request = indexedDB.open('mappeora');
          request.onerror = () => reject(request.error);
          request.onsuccess = () => {
            const db = request.result;
            const tx = db.transaction('summaries', 'readwrite');
            tx.objectStore('summaries').put({ id: 'rotta', title: 'Titolo segreto', updatedAt: 'ieri' });
            tx.oncomplete = () => (db.close(), resolve());
            tx.onerror = () => reject(tx.error);
          };
        }),
    );
    await page.reload();

    await expect(page.getByRole('heading', { name: 'Qualcosa è andato storto' })).toBeVisible();
    await expect(page.getByRole('alert')).toHaveText(/Le mappe salvate sono al sicuro/);
    await expect(page.getByRole('button', { name: 'Torna alle mappe' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Riavvia l’app' })).toBeVisible();
    // The error is the one expected, and the page itself did not fail.
    expect(consoleErrors.length).toBeGreaterThan(0);
    consoleErrors.splice(0);

    await page.getByRole('button', { name: 'Copia i dettagli per chi ti aiuta' }).click();
    await expect(page.getByText('Copiato: incollalo in un messaggio a chi ti aiuta.')).toBeVisible();
    const copied = await page.evaluate(() => navigator.clipboard.readText());
    expect(copied).toContain('(react, versione');
    expect(copied).not.toContain('Nessun errore registrato.');
    // Never the title of a map.
    expect(copied).not.toContain('Titolo segreto');
    const stored = await page.evaluate(() => localStorage.getItem('mappeora-errors'));
    expect(JSON.parse(stored!)).toHaveLength(1);
    expect(stored).not.toContain('Titolo segreto');
  });
});

test.describe('Editor caricato a parte', () => {
  const EDITOR = /\/assets\/MapEditor-[^/]+\.js$/;

  test('a elenco aperto il file dell’editor arriva da solo, senza aprire niente', async ({ page }) => {
    const asked: string[] = [];
    page.on('request', (r) => EDITOR.test(r.url()) && asked.push(r.url()));
    await page.goto('/');
    await expect(page.getByRole('button', { name: 'Nuova mappa' })).toBeVisible();
    await expect.poll(() => asked.length, { message: 'il file dell’editor non è stato scaricato in anticipo' }).toBe(1);
    await expect(page.locator('.title-input')).toHaveCount(0);
  });

  test('se il file tarda, si vede «Apro la mappa…» e poi la mappa', async ({ page }) => {
    let release!: () => void;
    const gate = new Promise<void>((resolve) => (release = resolve));
    await page.route(EDITOR, async (route) => {
      await gate;
      await route.continue();
    });
    await page.goto('/');
    await page.getByRole('button', { name: 'Nuova mappa' }).click();
    await page.getByPlaceholder("es. Il ciclo dell'acqua").fill('I vulcani');
    await page.getByRole('button', { name: 'Crea' }).click();
    await expect(page.getByRole('status').filter({ hasText: 'Apro la mappa…' })).toBeVisible();
    release();
    await expect(page.locator('.title-input')).toHaveValue('I vulcani');
    await expect(page.getByText('Apro la mappa…')).toHaveCount(0);
  });
});

test.describe('Cambio di schermata', () => {
  /** What a screen reader is told when the screen changes (see ScreenChange in App.tsx). */
  const spoken = (page: import('@playwright/test').Page) => page.locator('p.sr-only[aria-live="polite"]');

  test('il titolo della pagina dice dov’è il bambino, e una voce avvisa quando la schermata cambia', async ({ page }) => {
    await page.goto('/');
    const listTitle = await page.title();
    expect(listTitle).not.toBe('');
    // Nothing is said for the first screen.
    await expect(spoken(page)).toHaveText('');

    await newMap(page, 'Il sistema solare');
    await expect(page).toHaveTitle('Il sistema solare – MappAmi');
    await expect(spoken(page)).toHaveText('Mappa aperta: Il sistema solare');

    // A rename changes the title of the page, not what is said.
    await page.locator('.title-input').fill('I pianeti');
    await expect(page).toHaveTitle('I pianeti – MappAmi');
    await expect(spoken(page)).toHaveText('Mappa aperta: Il sistema solare');

    await page.getByRole('button', { name: 'Mappe' }).click();
    await expect(page.locator('.map-title')).toHaveText(['I pianeti']);
    await expect(page).toHaveTitle(listTitle);
    await expect(spoken(page)).toHaveText('Elenco delle mappe');

    await page.locator('.map-open', { hasText: 'I pianeti' }).click();
    await expect(page).toHaveTitle('I pianeti – MappAmi');
    await expect(spoken(page)).toHaveText('Mappa aperta: I pianeti');
  });
});

test.describe('Colore della barra del browser', () => {
  test('segue lo sfondo scelto, anche dopo aver ricaricato', async ({ page }) => {
    const color = () => page.locator('meta[name="theme-color"]').first().getAttribute('content');
    const panel = await settings(page);
    for (const [name, hex] of [['Scuro', '#282d38'], ['Azzurro', '#f6fafe'], ['Bianco', '#ffffff'], ['Crema', '#fffdf7']] as const) {
      await panel.getByRole('button', { name, exact: true }).click();
      expect(await color()).toBe(hex);
    }
    await panel.getByRole('button', { name: 'Scuro', exact: true }).click();
    await page.reload();
    await expect.poll(color).toBe('#282d38');
  });
});

test.describe('Ripresa dopo un aggiornamento', () => {
  /** True while the page is the one loaded at the start: a reload throws the marker away. */
  const stillThere = (page: import('@playwright/test').Page) => page.evaluate(() => (window as unknown as { __alive?: boolean }).__alive === true);

  test('il ricaricamento automatico è fermo un minuto dopo l’ultimo, poi torna possibile', async ({ page }) => {
    await page.clock.install();
    await page.addInitScript(() => {
      // As just after one automatic reload: the moment of the last one is noted, once per session.
      if (!sessionStorage.getItem('e2e-seeded')) {
        sessionStorage.setItem('e2e-seeded', '1');
        sessionStorage.setItem('mappeora-reloaded', String(Date.now()));
      }
    });
    await page.goto('/');
    await expect(page.getByRole('button', { name: 'Nuova mappa' })).toBeVisible();
    const noted = () => page.evaluate(() => Number(sessionStorage.getItem('mappeora-reloaded')));
    const before = await noted();
    await page.evaluate(() => ((window as unknown as { __alive: boolean }).__alive = true));

    // A part that fails to load right after a reload: reloading again would not help.
    await page.evaluate(() => window.dispatchEvent(new Event('vite:preloadError')));
    await page.waitForTimeout(500);
    expect(await stillThere(page)).toBe(true);
    expect(await noted()).toBe(before);

    // Much later (an installed app stays open for days, and nothing was started in between)...
    await page.clock.fastForward(61_000);
    // ...it recovers: the page loads again, and the moment is noted anew.
    await Promise.all([
      page.waitForEvent('load'),
      page.evaluate(() => window.dispatchEvent(new Event('vite:preloadError'))),
    ]);
    expect(await noted()).toBeGreaterThan(before);
  });

  test('se il file dell’editor non arriva in anticipo, la pagina non si ricarica da sola', async ({ page, consoleErrors }) => {
    const EDITOR = /\/assets\/MapEditor-[^/]+\.js$/;
    const failed = page.waitForEvent('requestfailed', (r) => EDITOR.test(r.url()));
    await page.route(EDITOR, (route) => route.abort());
    await page.goto('/');
    await page.evaluate(() => ((window as unknown as { __alive: boolean }).__alive = true));
    await failed;
    await page.waitForTimeout(1000);
    // Nobody asked for the editor yet: the list stays, and nothing is noted for a reload.
    expect(await stillThere(page)).toBe(true);
    await expect(page.getByRole('button', { name: 'Nuova mappa' })).toBeVisible();
    expect(await page.evaluate(() => sessionStorage.getItem('mappeora-reloaded'))).toBeNull();
    consoleErrors.splice(0);
  });

  test('se l’editor non arriva quando serve, «Torna alle mappe» ricarica la pagina e la mappa resta', async ({ page, consoleErrors }) => {
    const EDITOR = /\/assets\/MapEditor-[^/]+\.js$/;
    await page.addInitScript(() => {
      // A reload was just done: this one shows the help screen instead of reloading by itself.
      if (!sessionStorage.getItem('e2e-seeded')) {
        sessionStorage.setItem('e2e-seeded', '1');
        sessionStorage.setItem('mappeora-reloaded', String(Date.now()));
      }
    });
    await page.route(EDITOR, (route) => route.abort());
    await page.goto('/');
    await page.getByRole('button', { name: 'Nuova mappa' }).click();
    await page.getByPlaceholder("es. Il ciclo dell'acqua").fill('I vulcani');
    await page.getByRole('button', { name: 'Crea' }).click();
    await expect(page.getByRole('heading', { name: 'Qualcosa è andato storto' })).toBeVisible();
    expect(consoleErrors.length).toBeGreaterThan(0);
    consoleErrors.splice(0);

    // Going back to the list would fail again at the next map: a new page gets the part again.
    await page.unroute(EDITOR);
    await Promise.all([page.waitForEvent('load'), page.getByRole('button', { name: 'Torna alle mappe' }).click()]);
    await expect(page.locator('.map-title')).toHaveText(['I vulcani']);
    await page.locator('.map-open', { hasText: 'I vulcani' }).click();
    await expect(page.locator('.title-input')).toHaveValue('I vulcani');
  });
});

test.describe('Apri file', () => {
  test('un file enorme si rifiuta subito, senza leggerlo', async ({ page }, testInfo) => {
    await page.goto('/');
    // A sparse file just over the limit: nothing is really written.
    const file = testInfo.outputPath('enorme.mappami');
    await mkdir(dirname(file), { recursive: true });
    const handle = await open(file, 'w');
    await handle.truncate(100 * 1024 * 1024 + 1);
    await handle.close();

    const chooser = page.waitForEvent('filechooser');
    await page.getByRole('button', { name: 'Apri file' }).click();
    await (await chooser).setFiles(file);
    await expect(page.getByRole('alert')).toHaveText('Questo file è troppo grande per essere una mappa.');
    await expect(page.getByRole('button', { name: 'Apri file' })).toBeVisible();
  });
});

test.describe('Schermata iniziale: niente salti', () => {
  test('i modi per iniziare non scendono quando arriva l’elenco delle mappe', async ({ page, context, browserName }) => {
    test.skip(browserName !== 'chromium', 'il rallentamento della CPU funziona solo in Chromium');
    await openCopy(page, ['Le stagioni', 'Gli animali', 'Il ciclo dell’acqua', 'I vulcani', 'I fiumi', 'Il corpo umano']);
    await page.addInitScript(() => {
      const shifts: { value: number; moved: string[] }[] = [];
      (window as unknown as { __shifts: typeof shifts }).__shifts = shifts;
      new PerformanceObserver((list) => {
        for (const e of list.getEntries() as unknown as { value: number; hadRecentInput: boolean; sources?: { node?: Element }[] }[]) {
          if (!e.hadRecentInput) shifts.push({ value: e.value, moved: (e.sources ?? []).map((s) => String(s.node?.className ?? s.node?.nodeName)) });
        }
      }).observe({ type: 'layout-shift', buffered: true });
    });
    // A slow phone: the list of maps answers after the first screen is drawn.
    await (await context.newCDPSession(page)).send('Emulation.setCPUThrottlingRate', { rate: 6 });
    await page.reload();
    await expect(page.locator('.map-card')).toHaveCount(6);
    await expect(page.getByRole('button', { name: 'Apri file' })).toBeVisible();
    await page.waitForTimeout(1500);
    const shifts = await page.evaluate(() => (window as unknown as { __shifts: { value: number; moved: string[] }[] }).__shifts);
    const moved = shifts.flatMap((s) => s.moved);
    expect(moved).not.toContain('start-grid');
    expect(moved).not.toContain('section-title');
    expect(shifts.reduce((sum, s) => sum + s.value, 0)).toBeLessThan(0.1);
  });
});
