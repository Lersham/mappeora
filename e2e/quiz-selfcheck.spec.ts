import AxeBuilder from '@axe-core/playwright';
import type { Page } from '@playwright/test';
import { test, expect, holdMic, micsOpen, say, spoken } from './fixtures';
import { addConcept, newMap, node, nodes, toolbar } from './helpers';

/** «Indovina»: after «Scopri» the child says «Lo sapevo» or «Non lo sapevo». */

const bar = (page: Page) => page.getByRole('navigation', { name: 'Ripasso' });
const answers = (page: Page) => page.getByRole('group', { name: 'Come è andata?' });
const summary = (page: Page) => page.locator('.quiz-summary');
const progress = (page: Page) => bar(page).locator('.review-progress');

/** «Le stagioni» with some concepts under it, read in this order. */
async function seasons(page: Page, children = ['Estate', 'Inverno', 'Autunno']) {
  await newMap(page, 'Le stagioni');
  for (const child of children) await addConcept(page, 'Le stagioni', child);
}

async function startQuiz(page: Page) {
  await toolbar(page, 'Ripassa');
  await page.getByRole('button', { name: /^Indovina/ }).click();
  await expect(page.locator('.concept-mystery')).toBeVisible();
}

const reveal = (page: Page) => bar(page).getByRole('button', { name: 'Scopri' }).click();
const grade = async (page: Page, knew: boolean) => {
  await reveal(page);
  await answers(page)
    .getByRole('button', { name: knew ? 'Lo sapevo' : 'Non lo sapevo', exact: true })
    .click();
};

async function seriousProblems(page: Page) {
  const { violations } = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa']).analyze();
  return violations
    .filter((v) => v.impact === 'serious' || v.impact === 'critical')
    .map((v) => `${v.id}: ${v.help} → ${v.nodes.slice(0, 3).map((n) => n.target.join(' ')).join(' | ')}`);
}

/** Nothing cut off or beyond the screen, with the longest words on the buttons. */
async function barsFit(page: Page) {
  const clipped = await page
    .locator('.review-bar .big-button-label')
    .evaluateAll((els) => els.filter((e) => e.scrollWidth > e.clientWidth + 1).map((e) => e.textContent));
  expect(clipped, 'parole tagliate sui pulsanti').toEqual([]);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  const sides = await page.locator('.review-bar').evaluateAll((els) =>
    els.map((e) => {
      const r = e.getBoundingClientRect();
      return r.left >= -1 && r.right <= window.innerWidth + 1 && e.scrollWidth <= e.clientWidth + 1;
    }),
  );
  expect(sides.every(Boolean), 'barre dentro lo schermo').toBe(true);
}

test.describe('Indovina: «Lo sapevo» e «Non lo sapevo»', () => {
  test('dopo «Scopri» il bambino dice se lo sapeva; alla fine c’è il riepilogo, letto ad alta voce', async ({ page }) => {
    await seasons(page);
    await startQuiz(page);
    await expect(progress(page)).toHaveText('1 / 4');
    // nothing to answer before the concept is shown
    await expect(answers(page)).toHaveCount(0);
    await reveal(page);
    await expect(answers(page).getByRole('button')).toHaveText(['Non lo sapevo', 'A voce', 'Lo sapevo']);
    await barsFit(page);
    expect(await seriousProblems(page)).toEqual([]);
    await answers(page).getByRole('button', { name: 'Lo sapevo', exact: true }).click();
    // answering goes on to the next concept, hidden again
    await expect(progress(page)).toHaveText('2 / 4');
    await expect(answers(page)).toHaveCount(0);
    await expect(page.locator('.concept-mystery')).toBeVisible();
    await grade(page, false); // Estate
    await grade(page, true); // Inverno
    await expect(progress(page)).toHaveText('4 / 4');
    await reveal(page);
    await answers(page).getByRole('button', { name: 'Non lo sapevo', exact: true }).click();

    // the summary: encouraging, with what to look at again; the whole map, those concepts ringed
    const text = 'Ne sapevi 2 su 4. Da rivedere: Estate, Autunno.';
    await expect(summary(page)).toHaveText(text);
    await expect.poll(async () => (await spoken(page)).at(-1)).toBe(text);
    await expect(nodes(page)).toHaveCount(4);
    await expect(page.locator('.concept-mystery')).toHaveCount(0);
    await expect(page.locator('.concept-node.review-current')).toHaveCount(2);
    await expect(node(page, 'Estate')).toHaveClass(/review-current/);
    await expect(node(page, 'Inverno')).not.toHaveClass(/review-current/);
    await expect(bar(page).getByRole('button')).toHaveText(['Indietro', 'Ripassa solo questi', 'Fine']);
    await expect(answers(page)).toHaveCount(0);
    await barsFit(page);
    expect(await seriousProblems(page)).toEqual([]);
    expect(text).not.toMatch(/sbagliat|errori/i);
    await bar(page).getByRole('button', { name: 'Fine' }).click();
    await expect(page.locator('.review-bar')).toHaveCount(0);
    await expect(page.locator('.review-hidden, .review-current, .review-mystery')).toHaveCount(0);
    await expect(nodes(page)).toHaveCount(4);
  });

  test('«Ripassa solo questi» riparte con i soli concetti da rivedere, gli altri restano come indizi', async ({ page }) => {
    await seasons(page);
    await startQuiz(page);
    for (const knew of [true, false, true, false]) await grade(page, knew);
    await expect(summary(page)).toHaveText('Ne sapevi 2 su 4. Da rivedere: Estate, Autunno.');
    await bar(page).getByRole('button', { name: 'Ripassa solo questi' }).click();

    await expect(progress(page)).toHaveText('1 / 2');
    await expect(summary(page)).toHaveCount(0);
    // the concepts known stay on the map; the first to look at again is hidden, the second not there yet
    await expect(node(page, 'Le stagioni')).toBeVisible();
    await expect(node(page, 'Inverno')).toBeVisible();
    await expect(page.locator('.concept-mystery')).toHaveCount(1);
    await expect(node(page, 'Estate')).toHaveCount(0);
    await expect(node(page, 'Autunno')).toHaveCount(0);
    await expect(nodes(page)).toHaveCount(3);
    await reveal(page);
    await expect(node(page, 'Estate')).toBeVisible();
    await expect.poll(() => spoken(page)).toContain('Estate');
    await answers(page).getByRole('button', { name: 'Non lo sapevo', exact: true }).click();
    await expect(progress(page)).toHaveText('2 / 2');
    await grade(page, true); // Autunno
    // only the two were asked
    await expect(summary(page)).toHaveText('Ne sapevi 1 su 2. Da rivedere: Estate.');
    // and once more, with only what is still missing
    await bar(page).getByRole('button', { name: 'Ripassa solo questi' }).click();
    await expect(progress(page)).toHaveText('1 / 1');
    await grade(page, true);
    await expect(summary(page)).toHaveText('Perfetto! Li sapevi tutti: 1 su 1.');
    // nothing left to look at again
    await expect(bar(page).getByRole('button')).toHaveText(['Indietro', 'Fine']);
    await expect(bar(page).getByRole('button', { name: 'Ripassa solo questi' })).toHaveCount(0);
    await bar(page).getByRole('button', { name: 'Fine' }).click();
    await expect(nodes(page)).toHaveCount(4);
    // a new «Indovina» starts from the whole map again
    await startQuiz(page);
    await expect(progress(page)).toHaveText('1 / 4');
  });

  test('«Avanti» salta il concetto: non conta né come saputo né come da rivedere', async ({ page }) => {
    await seasons(page, ['Estate', 'Inverno']);
    await startQuiz(page);
    await reveal(page);
    await bar(page).getByRole('button', { name: 'Avanti' }).click(); // Le stagioni, not answered
    await expect(progress(page)).toHaveText('2 / 3');
    await grade(page, true); // Estate
    await grade(page, false); // Inverno
    await expect(summary(page)).toHaveText('Ne sapevi 1 su 2. Da rivedere: Inverno.');
    await expect(node(page, 'Le stagioni')).not.toHaveClass(/review-current/);
    await bar(page).getByRole('button', { name: 'Ripassa solo questi' }).click();
    await expect(progress(page)).toHaveText('1 / 1');
  });

  test('«Finito!» senza aver risposto esce subito; con una risposta mostra il riepilogo, e «Indietro» ci ripensa', async ({ page }) => {
    await newMap(page, 'Le stagioni');
    await startQuiz(page);
    await expect(progress(page)).toHaveText('1 / 1');
    await expect(bar(page).getByRole('button', { name: 'Avanti' })).toBeDisabled();
    await reveal(page);
    await bar(page).getByRole('button', { name: 'Finito!' }).click();
    await expect(page.locator('.review-bar')).toHaveCount(0);

    await startQuiz(page);
    await reveal(page);
    await answers(page).getByRole('button', { name: 'Non lo sapevo', exact: true }).click();
    await expect(summary(page)).toHaveText('Nessun problema, ripassando si impara! Da rivedere: Le stagioni.');
    // «Indietro» goes back to the concept, to answer it again
    await bar(page).getByRole('button', { name: 'Indietro' }).click();
    await expect(summary(page)).toHaveCount(0);
    await expect(answers(page)).toBeVisible();
    await answers(page).getByRole('button', { name: 'Lo sapevo', exact: true }).click();
    await expect(summary(page)).toHaveText('Perfetto! Li sapevi tutti: 1 su 1.');
    await page.keyboard.press('Escape');
    await expect(page.locator('.review-bar')).toHaveCount(0);
  });

  test('con la tastiera: si risponde con Invio e il fuoco passa al «Scopri» seguente', async ({ page, isMobile }) => {
    test.skip(isMobile, 'keyboard only');
    await seasons(page, ['Estate']);
    await startQuiz(page);
    await page.keyboard.press('ArrowRight'); // «Scopri» with the arrow, as with a clicker
    await expect(answers(page)).toBeVisible();
    await answers(page).getByRole('button', { name: 'Non lo sapevo', exact: true }).focus();
    await page.keyboard.press('Enter');
    await expect(progress(page)).toHaveText('2 / 2');
    await expect(bar(page).getByRole('button', { name: 'Scopri' })).toBeFocused();
    await page.keyboard.press('Enter');
    await answers(page).getByRole('button', { name: 'Lo sapevo', exact: true }).focus();
    await page.keyboard.press('Enter');
    await expect(summary(page)).toHaveText('Ne sapevi 1 su 2. Da rivedere: Le stagioni.');
    // the end: the keyboard is on the next thing to do
    await expect(bar(page).getByRole('button', { name: 'Ripassa solo questi' })).toBeFocused();
    await page.keyboard.press('Enter');
    await expect(progress(page)).toHaveText('1 / 1');
    // arrows still walk through the concepts without answering
    await page.keyboard.press('ArrowRight');
    await expect(answers(page)).toBeVisible();
    await page.keyboard.press('ArrowLeft');
    await expect(progress(page)).toHaveText('1 / 1');
  });

  test('a voce: «lo sapevo», «non sapevo»… dopo aver premuto «A voce»', async ({ page }) => {
    await seasons(page, ['Estate', 'Inverno']);
    await startQuiz(page);
    const speak = answers(page).getByRole('button', { name: 'A voce' });
    await reveal(page);

    // not understood: nothing is recorded, the child is told what to say
    await holdMic(page);
    await say(page, 'evaporazione');
    await speak.click();
    const overlay = page.getByRole('dialog', { name: 'Dettatura' });
    await expect(overlay).toContainText('Puoi anche dire: «lo sapevo», «non lo sapevo»');
    await overlay.getByRole('button', { name: 'Fatto' }).click();
    await expect(overlay).toHaveCount(0);
    const note = page.locator('.quiz-text');
    await expect(note).toHaveText('Non ho capito. Prova a dire «lo sapevo» o «non lo sapevo», oppure tocca un pulsante.');
    await expect(progress(page)).toHaveText('1 / 3');
    await expect.poll(() => micsOpen(page)).toBe(0);
    await page.evaluate(() => ((window as unknown as { __holdMic: boolean }).__holdMic = false));
    // only the answer itself counts: «no lo sapevo» is neither a yes nor a no
    await say(page, 'no lo sapevo');
    await speak.click();
    await expect(note).toBeVisible();
    await expect(progress(page)).toHaveText('1 / 3');

    await say(page, 'Lo sapevo!');
    await speak.click();
    await expect(progress(page)).toHaveText('2 / 3');
    await expect(note).toHaveCount(0);
    await reveal(page);
    await say(page, 'non sapevo');
    await speak.click();
    await expect(progress(page)).toHaveText('3 / 3');
    await reveal(page);
    await say(page, 'Non lo sapevo.');
    await speak.click();
    await expect(summary(page)).toHaveText('Ne sapevi 1 su 3. Da rivedere: Estate, Inverno.');
    expect(await micsOpen(page)).toBe(0);
    await bar(page).getByRole('button', { name: 'Ripassa solo questi' }).click();
    await expect(progress(page)).toHaveText('1 / 2');
  });

  test('l’altro modo di ripassare e «Un passo alla volta» non hanno risposte da dare', async ({ page }) => {
    await seasons(page, ['Estate']);
    await toolbar(page, 'Ripassa');
    await page.getByRole('button', { name: /^Un passo alla volta/ }).click();
    await expect(bar(page).getByRole('button', { name: 'Avanti' })).toBeVisible();
    await expect(answers(page)).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Lo sapevo', exact: true })).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Scopri' })).toHaveCount(0);
  });
});
