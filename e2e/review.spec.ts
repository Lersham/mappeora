import { test, expect, say, slowVoice, spoken } from './fixtures';
import { addConcept, newMap, node, nodes, sampleMap, settled, tapLink, toolbar } from './helpers';

test.describe('Lettura, ripasso e voce', () => {
  test('«Leggi» legge la mappa ramo per ramo, dall’alto in basso, con le parole di collegamento', async ({ page }) => {
    await newMap(page, 'L’acqua');
    await addConcept(page, 'L’acqua', 'Idrogeno');
    await addConcept(page, 'L’acqua', 'Ossigeno');
    await addConcept(page, 'Idrogeno', 'Atomo');
    await tapLink(page, 0); // L’acqua → Idrogeno
    await page.getByRole('button', { name: 'è formato da' }).click();
    await settled(page);
    await slowVoice(page);
    await toolbar(page, 'Leggi');
    // the word being read is highlighted
    await expect(page.locator('.spoken-word').first()).toBeVisible();
    await expect.poll(() => spoken(page), { timeout: 15_000 }).toEqual(['L’acqua', 'è formato da: Idrogeno', 'Atomo', 'Ossigeno']);
  });

  test('ripasso «Un passo alla volta»: i concetti compaiono uno per volta', async ({ page }) => {
    await sampleMap(page);
    await toolbar(page, 'Ripassa');
    await page.getByRole('button', { name: /^Un passo alla volta/ }).click();
    await expect(nodes(page)).toHaveCount(1);
    await page.getByRole('button', { name: 'Avanti' }).click();
    await expect(nodes(page)).toHaveCount(2);
    await page.getByRole('button', { name: 'Esci' }).click();
    await expect(nodes(page)).toHaveCount(9);
  });

  test('ripasso «Indovina»: il concetto è nascosto finché non si preme «Scopri»', async ({ page }) => {
    await sampleMap(page);
    await toolbar(page, 'Ripassa');
    await page.getByRole('button', { name: /^Indovina/ }).click();
    await expect(page.locator('.concept-mystery')).toBeVisible();
    // its words are nowhere, not even for a screen reader
    await expect(node(page, 'Il ciclo dell’acqua')).toHaveCount(0);
    await expect(page.getByRole('group', { name: 'Concetto nascosto' })).toHaveCount(1);
    await expect(page.getByRole('group', { name: /Il ciclo dell’acqua/ })).toHaveCount(0);
    await page.getByRole('button', { name: 'Scopri' }).click();
    await expect(page.locator('.concept-mystery')).toHaveCount(0);
    await expect(node(page, 'Il ciclo dell’acqua')).toBeVisible();
    await expect.poll(() => spoken(page)).toContain('Il ciclo dell’acqua');
  });

  test('ogni modo di ripassare si può ascoltare prima di sceglierlo', async ({ page }) => {
    await newMap(page, 'Le stagioni');
    await toolbar(page, 'Ripassa');
    await page.getByRole('button', { name: 'Leggi: Interrogazione' }).click();
    await expect
      .poll(() => spoken(page))
      .toEqual(['Interrogazione. Tutta la mappa davanti a te, a schermo intero: spiega un concetto alla volta e vai avanti con le frecce.']);
  });

  test('Interrogazione: tutta la mappa, un concetto alla volta, frecce e tocco', async ({ page }) => {
    await sampleMap(page);
    await toolbar(page, 'Ripassa');
    await page.getByRole('button', { name: /^Interrogazione/ }).click();
    const caption = page.locator('.present-caption');
    await expect(caption).toHaveText('Il ciclo dell’acqua');
    await expect(nodes(page)).toHaveCount(9);
    await expect(page.locator('.concept-node.review-dim')).toHaveCount(8);
    await page.keyboard.press('ArrowRight');
    await expect(caption).toHaveText('Evaporazione');
    await page.keyboard.press('PageDown');
    await expect(caption).toHaveText('Calore del sole');
    await page.keyboard.press('ArrowLeft');
    await expect(caption).toHaveText('Evaporazione');
    // the view follows the current concept: show the whole map, then tap one
    await page.getByRole('button', { name: 'Tutta', exact: true }).click();
    await settled(page);
    await node(page, 'Neve').click();
    await expect(caption).toHaveText('Neve');
    // the child speaks: nothing is read unless asked
    expect(await spoken(page)).toEqual([]);
    await page.getByRole('navigation', { name: 'Interrogazione' }).getByRole('button', { name: 'Leggi' }).click();
    await expect.poll(() => spoken(page)).toEqual(['Neve']);
    await page.keyboard.press('Escape');
    await expect(page.locator('.review-dim')).toHaveCount(0);
  });

  test('dettatura: «nuovo concetto …» aggiunge un concetto, «annulla» lo toglie', async ({ page }) => {
    await newMap(page, 'Le piante');
    await say(page, 'nuovo concetto fotosintesi');
    await toolbar(page, 'Detta');
    await expect(node(page, 'Fotosintesi')).toBeVisible();
    await say(page, 'annulla');
    await toolbar(page, 'Detta');
    await expect(node(page, 'Fotosintesi')).toHaveCount(0);
  });
});
