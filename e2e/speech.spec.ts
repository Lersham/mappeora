import { test, expect, holdMic, micError, micsOpen, say, slowVoice, spoken } from './fixtures';
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
});
