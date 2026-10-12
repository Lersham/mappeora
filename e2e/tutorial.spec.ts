import type { Page } from '@playwright/test';
import { test, expect, say, spoken } from './fixtures';
import { addConcept, mascot, newMap, node, nodes, onScreen, rename, settled, tapLink, toolbar } from './helpers';

/** The concepts not wholly in sight: out of the map's area, or under a bar floating over it. */
const hidden = (page: Page) =>
  page.evaluate(() => {
    const flow = document.querySelector('.react-flow')!.getBoundingClientRect();
    const bars = [...document.querySelectorAll('.selection-bar')].map((b) => b.getBoundingClientRect().top);
    const bottom = Math.min(flow.bottom, ...bars);
    return [...document.querySelectorAll('.concept-node')]
      .filter((n) => {
        const r = n.getBoundingClientRect();
        return r.top < flow.top || r.left < flow.left || r.right > flow.right || r.bottom > bottom;
      })
      .map((n) => n.querySelector('.concept-label')?.textContent);
  });

test.describe('Impara facendo', () => {
  test('dalla home costruisce una mappa vera, un passo alla volta', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('button', { name: 'Impara facendo' }).click();
    const coach = page.getByRole('region', { name: 'Tutorial' });
    const bar = page.getByRole('navigation', { name: 'Strumenti' });
    const next = async (title: string) => {
      await expect(coach.getByRole('status')).toContainText('Ben fatto');
      await coach.getByRole('button', { name: 'Avanti' }).click();
      await expect(coach.getByRole('heading', { name: title })).toBeVisible();
    };

    await expect(coach.getByRole('heading', { name: 'L’idea principale' })).toBeVisible();
    await expect(coach).toContainText('Passo 1 di 21');
    await mascot(coach, 'indica');
    await expect(page.locator('.title-input')).toHaveValue('La mia prima mappa');
    // Until the step is done there is only «Salta».
    await expect(coach.getByRole('button', { name: 'Avanti' })).toHaveCount(0);
    await coach.getByRole('button', { name: 'Ascolta' }).click();
    await expect.poll(() => spoken(page)).toContainEqual(expect.stringContaining('L’idea principale.'));

    await rename(page, 'La mia prima mappa', 'Il sole');
    // Done: it cheers; on the next step it points again.
    await mascot(coach, 'esulta');
    await next('Un nuovo concetto');
    await mascot(coach, 'indica');

    const concept = bar.getByRole('button', { name: 'Concetto', exact: true });
    await expect(concept).toHaveClass(/tutorial-target/);
    await concept.click();
    await next('Dagli un nome');
    await expect(concept).not.toHaveClass(/tutorial-target/);

    await rename(page, 'Nuovo concetto', 'Luce e calore');
    await next('Tocca, ritocca, tieni premuto');

    // A tap chooses it, another one opens «Immagine e colore».
    await page.locator('.react-flow__pane').click({ position: { x: 4, y: 4 } });
    await (await onScreen(page, node(page, 'Luce e calore'))).click();
    await (await onScreen(page, node(page, 'Luce e calore'))).click();
    const style = page.getByRole('dialog', { name: 'Immagine e colore' });
    await expect(style).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(style).toHaveCount(0);
    await next('Le parole che collegano');

    await tapLink(page, 0);
    await page.getByRole('dialog', { name: 'Parola di collegamento' }).getByRole('button', { name: 'serve per' }).click();
    await next('Ascolta la mappa');

    await bar.getByRole('button', { name: 'Leggi', exact: true }).click();
    await next('Detta un concetto');
    // «Avanti» does not cut the reading short.
    await expect.poll(() => spoken(page)).toContainEqual(expect.stringContaining('Il sole'));

    await say(page, 'Estate');
    await toolbar(page, 'Detta');
    await expect(node(page, 'Estate')).toBeVisible();
    await next('Un’immagine');

    // «Estate», just dictated, is already the concept in hand: its tools are there.
    const image = page.getByRole('toolbar', { name: 'Concetto scelto' }).getByRole('button', { name: 'Immagine', exact: true });
    await expect(image).toHaveClass(/tutorial-target/);
    await image.click();
    await page.getByRole('searchbox', { name: 'Cerca un\'immagine' }).fill('sole');
    await page.locator('.illustration-tile').first().click();
    await expect(node(page, 'Estate').locator('.concept-illustration, .concept-emoji')).toBeVisible();
    await next('Togli una freccia');

    // «Estate»'s line goes; both concepts stay.
    const lines = page.locator('.react-flow__edge');
    await expect(lines).toHaveCount(2);
    await tapLink(page, 1);
    await page.getByRole('dialog', { name: 'Parola di collegamento' }).getByRole('button', { name: 'Togli freccia' }).click();
    await expect(lines).toHaveCount(1);
    await expect(nodes(page)).toHaveCount(3);
    await next('Rimetti la freccia');

    const undo = page.locator('.topbar').getByRole('button', { name: 'Annulla', exact: true });
    await expect(undo).toHaveClass(/tutorial-target/);
    await undo.click();
    await expect(lines).toHaveCount(2);
    await next('Cambia ramo');
    await expect(undo).not.toHaveClass(/tutorial-target/);
    // The other tools have a test of their own (below).
    while (!(await coach.getByRole('heading', { name: 'Ce l’hai fatta!' }).isVisible())) {
      await coach.getByRole('button', { name: /^(Avanti|Salta)$/ }).click();
    }

    await expect(coach.getByRole('button', { name: 'Chiudi' })).toHaveCount(0);
    await coach.getByRole('button', { name: 'Fine' }).click();
    await expect(coach).toHaveCount(0);
    await expect(nodes(page)).toHaveCount(3);

    // The map is a real one: it is in «Le mie mappe».
    await page.getByRole('button', { name: 'Mappe', exact: true }).click();
    await expect(page.locator('.map-title', { hasText: 'La mia prima mappa' })).toBeVisible();
  });

  test('«Salta» va avanti senza fare il passo, «Chiudi» toglie la guida', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('button', { name: 'Impara facendo' }).click();
    const coach = page.getByRole('region', { name: 'Tutorial' });
    await coach.getByRole('button', { name: 'Salta' }).click();
    await expect(coach.getByRole('heading', { name: 'Un nuovo concetto' })).toBeVisible();
    await expect(coach).toContainText('Passo 2 di 21');
    await coach.getByRole('button', { name: 'Chiudi' }).click();
    await expect(coach).toHaveCount(0);
    await expect(page.locator('.tutorial-target')).toHaveCount(0);
  });

  test('poi ogni altro pulsante, detto e indicato: anche quando è dentro «Altro»', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('button', { name: 'Impara facendo' }).click();
    const coach = page.getByRole('region', { name: 'Tutorial' });
    const bar = page.getByRole('navigation', { name: 'Strumenti' });
    const tools = page.getByRole('toolbar', { name: 'Concetto scelto' });
    const next = async (title: string) => {
      await expect(coach.getByRole('status')).toContainText('Ben fatto');
      await coach.getByRole('button', { name: 'Avanti' }).click();
      await expect(coach.getByRole('heading', { name: title })).toBeVisible();
    };
    /** A concept that is not the one in hand (a tap on that one opens «Immagine e colore»). */
    const choose = async (label: string) => {
      await page.locator('.react-flow__pane').click({ position: { x: 4, y: 4 } });
      await (await onScreen(page, node(page, label))).click();
    };
    /** The tool asked for stands out where it is: in a bar, or in «Altro» (which stands out too). */
    const useTool = async (name: string) => {
      for (const place of [bar, page.locator('.topbar')]) {
        const tool = place.getByRole('button', { name, exact: true });
        if (await tool.isVisible()) {
          await expect(tool).toHaveClass(/tutorial-target/);
          return tool.click();
        }
      }
      const more = bar.getByRole('button', { name: 'Altro', exact: true });
      await expect(more).toHaveClass(/tutorial-target/);
      await more.click();
      const tool = page.getByRole('dialog', { name: 'Altro' }).getByRole('button', { name, exact: true });
      await expect(tool).toHaveClass(/tutorial-target/);
      await tool.click();
    };
    const background = (label: string) => node(page, label).evaluate((e) => getComputedStyle(e).backgroundColor);

    await coach.getByRole('button', { name: 'Salta' }).click();
    await addConcept(page, 'La mia prima mappa', 'Luce');
    await addConcept(page, 'La mia prima mappa', 'Estate');
    while (!(await coach.getByRole('heading', { name: 'Cambia ramo' }).isVisible())) {
      await coach.getByRole('button', { name: /^(Avanti|Salta)$/ }).click();
    }

    await choose('Estate');
    await expect(tools.getByRole('button', { name: 'Cambia ramo', exact: true })).toHaveClass(/tutorial-target/);
    await tools.getByRole('button', { name: 'Cambia ramo', exact: true }).click();
    await (await onScreen(page, node(page, 'Luce'))).click();
    await next('Metti i concetti dove vuoi');

    await useTool('Sposta');
    await next('Bianca o colorata');

    // One branch only («Estate» is under «Luce»): first a second one under the main idea.
    await expect(coach).toContainText('servono almeno due rami');
    await expect(bar.getByRole('button', { name: 'Concetto', exact: true })).toHaveClass(/tutorial-target/);
    await addConcept(page, 'La mia prima mappa', 'Il giorno');
    await expect(coach).toContainText('La tua mappa è bianca');

    // A picture, as in the guide's own map: taller concepts, a map that on a
    // phone is no longer wide enough to fill the strip the guide leaves it.
    await choose('Estate');
    await tools.getByRole('button', { name: 'Immagine', exact: true }).click();
    await page.getByRole('searchbox', { name: 'Cerca un\'immagine' }).fill('sole');
    await page.locator('.illustration-tile').first().click();
    await expect(node(page, 'Estate').locator('.concept-illustration, .concept-emoji')).toBeVisible();

    // White, as it starts; «Riordina», then «Colora i rami», gives it colours.
    for (const label of ['Luce', 'Estate', 'Il giorno']) expect(await background(label)).toBe('rgb(255, 255, 255)');
    await useTool('Riordina');
    await page.getByRole('button', { name: 'Colora i rami' }).click();
    await settled(page);
    expect(await background('Luce')).not.toBe('rgb(255, 255, 255)');
    // The colours are to be seen: on a phone the map's area is a strip wider
    // than it is tall, and no concept may end up under the tools of the one
    // in hand.
    expect(await hidden(page)).toEqual([]);
    await next('Un colore tutto suo');

    await choose('Estate');
    await expect(tools.getByRole('button', { name: 'Immagine', exact: true })).toHaveClass(/tutorial-target/);
    await (await onScreen(page, node(page, 'Estate'))).click(); // a second tap: «Immagine e colore»
    const style = page.getByRole('dialog', { name: 'Immagine e colore' });
    await style.locator('.color-swatch[aria-pressed="false"]').first().click();
    await style.getByRole('button', { name: 'Fatto' }).click();
    await next('Togli un concetto');

    await choose('Estate');
    await expect(tools.getByRole('button', { name: 'Elimina', exact: true })).toHaveClass(/tutorial-target/);
    await tools.getByRole('button', { name: 'Elimina', exact: true }).click();
    await expect(node(page, 'Estate')).toHaveCount(0);
    await next('Dal libro');

    await useTool('Dal libro');
    await page.getByRole('dialog', { name: 'Dal libro' }).getByRole('button', { name: 'Chiudi' }).click();
    await next('Ripassa');

    // During the review the guide steps aside, and remembers the step is done.
    await useTool('Ripassa');
    await page.getByRole('dialog', { name: 'Ripassa' }).getByRole('button', { name: /^Un passo alla volta/ }).click();
    await expect(coach).toHaveCount(0);
    await page.locator('.topbar').getByRole('button', { name: 'Esci' }).click();
    await next('Salva e manda');

    await useTool('Salva e manda');
    await page.getByRole('dialog', { name: 'Salva e manda' }).getByRole('button', { name: 'Annulla' }).click();
    await next('Come la vedi');

    await useTool('Aspetto');
    await page.getByRole('dialog', { name: 'Aspetto e voce' }).getByRole('button', { name: 'Chiudi' }).click();
    await next('Solo la mappa');

    const focus = page.getByRole('button', { name: 'Solo la mappa: nascondi i pulsanti' });
    await expect(focus).toHaveClass(/tutorial-target/);
    await focus.click();
    await expect(coach).toBeHidden();
    await page.getByRole('button', { name: 'Mostra i pulsanti' }).click();
    await next('Ce l’hai fatta!');

    // The colours were only to show how: the tutorial leaves the map white,
    // lines and borders too.
    expect(await background('Luce')).not.toBe('rgb(255, 255, 255)');
    const tinted = page.locator('.react-flow__edge-path.branch-line, .concept-node.sheet-branch[class*="branch-"]');
    await expect(tinted.first()).toBeAttached();
    await coach.getByRole('button', { name: 'Fine' }).click();
    await expect(coach).toHaveCount(0);
    for (const label of ['La mia prima mappa', 'Luce', 'Il giorno']) {
      await expect.poll(() => background(label)).toBe('rgb(255, 255, 255)');
    }
    await expect(tinted).toHaveCount(0);
  });

  test('una mappa nuova qualsiasi non ha la guida', async ({ page }) => {
    await newMap(page, 'Le piante');
    await expect(page.getByRole('region', { name: 'Tutorial' })).toHaveCount(0);
  });
});
