import { toPng } from 'html-to-image';
import { getNodesBounds, getViewportForBounds, type Node } from '@xyflow/react';
import { Directory, Filesystem } from '@capacitor/filesystem';
import { Share } from '@capacitor/share';
import { isNative } from './platform';
import { ARASAAC_CREDIT } from './pictograms';
import { MAP_FILE_EXTENSION, serializeMap, textToDataUrl } from '../lib/mapFile';
import { planPages, type PageCount, type Paper } from '../lib/pagePlan';
import type { ConceptMap } from '../types/map';

const PADDING = 0.1;

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
}

interface RenderedMap {
  dataUrl: string;
  width: number;
  height: number;
}

/** Interactive bits that must never end up on paper. */
function keepInExport(node: HTMLElement): boolean {
  const cls = node.classList;
  return !cls || !['concept-speak', 'concept-toggle', 'react-flow__handle'].some((c) => cls.contains(c));
}

/** Renders the whole map (not just the visible area) to a PNG. */
async function renderMap(nodes: Node[], background: string, simple: boolean): Promise<RenderedMap> {
  const bounds = getNodesBounds(nodes.filter((n) => !n.hidden));
  // Small minimums only: a narrow "scaletta" must stay narrow to fill a
  // portrait sheet instead of floating in a wide empty image.
  const width = Math.max(320, Math.ceil(bounds.width * (1 + PADDING * 2)));
  const height = Math.max(240, Math.ceil(bounds.height * (1 + PADDING * 2)));
  const viewport = getViewportForBounds(bounds, width, height, 0.2, 2, PADDING);
  const flow = document.querySelector<HTMLElement>('.react-flow');
  const el = flow?.querySelector<HTMLElement>('.react-flow__viewport');
  if (!flow || !el) throw new Error('viewport-not-found');
  flow.classList.toggle('export-simple', simple);
  flow.classList.add('exporting');
  try {
    const dataUrl = await toPng(el, {
      backgroundColor: simple ? '#ffffff' : background,
      width,
      height,
      pixelRatio: 2,
      filter: keepInExport,
      style: {
        width: `${width}px`,
        height: `${height}px`,
        transform: `translate(${viewport.x}px, ${viewport.y}px) scale(${viewport.zoom})`,
      },
    });
    return { dataUrl, width, height };
  } finally {
    flow.classList.remove('export-simple', 'exporting');
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
  return canvas.toDataURL('image/png');
}

async function buildPdf(img: RenderedMap, opts: ExportOptions) {
  const { jsPDF } = await import('jspdf'); // ~350 KB, only needed here
  const margin = 12;
  const header = 12;
  const footer = opts.usesPictograms ? 8 : 4;
  const plan = planPages(img.width, img.height, opts.paper, opts.pages, { margin, header, footer });
  const doc = new jsPDF({ orientation: plan.orientation, unit: 'mm', format: opts.paper });
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const boxW = pageW - margin * 2;
  const full = plan.tiles.length > 1 ? await loadImage(img.dataUrl) : null;
  const date = new Date().toLocaleDateString('it-IT');

  plan.tiles.forEach((tile, i) => {
    if (i > 0) doc.addPage(opts.paper, plan.orientation);
    doc.setTextColor(0);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(16);
    doc.text(opts.title, margin, margin + 6, { maxWidth: boxW - 40 });
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    const right = plan.tiles.length > 1 ? `${date} · pagina ${i + 1} di ${plan.tiles.length}` : date;
    doc.text(right, pageW - margin, margin + 6, { align: 'right' });

    const w = tile.w * plan.scale;
    const h = tile.h * plan.scale;
    const x = margin + (boxW - w) / 2;
    const y = margin + header; // top-aligned: strips line up when the sheets are joined
    doc.addImage(full ? crop(full, img.width, tile) : img.dataUrl, 'PNG', x, y, w, h);
    if (plan.tiles.length > 1) {
      doc.setDrawColor(180);
      doc.rect(x, y, w, h); // shows where to join the sheets
    }

    if (opts.usesPictograms) {
      doc.setFontSize(7);
      doc.setTextColor(100);
      doc.text(ARASAAC_CREDIT, margin, pageH - margin + 2, { maxWidth: boxW });
    }
  });
  return doc;
}

export async function exportMap(nodes: Node[], background: string, opts: ExportOptions): Promise<void> {
  const img = await renderMap(nodes, background, opts.simple);
  const base = `${slug(opts.title) || 'mappa'}${opts.simple ? '-verifica' : ''}`;
  if (opts.format === 'png') return shareFile(img.dataUrl, `${base}.png`, opts.title);
  const doc = await buildPdf(img, opts);
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
async function shareFile(dataUrl: string, fileName: string, title: string): Promise<void> {
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
