import { test, expect, say } from './fixtures';
import { addConcept, newMap, node, nodes, openCopy, toolbar, type TemplateName } from './helpers';

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
    await expect(page.locator('.map-date')).toHaveText(['Oggi']);
    await page.reload();
    await page.locator('.map-open', { hasText: 'La fotosintesi delle piante' }).click();
    await expect(nodes(page)).toHaveCount(1);
  });

  test('ricaricando la pagina dall’editor, subito dopo una modifica, non si perde niente', async ({ page }) => {
    await newMap(page, 'I vulcani');
    await addConcept(page, 'I vulcani', 'Lava');
    await page.locator('.title-input').fill('I vulcani attivi');
    await page.reload(); // no time for the autosave: only the save on leaving the page
    await page.locator('.map-open', { hasText: 'I vulcani attivi' }).click();
    await expect(nodes(page)).toHaveCount(2);
    await expect(node(page, 'Lava')).toBeVisible();
  });

  test('«Indietro» del browser chiude la finestra aperta, poi torna alle mappe, senza uscire dal sito', async ({ page, isMobile }) => {
    test.skip(isMobile, 'basta provarlo una volta');
    await newMap(page, 'I fiumi');
    await toolbar(page, 'Salva');
    const dialog = page.getByRole('dialog', { name: 'Salva, esporta o stampa' });
    await expect(dialog).toBeVisible();
    await page.goBack();
    await expect(dialog).toBeHidden();
    await expect(page.locator('.title-input')).toHaveValue('I fiumi');
    await page.goBack();
    await expect(page.locator('.map-title')).toHaveText(['I fiumi']);
    // and opening it again, Back still comes back here
    await page.locator('.map-open', { hasText: 'I fiumi' }).click();
    await expect(page.locator('.title-input')).toHaveValue('I fiumi');
    await page.goBack();
    await expect(page.locator('.map-title')).toHaveText(['I fiumi']);
  });

  test('le mappe salvate con la versione precedente compaiono ancora nell’elenco', async ({ page, isMobile }) => {
    test.skip(isMobile, 'basta provarlo una volta');
    await page.goto('/privacy.html'); // same site, without the app holding the database open
    await page.evaluate(async () => {
      const done = (r: IDBRequest | IDBOpenDBRequest) => new Promise((ok, ko) => ((r.onsuccess = ok), (r.onerror = ko)));
      await done(indexedDB.deleteDatabase('mappeora'));
      const open = indexedDB.open('mappeora', 10); // Dexie's version 1
      open.onupgradeneeded = () => open.result.createObjectStore('maps', { keyPath: 'id' }).createIndex('updatedAt', 'updatedAt');
      await done(open);
      const map = { id: 'vecchia', title: 'Una mappa di prima', createdAt: 1, updatedAt: 2, template: 'libera', edges: [] };
      const tx = open.result.transaction('maps', 'readwrite');
      tx.objectStore('maps').put({ ...map, nodes: [{ id: 'a', label: 'Una mappa di prima', position: { x: 0, y: 0 } }] });
      await new Promise((ok) => (tx.oncomplete = ok));
      open.result.close();
    });
    await page.goto('/');
    await expect(page.locator('.map-title')).toContainText(['Una mappa di prima']);
    await page.locator('.map-open', { hasText: 'Una mappa di prima' }).click();
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

  test('cancella una mappa senza chiedere; «Annulla», al suo posto, la rimette', async ({ page }) => {
    await newMap(page, 'Prima');
    await newMap(page, 'Da cancellare');
    await page.getByRole('button', { name: 'Mappe' }).click();
    await page.getByRole('button', { name: 'Cancella Da cancellare' }).click();
    // No browser «OK / Annulla»: the map is gone, and where it was...
    await expect(page.locator('.map-title')).toHaveText(['Prima']);
    const undo = page.getByRole('button', { name: 'Annulla' });
    await expect(undo).toHaveAccessibleDescription('Hai cancellato «Da cancellare».');
    await expect(undo).toBeFocused();
    await expect(page.locator('.map-list > li').first()).toHaveClass('map-removed');
    // ...«Annulla» brings it back, in its place, with the focus on it.
    await undo.click();
    await expect(page.locator('.map-title')).toHaveText(['Da cancellare', 'Prima']);
    await expect(page.getByRole('button', { name: /^Da cancellare/ })).toBeFocused();
    await expect(page.locator('.map-removed')).toHaveCount(0);

    // Leaving the screen makes it final.
    await page.getByRole('button', { name: 'Cancella Da cancellare' }).click();
    await page.getByRole('button', { name: 'Cancella Prima' }).click();
    await expect(page.locator('.map-card')).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Annulla' })).toHaveAccessibleDescription('Hai cancellato «Prima».');
    await expect(page.getByText('Non hai ancora mappe')).toHaveCount(0);
    await page.reload();
    await expect(page.getByText('Non hai ancora mappe')).toBeVisible();
    await expect(page.locator('.map-removed')).toHaveCount(0);
  });

  test('con tante mappe: le ultime 5, «Tutte le mie mappe» e la ricerca', async ({ page }) => {
    // Oldest first.
    await openCopy(page, ['Le stagioni', 'Il vulcano', 'Perché piove?', 'Gli animali della savana', 'La Rivoluzione francese', 'Il ciclo dell’acqua', 'I pianeti', 'Le frazioni']);

    // The latest five; the others behind one button.
    await expect(page.locator('.map-title')).toHaveText(['Le frazioni', 'I pianeti', 'Il ciclo dell’acqua', 'La Rivoluzione francese', 'Gli animali della savana']);
    const more = page.getByRole('button', { name: 'Tutte le mie mappe (8)' });
    await expect(more).toBeVisible();

    // The search looks in all of them, the way a child types: no accents, plural.
    const search = page.getByRole('searchbox', { name: 'Cerca una mappa' });
    await search.fill('vulcani');
    await expect(page.locator('.map-title')).toHaveText(['Il vulcano']);
    await expect(search).toHaveAccessibleDescription('Ho trovato 1 mappa.');
    await expect(more).toHaveCount(0);
    await search.fill('perche');
    await expect(page.locator('.map-title')).toHaveText(['Perché piove?']);
    await search.fill('dinosauri');
    await expect(page.locator('.map-card')).toHaveCount(0);
    await expect(page.getByText('Non trovo mappe con «dinosauri» nel titolo.')).toBeVisible();
    // ...or by voice.
    await say(page, 'Le stagioni');
    await page.getByRole('button', { name: 'Cerca con la voce' }).click();
    await expect(search).toHaveValue('Le stagioni');
    await expect(page.locator('.map-title')).toHaveText(['Le stagioni']);
    await search.fill('');
    await expect(page.locator('.map-card')).toHaveCount(5);

    // «Tutte le mie mappe»: all of them, the focus on the first one that was hidden.
    await more.click();
    await expect(page.locator('.map-card')).toHaveCount(8);
    await expect(page.getByRole('button', { name: /^Perché piove\?/ })).toBeFocused();
    await expect(more).toHaveCount(0);

    // Down to six maps, nothing is hidden and there is nothing to search.
    await page.getByRole('button', { name: 'Cancella Le frazioni' }).click();
    await page.getByRole('button', { name: 'Cancella I pianeti' }).click();
    await expect(page.locator('.map-card')).toHaveCount(6);
    await expect(search).toHaveCount(0);
    await page.reload();
    await expect(page.locator('.map-card')).toHaveCount(6);
    await expect(page.getByRole('button', { name: /^Tutte le mie mappe/ })).toHaveCount(0);
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

  test('i quattro modi per iniziare sono nominati e spiegati; «Dal libro» apre subito la foto', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByRole('group', { name: 'Altri modi per iniziare' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Nuova mappa' })).toHaveAccessibleDescription(/foglio vuoto/);
    for (const name of ['Dal libro', 'Impara facendo', 'Esempi', 'Apri file']) {
      await expect(page.getByRole('button', { name, exact: true })).toHaveAccessibleDescription(/\S/);
    }
    await page.getByRole('button', { name: 'Dal libro', exact: true }).click();
    await expect(page.getByRole('dialog', { name: 'Dal libro' })).toBeVisible();
  });

  test('l’informativa privacy si apre dalla schermata iniziale e riporta all’app', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('link', { name: 'Privacy' }).click();
    await expect(page.getByRole('heading', { level: 1, name: 'Privacy' })).toBeVisible();
    await expect(page.getByText('Le tue mappe restano')).toBeVisible();
    await page.getByRole('link', { name: 'Torna a MappAmi' }).first().click();
    await expect(page.getByRole('heading', { name: 'Le mie mappe' })).toBeVisible();
  });

  test('i crediti (licenza delle illustrazioni) si aprono dalla schermata iniziale e riportano all’app', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('link', { name: 'Crediti' }).click();
    await expect(page.getByRole('heading', { level: 1, name: 'Crediti e licenze' })).toBeVisible();
    await expect(page.getByText('Fluent Emoji').first()).toBeVisible();
    await expect(page.getByText('Copyright (c) Microsoft Corporation.')).toBeVisible();
    await page.getByRole('link', { name: 'Torna a MappAmi' }).click();
    await expect(page.getByRole('heading', { name: 'Le mie mappe' })).toBeVisible();
  });
});
