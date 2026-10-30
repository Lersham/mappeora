import type { Node } from '@xyflow/react';
import { Directory, Filesystem } from '@capacitor/filesystem';
import { Share } from '@capacitor/share';
import { isNative } from './platform';
import { MAP_FILE_EXTENSION, serializeMap, textToDataUrl } from '../lib/mapFile';
import { planPages, type Cut, type PageCount, type Paper, type PlacedTile, type Tile } from '../lib/pagePlan';
import type { ConceptMap } from '../types/map';

/** 1×1 transparent PNG. */
const EMPTY_PNG = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=';

/** Required by the licence of the ARASAAC symbols that older maps may still contain. */
const ARASAAC_CREDIT =
  'Pittogrammi: Sergio Palao. Origine: ARASAAC (https://arasaac.org). Licenza: CC BY-NC-SA. Proprietà: Governo di Aragona (Spagna).';

/** Margin around the map in the image, in CSS px (a fixed amount: a
 * percentage would leave huge empty bands around a long map). */
const PADDING = 32;
/** In a PDF the sheet has its own margin: only room for the concepts' borders. */
const PDF_PADDING = 8;

export type ExportFormat = 'png' | 'pdf';

export interface ExportOptions {
  format: ExportFormat;
  paper: Paper;
  /** Splitting a big map over more sheets keeps its text readable. */
  pages: PageCount;
  /** Web only: open the print dialog instead of downloading. */
  print?: boolean;
  /**
   * "Versione per la verifica": no colours, no decorations — a clean
   * compensatory tool to bring to a test.
   */
  simple: boolean;
  title: string;
  /** Adds the ARASAAC credit, required by the pictograms' licence. */
  usesPictograms: boolean;
  /** True once «Annulla» was pressed: the file is then never handed over. */
  cancelled?: () => boolean;
}

interface RenderedMap {
  dataUrl: string;
  width: number;
  height: number;
  /** Heights (CSS px of the image) where a page cut won't split a concept. */
  breaks: number[];
  /** Concepts and linking words, in CSS px of the image: cuts between sheets go round them. */
  boxes: Tile[];
}

/**
 * Safe places to cut the image: just below a concept, in the empty space
 * before the next one (linking words sit near the next concept's top).
 */
export function safeBreaks(spans: { top: number; bottom: number }[]): number[] {
  const sorted = [...spans].sort((a, b) => a.top - b.top);
  const breaks: number[] = [];
  let bottom = -Infinity;
  for (const s of sorted) {
    if (s.top > bottom && Number.isFinite(bottom)) breaks.push(bottom + Math.min(8, (s.top - bottom) / 2));
    bottom = Math.max(bottom, s.bottom);
  }
  return breaks;
}

/** Interactive bits that must never end up on paper. */
function keepInExport(node: HTMLElement): boolean {
  const cls = node.classList;
  return !cls || !['concept-speak', 'concept-toggle', 'link-add', 'react-flow__handle'].some((c) => cls.contains(c));
}

type Rect = { x: number; y: number; width: number; height: number };

function union(a: Rect, b: Rect): Rect {
  const x = Math.min(a.x, b.x);
  const y = Math.min(a.y, b.y);
  return { x, y, width: Math.max(a.x + a.width, b.x + b.width) - x, height: Math.max(a.y + a.height, b.y + b.height) - y };
}

/** Linking words, in map coordinates: long ones can stick out past the concepts. */
function labelRects(flow: HTMLElement, viewport: HTMLElement): Rect[] {
  const m = new DOMMatrixReadOnly(getComputedStyle(viewport).transform);
  if (!m.a || !m.d) return [];
  const origin = flow.getBoundingClientRect();
  return [...flow.querySelectorAll('.react-flow__edge-textwrapper, .ladder-label')]
    .map((label) => label.getBoundingClientRect())
    .filter((r) => r.width > 0 && r.height > 0)
    .map((r) => ({
      x: (r.left - origin.left - m.e) / m.a,
      y: (r.top - origin.top - m.f) / m.d,
      width: r.width / m.a,
      height: r.height / m.d,
    }));
}

let rendering: Promise<unknown> = Promise.resolve();

/**
 * Renders the whole map (not just the visible area) to a PNG, on white paper
 * whatever the background chosen for the screen. One at a time: a cancelled
 * export finishing late must not take the export classes off the next one
 * while it is being copied.
 */
function renderMap(nodes: Node[], simple: boolean, padding: number): Promise<RenderedMap> {
  const run = rendering.then(() => renderOnce(nodes, simple, padding));
  rendering = run.catch(() => {});
  return run;
}

async function renderOnce(nodes: Node[], simple: boolean, padding: number): Promise<RenderedMap> {
  const flow = document.querySelector<HTMLElement>('.react-flow');
  const el = flow?.querySelector<HTMLElement>('.react-flow__viewport');
  if (!flow || !el) throw new Error('viewport-not-found');
  // Loaded here, not at the top: backup.ts imports this file, and the list of maps must not wait for them.
  const [{ toPng }, { getNodesBounds }] = await Promise.all([import('html-to-image'), import('@xyflow/react')]);
  await document.fonts?.ready; // the reading font, not a stand-in
  const shown = nodes.filter((n) => !n.hidden);
  const labels = labelRects(flow, el);
  const bounds = labels.reduce(union, getNodesBounds(shown));
  // Small minimums only: a narrow "scaletta" must stay narrow to fill a
  // portrait sheet instead of floating in a wide empty image.
  const width = Math.max(320, Math.ceil(bounds.width + padding * 2));
  const height = Math.max(240, Math.ceil(bounds.height + padding * 2));
  // Real size (zoom 1), centred: the PDF scales it to the sheet.
  const viewport = {
    zoom: 1,
    x: (width - bounds.width) / 2 - bounds.x,
    y: (height - bounds.height) / 2 - bounds.y,
  };
  flow.classList.toggle('export-simple', simple);
  flow.classList.add('exporting', 'export-paper');
  try {
    const dataUrl = await toPng(el, {
      backgroundColor: '#ffffff',
      width,
      height,
      pixelRatio: 2,
      // A web picture that cannot load (offline) must not stop the export.
      imagePlaceholder: EMPTY_PNG,
      filter: keepInExport,
      style: {
        width: `${width}px`,
        height: `${height}px`,
        transform: `translate(${viewport.x}px, ${viewport.y}px) scale(${viewport.zoom})`,
      },
    });
    const breaks = safeBreaks(
      shown.map((n) => ({
        top: n.position.y * viewport.zoom + viewport.y,
        bottom: (n.position.y + (n.measured?.height ?? 0)) * viewport.zoom + viewport.y,
      })),
    );
    const boxes = [
      ...shown.map((n) => ({ x: n.position.x, y: n.position.y, width: n.measured?.width ?? 0, height: n.measured?.height ?? 0 })),
      ...labels,
    ].map((r) => ({ x: r.x + viewport.x, y: r.y + viewport.y, w: r.width, h: r.height }));
    return { dataUrl, width, height, breaks, boxes };
  } finally {
    flow.classList.remove('export-simple', 'exporting', 'export-paper');
  }
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('image-load'));
    img.src = src;
  });
}

/** The side of `cut` that keeps the piece, out to `far` (past the map's edge), in CSS px. */
function within(cut: Cut, vertical: boolean, far: number): Path2D {
  const path = new Path2D();
  const point = (along: number, at: number) => (vertical ? path.lineTo(at, along) : path.lineTo(along, at));
  point(cut[0].from, far);
  for (const s of cut) {
    point(s.from, s.at);
    point(s.to, s.at);
  }
  point(cut[cut.length - 1].to, far);
  path.closePath();
  return path;
}

/**
 * Cuts one tile (in CSS px of the rendered map) out of the full image. With
 * `line` (its width, in CSS px), it is outlined in grey: where it meets
 * the next sheet, the line steps round the concepts, and is where to cut.
 */
function crop(img: HTMLImageElement, cssWidth: number, cssHeight: number, tile: PlacedTile, line = 0): string {
  const ratio = img.naturalWidth / cssWidth; // pixelRatio used by renderMap
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(tile.w * ratio);
  canvas.height = Math.round(tile.h * ratio);
  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = '#ffffff'; // what belongs to the neighbours: blank paper
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.setTransform(ratio, 0, 0, ratio, -tile.x * ratio, -tile.y * ratio); // map coordinates
  const { left, right, top, bottom } = tile.cuts ?? {};
  const outline = [
    left && within(left, true, cssWidth + 1),
    right && within(right, true, -1),
    top && within(top, false, cssHeight + 1),
    bottom && within(bottom, false, -1),
  ].filter((p): p is Path2D => !!p);
  const frame = new Path2D();
  frame.rect(tile.x, tile.y, tile.w, tile.h);
  outline.push(frame);
  // The piece: inside every cut at once.
  for (const p of outline) ctx.clip(p);
  ctx.drawImage(img, 0, 0, cssWidth, cssHeight);
  if (line) {
    // Only the half of the stroke inside the piece shows: twice as wide.
    ctx.strokeStyle = '#888888';
    ctx.lineWidth = line * 2;
    for (const p of outline) ctx.stroke(p);
  }
  // JPEG: a long map as PNG would make a PDF of tens of megabytes.
  return canvas.toDataURL('image/jpeg', 0.88);
}

/**
 * The PDF's built-in font only knows Western European letters: anything
 * else (emoji, arrows, typographic quotes) would print as garbage.
 */
export function pdfText(text: string): string {
  return text
    .replace(/[‘’‚′]/g, "'")
    .replace(/[“”„″]/g, '"')
    .replace(/[–—−]/g, '-')
    .replace(/…/g, '...')
    .replace(/→/g, '->')
    .replace(/←/g, '<-')
    .replace(/€/g, 'EUR')
    .replace(/[^\u0000-\u00ff]/gu, '')
    .replace(/\s+/g, ' ')
    .trim();
}

type Pdf = InstanceType<typeof import('jspdf').jsPDF>;

interface TextStyle {
  weight: number;
  /** In pt. */
  size: number;
  /** Between baselines, in mm. */
  gap: number;
}
const PAGE: TextStyle = { weight: 400, size: 9, gap: 0 };

/** Text drawn as a picture is sharp on paper at this density (about 300 dpi). */
const PX_PER_MM = 12;
const MM_PER_PT = 25.4 / 72;

interface Lettering {
  /** Width of the text, in mm. */
  width(text: string, weight: number, size: number): number;
  /** Distance between lines of running text, in mm, as on screen («righe più distanziate»). */
  line(size: number): number;
  /** Lines `gap` mm apart as a picture `w`×`h` mm, the first baseline `ascent` mm from its top. */
  draw(lines: string[], weight: number, size: number, gap: number): { dataUrl: string; w: number; h: number; ascent: number };
}

/**
 * jsPDF only has its own fonts: the words (the sheet's number) are drawn
 * as pictures in the child's reading font, spacing and capitals, like the map.
 */
async function lettering(texts: string[]): Promise<Lettering> {
  const root = document.documentElement;
  const css = getComputedStyle(root);
  const family = css.getPropertyValue('--font-body').trim() || 'sans-serif';
  const em = (name: string) => parseFloat(css.getPropertyValue(name)) || 0; // "normal" → 0
  const letters = em('--letter-spacing');
  const words = em('--word-spacing');
  const lineHeight = em('--line-height') || 1.4;
  const cased = (text: string) => (root.dataset.uppercase === 'true' ? text.toLocaleUpperCase('it-IT') : text);
  const ctx = document.createElement('canvas').getContext('2d')!;
  const style = (weight: number, size: number) => {
    const px = size * MM_PER_PT * PX_PER_MM;
    ctx.font = `${weight} ${px}px ${family}`;
    ctx.letterSpacing = `${letters * px}px`;
    ctx.wordSpacing = `${words * px}px`;
    return px;
  };
  // A font that cannot load must not stop the PDF: the canvas then uses a stand-in.
  await document.fonts?.load(`400 16px ${family}`, cased(texts.join(' '))).catch(() => []);

  return {
    width(text, weight, size) {
      style(weight, size);
      return ctx.measureText(cased(text)).width / PX_PER_MM;
    },
    line: (size) => size * MM_PER_PT * lineHeight,
    draw(lines, weight, size, gap) {
      const text = lines.map(cased);
      const px = style(weight, size);
      const { fontBoundingBoxAscent: up = px, fontBoundingBoxDescent: down = px / 3 } = ctx.measureText(text[0]);
      ctx.canvas.width = Math.max(1, Math.ceil(Math.max(...text.map((t) => ctx.measureText(t).width))));
      ctx.canvas.height = Math.ceil(up + down + gap * PX_PER_MM * (text.length - 1));
      style(weight, size); // resizing the canvas resets it
      text.forEach((t, i) => ctx.fillText(t, 0, up + i * gap * PX_PER_MM));
      return { dataUrl: ctx.canvas.toDataURL('image/png'), w: ctx.canvas.width / PX_PER_MM, h: ctx.canvas.height / PX_PER_MM, ascent: up / PX_PER_MM };
    },
  };
}

/**
 * Lines in the reading font (a picture), the first baseline at `baseline`.
 * The same words go underneath as invisible text: the PDF can still be
 * searched, and read aloud by a PDF reader.
 */
function put(doc: Pdf, write: Lettering, lines: string[], s: TextStyle, x: number, baseline: number, align: 'left' | 'right' = 'left') {
  const art = write.draw(lines, s.weight, s.size, s.gap);
  doc.addImage(art.dataUrl, 'PNG', align === 'right' ? x - art.w : x, baseline - art.ascent, art.w, art.h);
  doc.setFont('helvetica', s.weight >= 600 ? 'bold' : 'normal');
  doc.setFontSize(s.size);
  lines.forEach((line, i) => doc.text(pdfText(line), x, baseline + i * s.gap, { renderingMode: 'invisible', align }));
}

/**
 * The map alone fills the sheet: no title (the map says it, in its main
 * concept) and no date. More sheets carry their number, to be put together
 * in order.
 */
async function buildPdf(img: RenderedMap, opts: ExportOptions) {
  const { jsPDF } = await import('jspdf'); // ~350 KB, only needed here
  // Thin, but wider than what printers cannot reach (4 mm at most): the map gets the rest of the sheet.
  const margin = 5;
  const footer = opts.usesPictograms ? 5 : 0;
  const numbered = opts.pages > 1;
  const header = numbered ? 6 : 0;
  const pageLabel = (page: number, count: number) => `pagina ${page + 1} di ${count}`;
  const write = numbered ? await lettering([pageLabel(0, 2)]) : undefined;
  const plan = planPages(img.width, img.height, opts.paper, opts.pages, { margin, header, footer }, img.breaks, img.boxes);
  const doc = new jsPDF({ orientation: plan.orientation, unit: 'mm', format: opts.paper, compress: true });
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const boxW = pageW - margin * 2;
  const whole = plan.tiles.length === 1;
  const full = await loadImage(img.dataUrl);

  for (let page = 0; page < plan.pageCount; page++) {
    if (page > 0) doc.addPage(opts.paper, plan.orientation);
    // The title is not drawn, but it is there to search the PDF and read it aloud.
    doc.setFontSize(16).text(pdfText(opts.title), margin, margin + 4, { renderingMode: 'invisible' });
    if (write) put(doc, write, [pageLabel(page, plan.pageCount)], PAGE, pageW - margin, margin + 3.5, 'right');

    for (const tile of plan.tiles.filter((t) => t.page === page)) {
      const w = tile.w * plan.scale;
      const h = tile.h * plan.scale;
      const x = margin + tile.dx;
      const y = margin + header + tile.dy;
      // The outline shows the pieces, in reading order, and where to cut them out.
      doc.addImage(crop(full, img.width, img.height, tile, whole ? 0 : 0.35 / plan.scale), 'JPEG', x, y, w, h);
    }

    if (opts.usesPictograms) {
      doc.setFontSize(7);
      doc.setTextColor(100);
      doc.text(ARASAAC_CREDIT, margin, pageH - margin - 1.5, { maxWidth: boxW });
    }
  }
  return doc;
}

export async function exportMap(nodes: Node[], opts: ExportOptions): Promise<void> {
  const img = await renderMap(nodes, opts.simple, opts.format === 'pdf' ? PDF_PADDING : PADDING);
  if (opts.cancelled?.()) return;
  const base = `${slug(opts.title) || 'mappa'}${opts.simple ? '-verifica' : ''}`;
  if (opts.format === 'png') return shareFile(img.dataUrl, `${base}.png`, opts.title);
  const doc = await buildPdf(img, opts);
  if (opts.cancelled?.()) return;
  if (opts.print && !isNative()) return printPdf(doc.output('blob'));
  return shareFile(doc.output('datauristring'), `${base}.pdf`, opts.title);
}

/** Opens the browser's print dialog on the PDF, via a hidden iframe. */
function printPdf(pdf: Blob): void {
  const url = URL.createObjectURL(pdf);
  const frame = document.createElement('iframe');
  frame.className = 'print-frame';
  frame.src = url;
  // Keep the frame alive while the dialog is open; clean up much later,
  // even if the PDF never loads. The minute restarts once it has loaded:
  // a slow PDF must not eat the time spent in the print dialog.
  const cleanup = () => {
    frame.remove();
    URL.revokeObjectURL(url);
  };
  let timer = setTimeout(cleanup, 60_000);
  frame.onload = () => {
    clearTimeout(timer);
    timer = setTimeout(cleanup, 60_000);
    frame.contentWindow?.focus();
    frame.contentWindow?.print();
  };
  document.body.appendChild(frame);
}

/** Saves an editable copy of the map (".mappami") to share or reopen later. */
export async function saveMapFile(map: ConceptMap): Promise<void> {
  const dataUrl = textToDataUrl(serializeMap(map), 'application/json');
  await shareFile(dataUrl, `${slug(map.title) || 'mappa'}${MAP_FILE_EXTENSION}`, map.title);
}

const SHARED_DIR = 'condivisi';

/** Web: downloads the file. Android/iOS: opens the native share sheet. */
export async function shareFile(dataUrl: string, fileName: string, title: string): Promise<void> {
  if (!isNative()) {
    const blob = await (await fetch(dataUrl)).blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = fileName;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 10_000);
    return;
  }
  // Shared files get their own cache folder, emptied before each share: only the last one stays on the phone.
  await Filesystem.rmdir({ path: SHARED_DIR, directory: Directory.Cache, recursive: true }).catch(() => undefined);
  const { uri } = await Filesystem.writeFile({
    path: `${SHARED_DIR}/${fileName}`,
    data: dataUrl.slice(dataUrl.indexOf(',') + 1),
    directory: Directory.Cache,
    recursive: true,
  });
  await Share.share({ title, url: uri, dialogTitle: 'Condividi la mappa' });
}

export function slug(text: string): string {
  return text
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}
