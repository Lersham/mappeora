import { expect, type Locator, type Page } from '@playwright/test';

export type TemplateName = 'Libera' | 'Le 5 W' | 'Causa ed effetto' | 'Linea del tempo' | 'Confronto';

/** Creates a map from the home screen and waits for the editor. */
export async function newMap(page: Page, title: string, template: TemplateName = 'Libera') {
  await page.goto('/');
  await page.getByRole('button', { name: 'Nuova mappa' }).click();
  await page.getByPlaceholder("es. Il ciclo dell'acqua").fill(title);
  await page.locator('.template-pick', { hasText: template }).click();
  await page.getByRole('button', { name: 'Crea' }).click();
  await expect(page.locator('.title-input')).toHaveValue(title);
}

/** Like a person would: if the concept is off screen, look at the whole map. */
export async function onScreen(page: Page, target: Locator): Promise<Locator> {
  const [box, canvas] = [await target.boundingBox(), await page.locator('.react-flow').boundingBox()];
  const inside = (b: typeof box) =>
    !!b && !!canvas && b.x >= canvas.x && b.y >= canvas.y && b.x + b.width <= canvas.x + canvas.width && b.y + b.height <= canvas.y + canvas.height;
  if (!inside(box)) await showAll(page);
  return target;
}

export const node = (page: Page, text: string | RegExp): Locator =>
  page.locator('.concept-node').filter({ has: page.locator('.concept-label', { hasText: text }) });

export const nodes = (page: Page): Locator => page.locator('.concept-node');

/** Adds a concept under `parent` and names it: a new concept opens ready for typing. */
export async function addConcept(page: Page, parent: string, label: string) {
  await (await onScreen(page, node(page, parent))).click();
  await page.getByRole('button', { name: 'Concetto', exact: true }).click();
  const input = page.getByRole('textbox', { name: 'Testo del concetto' });
  await expect(input).toBeFocused();
  await input.fill(label);
  await input.press('Enter');
  await expect(node(page, label)).toBeVisible();
  // The new concept slides into place and the view follows it: wait for both.
  await settled(page);
}

export async function rename(page: Page, from: string, to: string) {
  // A new concept slides into place right after being added: wait for it.
  await settled(page);
  // Human-speed taps: a 3 ms simulated tap ends while the app is still
  // handling the selection made by the first one.
  await (await onScreen(page, node(page, from).last())).dblclick({ delay: 60 });
  const input = page.getByRole('textbox', { name: 'Testo del concetto' });
  await input.fill(to);
  await input.press('Enter');
  await expect(node(page, to)).toBeVisible();
}

/**
 * Taps the n-th link (in the order they were created). The click goes
 * straight to that link's tap area, even where lines run close together.
 */
export async function tapLink(page: Page, index = 0) {
  await page.locator('.react-flow__edge').nth(index).locator('.react-flow__edge-interaction').last().dispatchEvent('click');
}

/** Uses a tool of the editor toolbar; on a phone most of them are under «Altro». */
export async function toolbar(page: Page, name: string) {
  const bar = page.getByRole('navigation', { name: 'Strumenti' });
  const tool = bar.getByRole('button', { name, exact: true });
  if (await tool.isVisible()) return tool.click();
  await bar.getByRole('button', { name: 'Altro', exact: true }).click();
  await page.getByRole('dialog', { name: 'Altro' }).getByRole('button', { name, exact: true }).click();
}

/** On-screen boxes of the visible concepts. */
export function boxes(page: Page) {
  return nodes(page).evaluateAll((els) =>
    els.map((e) => {
      const r = e.getBoundingClientRect();
      return { label: e.querySelector('.concept-label')?.textContent ?? '', x: r.x, y: r.y, w: r.width, h: r.height };
    }),
  );
}

export function overlapping(b: Awaited<ReturnType<typeof boxes>>): string[] {
  const out: string[] = [];
  for (let i = 0; i < b.length; i++)
    for (let j = i + 1; j < b.length; j++) {
      const [p, q] = [b[i], b[j]];
      if (p.x < q.x + q.w - 1 && q.x < p.x + p.w - 1 && p.y < q.y + q.h - 1 && q.y < p.y + p.h - 1) out.push(`${p.label} / ${q.label}`);
    }
  return out;
}

/** Waits until the automatic layout has stopped moving the concepts. */
export async function settled(page: Page) {
  let last = '';
  await expect
    .poll(async () => {
      const now = JSON.stringify(await boxes(page));
      const same = now === last;
      last = now;
      return same;
    }, { intervals: [150, 150, 250, 400] })
    .toBe(true);
}

/** A small "foglio" map: main concept, three branches, two concepts each. */
export async function sampleMap(page: Page, title = 'Il ciclo dell’acqua') {
  await newMap(page, title);
  for (const [branch, items] of [
    ['Evaporazione', ['Calore del sole', 'Vapore']],
    ['Condensazione', ['Nuvole']],
    ['Precipitazione', ['Pioggia', 'Neve']],
  ] as const) {
    await addConcept(page, title, branch);
    for (const item of items) await addConcept(page, branch, item);
  }
  await showAll(page);
}

/**
 * Shows the whole map ("fit view" control). Like a person, a test can only
 * tap what is on screen: the map never scrolls by itself.
 */
export async function showAll(page: Page) {
  await page.locator('.react-flow__controls-fitview').click();
  await settled(page);
}

/**
 * Stands in for Tesseract's worker (downloaded from jsDelivr in the app):
 * every page photographed "reads" as `text`. Speaks the worker's protocol:
 * each job is answered with the same action and job id.
 */
export async function fakeOcr(page: Page, text: string) {
  await fakeOcrWorker(
    page,
    `self.onmessage = ({ data }) => postMessage({
    workerId: data.workerId, jobId: data.jobId, action: data.action, status: 'resolve',
    data: data.action === 'recognize' ? { text: ${JSON.stringify(text)} } : {},
  });`,
  );
}

/** Replaces Tesseract's worker script with `script` (the latest call wins). */
export async function fakeOcrWorker(page: Page, script: string) {
  const worker = /cdn\.jsdelivr\.net\/npm\/tesseract\.js@[^/]+\/dist\/worker\.min\.js/;
  await page.context().unroute(worker);
  await page.context().route(worker, (route) =>
    route.fulfill({ body: script, contentType: 'text/javascript', headers: { 'access-control-allow-origin': '*' } }),
  );
}

/** In «Dal libro»: picks a photo from the gallery and waits for its text. */
export async function photographPage(page: Page) {
  const dialog = page.getByRole('dialog', { name: 'Dal libro' });
  const chooser = page.waitForEvent('filechooser');
  await dialog.getByRole('button', { name: 'Scegli una foto' }).click();
  await (await chooser).setFiles({ name: 'pagina.png', mimeType: 'image/png', buffer: PNG_PAGE });
  await expect(dialog.locator('.ocr-pick')).toBeVisible({ timeout: 20_000 });
  return dialog;
}

const PNG_PAGE = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
  'base64',
);

/**
 * Drags from one word to another, like a highlighter: with a finger on a
 * touch screen (the phone project), with the mouse elsewhere.
 */
export async function highlight(page: Page, from: Locator, to: Locator) {
  const [a, b] = [await from.boundingBox(), await to.boundingBox()];
  if (!a || !b) throw new Error('parola non visibile');
  const start = { x: a.x + a.width / 2, y: a.y + a.height / 2 };
  const end = { x: b.x + b.width / 2, y: b.y + b.height / 2 };
  if (!(await page.evaluate(() => navigator.maxTouchPoints > 0))) {
    await page.mouse.move(start.x, start.y);
    await page.mouse.down();
    await page.mouse.move(end.x, end.y, { steps: 8 });
    await page.mouse.up();
    return;
  }
  const cdp = await page.context().newCDPSession(page);
  const touch = (type: 'touchStart' | 'touchMove' | 'touchEnd', x: number, y: number) =>
    cdp.send('Input.dispatchTouchEvent', { type, touchPoints: type === 'touchEnd' ? [] : [{ x, y }] });
  await touch('touchStart', start.x, start.y);
  for (let i = 1; i <= 8; i++) await touch('touchMove', start.x + ((end.x - start.x) * i) / 8, start.y + ((end.y - start.y) * i) / 8);
  await touch('touchEnd', end.x, end.y);
  await cdp.detach();
}
