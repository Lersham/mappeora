import { toPng } from 'html-to-image';
import { getNodesBounds, type Node } from '@xyflow/react';
import { Directory, Filesystem } from '@capacitor/filesystem';
import { Share } from '@capacitor/share';
import { isNative } from './platform';
import { MAP_FILE_EXTENSION, serializeMap, textToDataUrl } from '../lib/mapFile';
import { planPages, type PageCount, type Paper } from '../lib/pagePlan';
import type { ConceptMap } from '../types/map';

/** 1×1 transparent PNG. */
const EMPTY_PNG = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=';

/** Required by the licence of the ARASAAC symbols that older maps may still contain. */
const ARASAAC_CREDIT =
  'Pittogrammi: Sergio Palao. Origine: ARASAAC (https://arasaac.org). Licenza: CC BY-NC-SA. Proprietà: Governo di Aragona (Spagna).';

/** Margin around the map in the image, in CSS px (a fixed amount: a
 * percentage would leave huge empty bands around a long map). */
const PADDING = 32;

export type ExportFormat = 'png' | 'pdf';

export interface ExportOptions {
  format: ExportFormat;
  paper: Paper;
  /** Splitting a big map over more sheets keeps its text readable. */
  pages: PageCount;
  /** Web only: open the print dialog instead of downloading. */
  print?: boolean;
  /**
   * "Versione per la verifica": white background, no colours, no
   * decorations — a clean compensatory tool to bring to a test.
   */
  simple: boolean;
  title: string;
  /** Adds the ARASAAC credit, required by the pictograms' licence. */
  usesPictograms: boolean;
  /** True once «Annulla» was pressed: the file is then never handed over. */
  cancelled?: () => boolean;
  /** PDF only: the concepts' «Approfondimenti», on the last page(s). Never with `simple`. */
  notes?: { label: string; note: string }[];
}

interface RenderedMap {
  dataUrl: string;
  width: number;
  height: number;
  /** Heights (CSS px of the image) where a page cut won't split a concept. */
  breaks: number[];
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

/** Renders the whole map (not just the visible area) to a PNG. */
async function renderMap(nodes: Node[], background: string, simple: boolean, withNotes: boolean): Promise<RenderedMap> {
  const flow = document.querySelector<HTMLElement>('.react-flow');
  const el = flow?.querySelector<HTMLElement>('.react-flow__viewport');
  if (!flow || !el) throw new Error('viewport-not-found');
  await document.fonts?.ready; // the reading font, not a stand-in
  const shown = nodes.filter((n) => !n.hidden);
  const bounds = labelRects(flow, el).reduce(union, getNodesBounds(shown));
  // Small minimums only: a narrow "scaletta" must stay narrow to fill a
  // portrait sheet instead of floating in a wide empty image.
  const width = Math.max(320, Math.ceil(bounds.width + PADDING * 2));
  const height = Math.max(240, Math.ceil(bounds.height + PADDING * 2));
  // Real size (zoom 1), centred: the PDF scales it to the sheet.
  const viewport = {
    zoom: 1,
    x: (width - bounds.width) / 2 - bounds.x,
    y: (height - bounds.height) / 2 - bounds.y,
  };
  flow.classList.toggle('export-simple', simple);
  // The 📝 on a concept only makes sense with the page of notes.
  flow.classList.toggle('export-no-notes', !withNotes);
  flow.classList.add('exporting');
  try {
    const dataUrl = await toPng(el, {
      backgroundColor: simple ? '#ffffff' : background,
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
    return { dataUrl, width, height, breaks };
  } finally {
    flow.classList.remove('export-simple', 'export-no-notes', 'exporting');
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

/** Cuts one tile (in CSS px of the rendered map) out of the full image. */
function crop(img: HTMLImageElement, cssWidth: number, tile: { x: number; y: number; w: number; h: number }): string {
  const ratio = img.naturalWidth / cssWidth; // pixelRatio used by renderMap
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(tile.w * ratio);
  canvas.height = Math.round(tile.h * ratio);
  canvas.getContext('2d')!.drawImage(img, tile.x * ratio, tile.y * ratio, canvas.width, canvas.height, 0, 0, canvas.width, canvas.height);
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
const TITLE_SIZE = 16;
/** Height of one title line, in mm. */
const TITLE_LINE = 7;

/** The title on at most two lines (shortened with "..." if longer). */
function titleLines(doc: Pdf, title: string, width: number): string[] {
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(TITLE_SIZE);
  const lines: string[] = doc.splitTextToSize(pdfText(title) || 'Mappa', width);
  if (lines.length <= 2) return lines;
  let second = lines.slice(1).join(' ');
  while (second.length > 1 && doc.getTextWidth(`${second}...`) > width) second = second.slice(0, -1);
  return [lines[0], `${second.trimEnd()}...`];
}

async function buildPdf(img: RenderedMap, opts: ExportOptions) {
  const { jsPDF } = await import('jspdf'); // ~350 KB, only needed here
  const margin = 12;
  const footer = opts.usesPictograms ? 8 : 4;
  // The header grows with the title: the sheet's way round (and so the
  // title's room) depends on the header, so this may take a second round.
  let header = 12;
  let plan = planPages(img.width, img.height, opts.paper, opts.pages, { margin, header, footer }, img.breaks);
  let doc = new jsPDF({ orientation: plan.orientation, unit: 'mm', format: opts.paper, compress: true });
  let title = titleLines(doc, opts.title, doc.internal.pageSize.getWidth() - margin * 2 - 40);
  for (let round = 0; round < 2 && 12 + (title.length - 1) * TITLE_LINE !== header; round++) {
    header = 12 + (title.length - 1) * TITLE_LINE;
    plan = planPages(img.width, img.height, opts.paper, opts.pages, { margin, header, footer }, img.breaks);
    doc = new jsPDF({ orientation: plan.orientation, unit: 'mm', format: opts.paper, compress: true });
    title = titleLines(doc, opts.title, doc.internal.pageSize.getWidth() - margin * 2 - 40);
  }
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const boxW = pageW - margin * 2;
  const whole = plan.tiles.length === 1;
  const full = await loadImage(img.dataUrl);
  const date = new Date().toLocaleDateString('it-IT');

  for (let page = 0; page < plan.pageCount; page++) {
    if (page > 0) doc.addPage(opts.paper, plan.orientation);
    doc.setTextColor(0);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(TITLE_SIZE);
    title.forEach((line, i) => doc.text(line, margin, margin + 6 + i * TITLE_LINE));
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    const right = plan.pageCount > 1 ? `${date} · pagina ${page + 1} di ${plan.pageCount}` : date;
    doc.text(right, pageW - margin, margin + 6, { align: 'right' });

    for (const tile of plan.tiles.filter((t) => t.page === page)) {
      const w = tile.w * plan.scale;
      const h = tile.h * plan.scale;
      const x = margin + tile.dx;
      const y = margin + header + tile.dy;
      doc.addImage(crop(full, img.width, tile), 'JPEG', x, y, w, h);
      if (!whole) {
        doc.setDrawColor(180);
        doc.rect(x, y, w, h); // shows the pieces, in reading order
      }
    }

    if (opts.usesPictograms) {
      doc.setFontSize(7);
      doc.setTextColor(100);
      doc.text(ARASAAC_CREDIT, margin, pageH - margin + 2, { maxWidth: boxW });
    }
  }
  if (!opts.simple && opts.notes?.length) addNotes(doc, opts.notes, opts.paper, plan.orientation, title, margin);
  return doc;
}

/** «Approfondimenti»: each concept's note, in reading order, after the map. */
function addNotes(doc: Pdf, notes: { label: string; note: string }[], paper: Paper, orientation: 'portrait' | 'landscape', title: string[], margin: number) {
  doc.addPage(paper, orientation);
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const width = pageW - margin * 2;
  let y = margin + 6;
  doc.setTextColor(0);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(TITLE_SIZE);
  doc.text(`Approfondimenti - ${title.join(' ')}`.slice(0, 120), margin, y, { maxWidth: width });
  y += TITLE_LINE + 4;
  for (const { label, note } of notes) {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(12);
    const head: string[] = doc.splitTextToSize(pdfText(label) || '-', width);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(11);
    const body: string[] = doc.splitTextToSize(pdfText(note), width);
    const needed = head.length * 5.5 + body.length * 5 + 6;
    if (y + Math.min(needed, 40) > pageH - margin) {
      doc.addPage(paper, orientation);
      y = margin + 6;
    }
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(12);
    for (const line of head) {
      doc.text(line, margin, y);
      y += 5.5;
    }
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(11);
    for (const line of body) {
      if (y > pageH - margin) {
        doc.addPage(paper, orientation);
        y = margin + 6;
      }
      doc.text(line, margin, y);
      y += 5;
    }
    y += 6;
  }
}

export async function exportMap(nodes: Node[], background: string, opts: ExportOptions): Promise<void> {
  const withNotes = opts.format === 'pdf' && !opts.simple && !!opts.notes?.length;
  const img = await renderMap(nodes, background, opts.simple, withNotes);
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
  frame.onload = () => {
    frame.contentWindow?.focus();
    frame.contentWindow?.print();
    // Keep the frame alive while the dialog is open; clean up much later.
    setTimeout(() => {
      frame.remove();
      URL.revokeObjectURL(url);
    }, 60_000);
  };
  document.body.appendChild(frame);
}

/** Saves an editable copy of the map (".mappeora") to share or reopen later. */
export async function saveMapFile(map: ConceptMap): Promise<void> {
  const dataUrl = textToDataUrl(serializeMap(map), 'application/json');
  await shareFile(dataUrl, `${slug(map.title) || 'mappa'}${MAP_FILE_EXTENSION}`, map.title);
}

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
  const { uri } = await Filesystem.writeFile({
    path: fileName,
    data: dataUrl.slice(dataUrl.indexOf(',') + 1),
    directory: Directory.Cache,
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
