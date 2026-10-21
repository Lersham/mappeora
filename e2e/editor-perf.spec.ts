import { test, expect, slowVoice, spoken, PNG_1PX } from './fixtures';
import { node, nodes, onScreen, settled, toolbar } from './helpers';
import type { Page } from '@playwright/test';

/**
 * Big maps (issue #21): a change in one concept must not draw again every
 * line and every concept. React does not say what it drew, so the page is told
 * to count, from the hook React offers to its DevTools: how many times an edge
 * or a concept component ran in each step.
 */
const COUNT_RENDERS = () => {
  type Fiber = { tag: number; flags: number; child: Fiber | null; sibling: Fiber | null; alternate: Fiber | null; memoizedProps: Record<string, unknown> | null };
  const counts = { edge: 0, concept: 0 };
  Object.assign(window, { __renders: counts });
  // Function components (0, 15 for a memo of one) that ran in this commit; only fibers
  // that were cloned for it are visited, as the DevTools do (the others keep old flags).
  const visit = (next: Fiber, prev: Fiber) => {
    if ((next.tag === 0 || next.tag === 15) && next.flags & 1) {
      const p = next.memoizedProps;
      if (p && 'sourceX' in p && 'targetPosition' in p) counts.edge++;
      else if (p && 'positionAbsoluteX' in p && 'dragging' in p) counts.concept++;
    }
    if (next.child !== prev.child) for (let c = next.child; c; c = c.sibling) if (c.alternate) visit(c, c.alternate);
  };
  Object.assign(window, {
    __REACT_DEVTOOLS_GLOBAL_HOOK__: {
      supportsFiber: true,
      isDisabled: false,
      renderers: new Map(),
      inject: () => 1,
      checkDCE() {},
      onCommitFiberUnmount() {},
      onPostCommitFiberRoot() {},
      onCommitFiberRoot(_id: number, root: { current: Fiber }) {
        if (root.current.alternate) visit(root.current, root.current.alternate);
      },
    },
  });
};

const N = 40;

/** A map of N concepts, each with up to four under it, as a ".mappami" file. */
function bigMap(template: 'libera' | 'causa-effetto') {
  const nodes = [{ id: 'n0', label: 'Radice', position: { x: 0, y: 0 } }];
  const edges = [];
  for (let i = 1; i < N; i++) {
    nodes.push({ id: `n${i}`, label: `Concetto ${i}`, position: { x: (i % 8) * 230, y: Math.floor(i / 8) * 150 + 150 } });
    edges.push({ id: `e${i}`, source: `n${Math.floor((i - 1) / 4)}`, target: `n${i}`, ...(i % 5 === 0 && { label: 'causa' }) });
  }
  return JSON.stringify({ format: 'mappeora', version: 1, map: { id: 'grande', title: 'Una mappa grande', createdAt: 1, updatedAt: 2, template, nodes, edges } });
}
/** «Concetto 2» has one line up to the root and four down: n9 to n12. */
const LINES_OF_CONCEPT_2 = 5;

async function openBig(page: Page, template: 'libera' | 'causa-effetto') {
  await page.goto('/');
  const chooser = page.waitForEvent('filechooser');
  await page.getByRole('button', { name: 'Apri file' }).click();
  await (await chooser).setFiles({ name: 'grande.mappami', mimeType: 'application/json', buffer: Buffer.from(bigMap(template)) });
  await expect(nodes(page)).toHaveCount(N);
  await expect(page.locator('.react-flow__edge')).toHaveCount(N - 1);
  await settled(page);
}

const renders = (page: Page) => page.evaluate(() => ({ ...(window as unknown as { __renders: { edge: number; concept: number } }).__renders }));
const resetRenders = (page: Page) =>
  page.evaluate(() => Object.assign((window as unknown as { __renders: object }).__renders, { edge: 0, concept: 0 }));
/** Lets React and React Flow finish what a change sets going. */
const quiet = (page: Page) => page.waitForTimeout(500);

test.describe('Mappe grandi', () => {
  test.beforeEach(async ({ context }) => {
    await context.addInitScript(COUNT_RENDERS);
  });

  test('scegliendo un concetto si ridisegnano solo le sue linee', async ({ page }) => {
    await openBig(page, 'libera');
    const target = await onScreen(page, node(page, /^Concetto 2$/));
    await resetRenders(page);
    await target.click();
    await expect(target).toHaveClass(/is-selected/);
    await quiet(page);
    const after = await renders(page);
    // The «+» of its lines stands out (and fades again when another is chosen): not the 39 lines.
    expect(after.edge).toBeGreaterThan(0);
    expect(after.edge).toBeLessThanOrEqual(LINES_OF_CONCEPT_2 * 2);
    expect(after.concept).toBeLessThanOrEqual(4);
  });

  test('scrivere il titolo non ridisegna né linee né concetti', async ({ page }) => {
    await openBig(page, 'libera');
    await resetRenders(page);
    const title = page.locator('.title-input');
    await title.click();
    await title.press('End');
    await page.keyboard.type('abcde', { delay: 30 });
    await expect(title).toHaveValue('Una mappa grandeabcde');
    await quiet(page);
    expect(await renders(page)).toEqual({ edge: 0, concept: 0 });
  });

  test('la lettura ad alta voce non ridisegna tutti i concetti, e la parola evidenziata non li allarga', async ({ page }) => {
    await openBig(page, 'libera');
    await slowVoice(page, 1500);
    await resetRenders(page);
    await toolbar(page, 'Leggi');
    await expect.poll(() => spoken(page)).toHaveLength(1);
    const reading = page.locator('.concept-node.is-reading');
    await expect(reading).toHaveCount(1);
    const read = (await reading.elementHandle())!;
    // The word lit up has some padding: it must not make the concept wider (that moves the whole sheet).
    await expect(reading.locator('mark.spoken-word')).toBeVisible();
    const widthWhileLit = (await read.boundingBox())!.width;
    await toolbar(page, 'Stop');
    await expect(page.locator('.concept-node.is-reading')).toHaveCount(0);
    expect(await read.$('mark.spoken-word')).toBeNull();
    expect((await read.boundingBox())!.width).toBeCloseTo(widthWhileLit, 0);
    await quiet(page);
    const after = await renders(page);
    // The concept that was read: not the 40. And no line had a reason to move.
    expect(after.concept).toBeLessThanOrEqual(8);
    expect(after.edge).toBeLessThanOrEqual(N / 4);
  });

  test('un solo ascoltatore dei font per tutte le linee curve, tolto quando si esce dalla mappa', async ({ page }) => {
    await page.addInitScript(() => {
      const w = window as unknown as { __fontListeners: number };
      w.__fontListeners = 0;
      // On the object itself: Chrome has no global FontFaceSet to patch.
      const fonts = document.fonts;
      const [add, remove] = [fonts.addEventListener.bind(fonts), fonts.removeEventListener.bind(fonts)];
      type Args = [string, EventListenerOrEventListenerObject, (boolean | AddEventListenerOptions)?];
      fonts.addEventListener = ((...args: Args) => {
        if (args[0] === 'loadingdone') w.__fontListeners++;
        return add(...args);
      }) as typeof add;
      fonts.removeEventListener = ((...args: Args) => {
        if (args[0] === 'loadingdone') w.__fontListeners--;
        return remove(...args);
      }) as typeof remove;
    });
    const listeners = () => page.evaluate(() => (window as unknown as { __fontListeners: number }).__fontListeners);
    await openBig(page, 'causa-effetto');
    expect(await listeners()).toBe(1);
    await page.getByRole('button', { name: 'Mappe' }).click();
    await expect(page.getByRole('button', { name: 'Nuova mappa' })).toBeVisible();
    expect(await listeners()).toBe(0);
  });

  test('trascinando un concetto si ridisegnano solo le sue linee', async ({ page, isMobile }) => {
    test.skip(isMobile, 'il trascinamento con il mouse si prova sul computer');
    await openBig(page, 'causa-effetto');
    const box = (await (await onScreen(page, node(page, /^Concetto 2$/))).boundingBox())!;
    const [x, y] = [box.x + box.width / 2, box.y + box.height / 2];
    await page.mouse.move(x, y);
    await page.mouse.down();
    await page.mouse.move(x + 20, y + 4, { steps: 3 }); // past the drag threshold
    await resetRenders(page);
    const steps = 10;
    await page.mouse.move(x + 20, y + 4 + 50, { steps });
    await page.mouse.up();
    await quiet(page);
    const after = await renders(page);
    // Each frame draws the lines of that concept (a few times at most), never all 39.
    expect(after.edge).toBeGreaterThan(0);
    expect(after.edge).toBeLessThanOrEqual(steps * LINES_OF_CONCEPT_2 * 3);
  });
});

test.describe('Illustrazioni più leggere', () => {
  test('un’illustrazione di 256 px si salva a 224 px in WebP, con la trasparenza, e resta nitida', async ({ page, context, browserName }) => {
    test.skip(browserName === 'webkit', 'Safari non scrive WebP: salva un PNG a 224 px (provato dai test unitari)');
    // The real thing: a 256 px picture with a transparent corner, as Fluent Emoji are.
    const png = await page.evaluate(async () => {
      const c = document.createElement('canvas');
      c.width = c.height = 256;
      const g = c.getContext('2d')!;
      const grad = g.createRadialGradient(128, 128, 10, 128, 128, 120);
      grad.addColorStop(0, '#ff7a00');
      grad.addColorStop(1, '#a31515');
      g.fillStyle = grad;
      g.beginPath();
      g.arc(128, 128, 120, 0, Math.PI * 2);
      g.fill();
      return c.toDataURL('image/png').split(',')[1];
    });
    await context.route(/cdn\.jsdelivr\.net\/gh\/microsoft.*\.png$/, (route) =>
      route.fulfill({ body: Buffer.from(png, 'base64'), contentType: 'image/png', headers: { 'access-control-allow-origin': '*' } }),
    );
    await page.goto('/');
    await page.getByRole('button', { name: 'Nuova mappa' }).click();
    await page.getByPlaceholder("es. Il ciclo dell'acqua").fill('Il vulcano');
    await page.getByRole('button', { name: 'Crea' }).click();
    await node(page, 'Il vulcano').click();
    await toolbar(page, 'Immagine');
    await page.getByRole('searchbox', { name: 'Cerca un\'immagine' }).fill('Vesuvio');
    await page.locator('.illustration-tile[aria-label="vulcano"]').click();
    const picture = node(page, 'Il vulcano').locator('.concept-illustration');
    await expect(picture).toHaveAttribute('src', /^data:image\/webp;base64,/);
    const saved = await picture.evaluate(async (img: HTMLImageElement) => {
      await img.decode();
      const c = document.createElement('canvas');
      c.width = img.naturalWidth;
      c.height = img.naturalHeight;
      const g = c.getContext('2d')!;
      g.drawImage(img, 0, 0);
      return {
        width: img.naturalWidth,
        height: img.naturalHeight,
        shownAt: parseFloat(getComputedStyle(img).width),
        corner: g.getImageData(1, 1, 1, 1).data[3],
        centre: g.getImageData(c.width / 2, c.height / 2, 1, 1).data[3],
        bytes: (img.getAttribute('src') ?? '').length * 0.75,
      };
    });
    expect([saved.width, saved.height]).toEqual([224, 224]);
    // Sharp on a phone with three pixels per CSS pixel (and in an export at pixelRatio 2).
    expect(saved.width).toBeGreaterThanOrEqual(saved.shownAt * 3);
    expect(saved.corner).toBe(0);
    expect(saved.centre).toBe(255);
    expect(saved.bytes).toBeLessThan((png.length * 0.75) / 2);
  });

  test('un’illustrazione già piccola si salva com’è', async ({ page }) => {
    // The 1 px picture the other tests get is not larger than 224 px.
    await page.goto('/');
    await page.getByRole('button', { name: 'Nuova mappa' }).click();
    await page.getByPlaceholder("es. Il ciclo dell'acqua").fill('Il vulcano');
    await page.getByRole('button', { name: 'Crea' }).click();
    await node(page, 'Il vulcano').click();
    await toolbar(page, 'Immagine');
    await page.getByRole('searchbox', { name: 'Cerca un\'immagine' }).fill('Vesuvio');
    await page.locator('.illustration-tile[aria-label="vulcano"]').click();
    await expect(node(page, 'Il vulcano').locator('.concept-illustration')).toHaveAttribute('src', `data:image/png;base64,${PNG_1PX.toString('base64')}`);
  });
});
