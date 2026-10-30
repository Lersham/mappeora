import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import type { Page } from '@playwright/test';
import { test, expect, freshInstall } from '../e2e/fixtures';
import { addConcept, node, onScreen, sampleMap, settled, toolbar } from '../e2e/helpers';

/**
 * Visual pass (npm run test:visual, see playwright.visual.config.ts). Nothing
 * here judges the result: it leaves, in e2e/results/visual/<device>/,
 * - <look>/NN-<screen>.png: every main screen, in every theme and with the
 *   largest text;
 * - <look>/conteggio.md: the anti-slop count of those screens (corner radii,
 *   button colours, gradients, emoji in buttons and titles, fonts);
 * - flusso-<how>/: a whole flow frame by frame (the file name is the time in
 *   ms), at normal speed, with reduced motion and on a CPU four times slower,
 *   plus scatti.json, the frames that took too long.
 */

interface Look {
  name: string;
  settings: Record<string, unknown>;
}

const LOOKS: Look[] = [
  { name: 'bianco', settings: { theme: 'bianco' } },
  { name: 'crema', settings: { theme: 'crema' } },
  { name: 'azzurro', settings: { theme: 'azzurro' } },
  { name: 'scuro', settings: { theme: 'scuro' } },
  { name: 'testo-grande', settings: { theme: 'crema', textScale: 1.8, uppercase: true, wideSpacing: true } },
];

const folder = (...parts: string[]) => {
  const dir = join(test.info().project.outputDir, test.info().project.name, ...parts);
  mkdirSync(dir, { recursive: true });
  return dir;
};

/** What a screen is made of, counted the way the anti-slop pre-flight asks. */
type Census = { radii: Record<string, number>; buttons: Record<string, number>; fonts: Record<string, number>; gradients: string[]; emoji: string[] };

function census(page: Page): Promise<Census> {
  return page.evaluate(() => {
    const out: Census = { radii: {}, buttons: {}, fonts: {}, gradients: [], emoji: [] };
    const add = (bag: Record<string, number>, key: string) => (bag[key] = (bag[key] ?? 0) + 1);
    const name = (el: Element) => `${el.tagName.toLowerCase()}${el.classList[0] ? `.${el.classList[0]}` : ''} «${(el.textContent ?? '').trim().slice(0, 30)}»`;
    for (const el of document.querySelectorAll<HTMLElement>('body *')) {
      const box = el.getBoundingClientRect();
      const s = getComputedStyle(el);
      if (!box.width || !box.height || s.visibility === 'hidden' || Number(s.opacity) === 0) continue;
      if (s.borderTopLeftRadius !== '0px') add(out.radii, s.borderTopLeftRadius);
      if (s.backgroundImage.includes('gradient')) out.gradients.push(name(el));
      if ([...el.childNodes].some((n) => n.nodeType === Node.TEXT_NODE && n.textContent?.trim())) add(out.fonts, s.fontFamily.split(',')[0].replace(/"/g, ''));
      // The colours of the concepts are the child's, not the app's: only the app's own buttons count.
      const isButton = el.matches('button, [role="button"], a');
      if (isButton && !el.closest('.react-flow__node') && s.backgroundColor !== 'rgba(0, 0, 0, 0)') add(out.buttons, s.backgroundColor);
      if (el.matches('button, [role="button"], h1, h2, h3, label, nav *') && /\p{Extended_Pictographic}/u.test(el.textContent ?? '')) out.emoji.push(name(el));
    }
    return out;
  });
}

function report(look: string, screens: [string, Census][]): string {
  const sum = (pick: (c: Census) => Record<string, number>) => {
    const all: Record<string, number> = {};
    for (const [, c] of screens) for (const [k, n] of Object.entries(pick(c))) all[k] = (all[k] ?? 0) + n;
    return Object.entries(all).sort((a, b) => b[1] - a[1]);
  };
  const list = (rows: [string, number][]) => rows.map(([k, n]) => `- \`${k}\` × ${n}`).join('\n') || '- nessuno';
  const radii = sum((c) => c.radii);
  const buttons = sum((c) => c.buttons);
  const fonts = sum((c) => c.fonts);
  const gradients = screens.flatMap(([s, c]) => c.gradients.map((g) => `${s}: ${g}`));
  const emoji = screens.flatMap(([s, c]) => c.emoji.map((e) => `${s}: ${e}`));
  return [
    `# Conteggio anti-slop: ${test.info().project.name}, ${look}`,
    '',
    `Raggi diversi: **${radii.length}** · colori dei pulsanti: **${buttons.length}** · caratteri: **${fonts.length}** · sfumature: **${gradients.length}** · emoji in pulsanti e titoli: **${emoji.length}**`,
    '',
    '## Raggi degli angoli',
    list(radii),
    '',
    '## Sfondi dei pulsanti',
    list(buttons),
    '',
    '## Caratteri',
    list(fonts),
    '',
    '## Sfumature',
    gradients.map((g) => `- ${g}`).join('\n') || '- nessuna',
    '',
    '## Emoji in pulsanti e titoli',
    emoji.map((e) => `- ${e}`).join('\n') || '- nessuna',
    '',
  ].join('\n');
}

for (const look of LOOKS) {
  test(`schermate: ${look.name}`, async ({ page }) => {
    await page.addInitScript((state) => {
      if (!localStorage.getItem('mappeora-settings')) localStorage.setItem('mappeora-settings', JSON.stringify({ state, version: 2 }));
    }, look.settings);
    const dir = folder(look.name);
    const screens: [string, Census][] = [];
    const shot = async (screen: string) => {
      await page.evaluate(() => document.fonts.ready);
      await page.screenshot({ path: join(dir, `${screen}.png`), animations: 'disabled' });
      screens.push([screen, await census(page)]);
    };

    await freshInstall(page);
    await expect(page.getByRole('dialog', { name: 'Come funziona' })).toBeVisible();
    await shot('01-benvenuto');
    await page.evaluate(() => sessionStorage.removeItem('e2e-fresh'));

    await page.goto('/');
    await expect(page.getByRole('heading', { name: 'Le mie mappe' })).toBeVisible();
    await shot('02-mappe-vuoto');
    await page.getByRole('button', { name: 'Nuova mappa' }).click();
    await shot('03-nuova-mappa');

    await sampleMap(page);
    await shot('04-editor');
    await (await onScreen(page, node(page, 'Evaporazione'))).click();
    await shot('05-concetto-scelto');

    await toolbar(page, 'Salva e manda');
    await expect(page.getByRole('dialog', { name: 'Salva e manda' })).toBeVisible();
    await shot('06-salva-e-manda');
    await page.goBack();
    await expect(page.getByRole('dialog', { name: 'Salva e manda' })).toBeHidden();

    await toolbar(page, 'Aspetto');
    const settings = page.getByRole('dialog', { name: 'Aspetto e voce' });
    await expect(settings).toBeVisible();
    await shot('07-aspetto');
    await settings.getByRole('button', { name: 'Chiudi' }).click();

    await page.getByRole('button', { name: 'Mappe' }).click();
    await expect(page.locator('.map-title')).toHaveCount(1);
    await shot('08-mappe');

    writeFileSync(join(dir, 'conteggio.md'), report(look.name, screens));
  });
}

/**
 * Records the page frame by frame (Chrome's screencast, which sends a frame
 * only when something changed) until the returned function is called.
 */
async function filmstrip(page: Page, dir: string) {
  const cdp = await page.context().newCDPSession(page);
  let count = 0;
  let start = 0;
  cdp.on('Page.screencastFrame', ({ data, metadata, sessionId }) => {
    const at = metadata.timestamp ?? 0;
    start ||= at;
    writeFileSync(join(dir, `${String(++count).padStart(4, '0')}-${Math.round((at - start) * 1000)}ms.jpg`), Buffer.from(data, 'base64'));
    cdp.send('Page.screencastFrameAck', { sessionId }).catch(() => {});
  });
  await cdp.send('Page.startScreencast', { format: 'jpeg', quality: 80, maxWidth: 900, maxHeight: 1200, everyNthFrame: 1 });
  return { cdp, stop: () => cdp.send('Page.stopScreencast') };
}

const FLOWS = ['normale', 'movimento-ridotto', 'cpu-lenta'] as const;

for (const how of FLOWS) {
  test(`flusso: ${how}`, async ({ page }) => {
    // Every frame the browser draws, with how long it took (16.7 ms is 60 fps).
    await page.addInitScript(() => {
      const frames: number[] = [];
      Object.assign(window, { __frames: frames });
      let last = 0;
      const tick = (t: number) => {
        if (last) frames.push(t - last);
        last = t;
        requestAnimationFrame(tick);
      };
      requestAnimationFrame(tick);
    });
    if (how === 'movimento-ridotto') await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.goto('/');
    await expect(page.getByRole('heading', { name: 'Le mie mappe' })).toBeVisible();

    const dir = folder(`flusso-${how}`);
    const { cdp, stop } = await filmstrip(page, dir);
    if (how === 'cpu-lenta') await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 });
    await page.evaluate(() => ((window as unknown as { __frames: number[] }).__frames.length = 0));

    await page.getByRole('button', { name: 'Nuova mappa' }).click();
    await page.getByPlaceholder("es. Il ciclo dell'acqua").fill('Il ciclo dell’acqua');
    await page.locator('.template-pick', { hasText: 'Libera' }).click();
    await page.getByRole('button', { name: 'Crea' }).click();
    await expect(page.locator('.title-input')).toHaveValue('Il ciclo dell’acqua');
    for (const branch of ['Evaporazione', 'Condensazione', 'Precipitazione']) await addConcept(page, 'Il ciclo dell’acqua', branch);
    await addConcept(page, 'Evaporazione', 'Vapore');
    await toolbar(page, 'Riordina');
    await settled(page);
    await toolbar(page, 'Aspetto');
    await page.getByRole('dialog', { name: 'Aspetto e voce' }).getByRole('button', { name: 'Chiudi' }).click();
    await page.getByRole('button', { name: 'Mappe' }).click();
    await page.locator('.map-open', { hasText: 'Il ciclo dell’acqua' }).click();
    await settled(page);

    const frames = await page.evaluate(() => (window as unknown as { __frames: number[] }).__frames);
    await stop();
    await cdp.detach();
    const slow = frames.filter((ms) => ms > 34).map((ms) => Math.round(ms));
    writeFileSync(
      join(dir, 'scatti.json'),
      JSON.stringify({ fotogrammi: frames.length, sopra34ms: slow.length, sopra50ms: slow.filter((ms) => ms > 50).length, peggiore: Math.max(0, ...slow), lenti: slow }, null, 2),
    );
  });
}
