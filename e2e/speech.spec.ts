import { test, expect, googleVoice, holdMic, lateVoices, micError, micsOpen, say, slowVoice, spoken, voicesUsed } from './fixtures';
import { newMap, sampleMap, toolbar } from './helpers';

test.describe('Voce', () => {
  test('«Detta» mentre legge la mappa: la lettura si ferma e non finisce nel microfono', async ({ page }) => {
    await sampleMap(page);
    await slowVoice(page, 200);
    await toolbar(page, 'Leggi');
    await expect.poll(() => spoken(page)).toHaveLength(1);
    await holdMic(page);
    await say(page, 'Ghiaccio');
    await toolbar(page, 'Detta');
    const overlay = page.getByRole('dialog').filter({ hasText: 'Ti ascolto' });
    await expect(overlay).toBeVisible();
    await page.waitForTimeout(1500); // several concepts' worth of time
    expect(await spoken(page)).toHaveLength(1);
    await overlay.getByRole('button', { name: 'Fatto' }).click();
    await expect(overlay).toHaveCount(0);
    await expect(page.getByRole('navigation', { name: 'Strumenti' }).getByRole('button', { name: 'Stop' })).toHaveCount(0);
  });

  test('«Prova la voce» durante la lettura si sente tutta, e la mappa non riparte', async ({ page }) => {
    await sampleMap(page);
    await slowVoice(page, 100);
    await toolbar(page, 'Leggi');
    await expect.poll(() => spoken(page)).toHaveLength(1);
    await toolbar(page, 'Aspetto');
    await page.getByRole('dialog', { name: 'Aspetto e voce' }).getByRole('button', { name: 'Prova la voce' }).click();
    const sample = 'La fotosintesi trasforma la luce in energia.';
    await expect.poll(() => spoken(page)).toContain(sample);
    await page.waitForTimeout(2500);
    // On a slow phone the map may get one more concept in before the click.
    expect((await spoken(page)).at(-1)).toBe(sample);
  });

  test('Scaletta: fermare la dettatura con il microfono scrive la riga una volta sola', async ({ page }) => {
    await newMap(page, 'Le stagioni');
    await toolbar(page, 'Scaletta');
    const outline = page.getByRole('dialog', { name: 'Scaletta' });
    await holdMic(page);
    await say(page, 'Primavera');
    await outline.getByRole('button', { name: 'Detta una nuova riga' }).click();
    await expect(outline.locator('.outline-input').nth(1)).toHaveValue('Primavera');
    // The listening button pulses: it never stands still for Playwright.
    await outline.getByRole('button', { name: 'Smetti di ascoltare' }).click({ force: true });
    await expect(outline.getByRole('button', { name: 'Detta una nuova riga' })).toBeVisible();
    await page.waitForTimeout(300);
    await expect(outline.locator('.outline-input')).toHaveCount(2);
  });

  test('chiudere un dialogo mentre ascolta spegne il microfono, e «Detta» poi si ferma con «Fatto»', async ({ page }) => {
    await newMap(page, 'Le stagioni');
    await toolbar(page, 'Scaletta');
    const outline = page.getByRole('dialog', { name: 'Scaletta' });
    await holdMic(page);
    await outline.getByRole('button', { name: 'Detta una nuova riga' }).click();
    await expect(outline.getByRole('button', { name: 'Smetti di ascoltare' })).toBeVisible();
    await outline.getByRole('button', { name: 'Annulla' }).click();
    await expect.poll(() => micsOpen(page)).toBe(0);

    await toolbar(page, 'Detta');
    const overlay = page.getByRole('dialog').filter({ hasText: 'Ti ascolto' });
    await expect(overlay).toBeVisible();
    await overlay.getByRole('button', { name: 'Fatto' }).click();
    await expect(overlay).toHaveCount(0);
  });

  test('senza internet la dettatura lo dice, invece di «Non ho capito»', async ({ page }) => {
    await newMap(page, 'Le stagioni');
    await micError(page, 'network');
    await toolbar(page, 'Detta');
    await expect(page.getByText('Per dettare serve internet')).toBeVisible();
    await page.getByRole('button', { name: 'Ok' }).click();
    await micError(page, 'audio-capture');
    await toolbar(page, 'Detta');
    await expect(page.getByText('Non trovo il microfono')).toBeVisible();
  });

  test('se il microfono non è permesso spiega cosa fare', async ({ page }) => {
    await newMap(page, 'Le stagioni');
    await micError(page, 'not-allowed');
    await toolbar(page, 'Detta');
    await expect(page.getByText('permetti a Mappeora di usare il microfono')).toBeVisible();
  });

  test('se il bambino non dice niente la dettatura si chiude senza rimproveri', async ({ page }) => {
    await newMap(page, 'Le stagioni');
    await micError(page, 'no-speech');
    await toolbar(page, 'Detta');
    await expect.poll(() => micsOpen(page)).toBe(0);
    await expect(page.getByRole('dialog').filter({ hasText: 'Ti ascolto' })).toHaveCount(0);
    await expect(page.getByText('Non ho capito bene')).toHaveCount(0);
  });

  test('le voci che arrivano in ritardo compaiono in «Aspetto» e la mappa si legge con quella scelta', async ({ page }) => {
    await sampleMap(page);
    await lateVoices(page);
    await toolbar(page, 'Aspetto');
    const settings = page.getByRole('dialog', { name: 'Aspetto e voce' });
    await settings.getByRole('combobox', { name: 'Voce', exact: true }).selectOption({ label: 'Italiano (test)' });
    await page.keyboard.press('Escape');
    await expect(settings).toHaveCount(0);
    await toolbar(page, 'Leggi');
    await expect.poll(() => voicesUsed(page)).toEqual(['it-test']);
  });

  test('senza una voce scelta legge con «Google italiano», se c’è', async ({ page }) => {
    await sampleMap(page);
    await googleVoice(page);
    await toolbar(page, 'Aspetto');
    const settings = page.getByRole('dialog', { name: 'Aspetto e voce' });
    await expect(settings.getByRole('combobox', { name: 'Voce', exact: true })).toHaveValue('');
    await expect(settings.getByRole('option', { name: 'Predefinita (Google italiano)' })).toHaveCount(1);
    await page.keyboard.press('Escape');
    await toolbar(page, 'Leggi');
    await expect.poll(async () => (await voicesUsed(page))[0]).toBe('Google italiano');
  });

  test('se «Google italiano» non ha internet, la frase la dice la voce del dispositivo', async ({ page }) => {
    await sampleMap(page);
    await googleVoice(page, { offline: true });
    await toolbar(page, 'Leggi');
    await expect.poll(async () => (await voicesUsed(page)).slice(0, 2)).toEqual(['Google italiano', '']);
    await expect.poll(async () => (await spoken(page)).length).toBeGreaterThan(3);
    const said = await spoken(page);
    expect(said[1]).toBe(said[0]);
  });
});
