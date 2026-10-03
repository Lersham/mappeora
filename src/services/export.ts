import { toPng } from 'html-to-image';
import { getNodesBounds, getViewportForBounds, type Node } from '@xyflow/react';
import { Directory, Filesystem } from '@capacitor/filesystem';
import { Share } from '@capacitor/share';
import { isNative } from './platform';
import { ARASAAC_CREDIT } from './pictograms';

const PADDING = 0.1;

export type ExportFormat = 'png' | 'pdf-a4' | 'pdf-a3';

export interface ExportOptions {
  format: ExportFormat;
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
  return !cls || !(cls.contains('concept-speak') || cls.contains('react-flow__handle'));
}

/** Renders the whole map (not just the visible area) to a PNG. */
async function renderMap(nodes: Node[], background: string, simple: boolean): Promise<RenderedMap> {
  const bounds = getNodesBounds(nodes.filter((n) => !n.hidden));
  const width = Math.max(800, Math.ceil(bounds.width * (1 + PADDING * 2)));
  const height = Math.max(600, Math.ceil(bounds.height * (1 + PADDING * 2)));
  const viewport = getViewportForBounds(bounds, width, height, 0.2, 2, PADDING);
  const flow = document.querySelector<HTMLElement>('.react-flow');
  const el = flow?.querySelector<HTMLElement>('.react-flow__viewport');
  if (!flow || !el) throw new Error('viewport-not-found');
  flow.classList.toggle('export-simple', simple);
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
    flow.classList.remove('export-simple');
  }
}

async function buildPdf(img: RenderedMap, opts: ExportOptions): Promise<string> {
  const { jsPDF } = await import('jspdf'); // ~350 KB, only needed here
  const landscape = img.width >= img.height;
  const doc = new jsPDF({
    orientation: landscape ? 'landscape' : 'portrait',
    unit: 'mm',
    format: opts.format === 'pdf-a3' ? 'a3' : 'a4',
  });
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const margin = 12;

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(18);
  doc.text(opts.title, margin, margin + 4);
  const top = margin + 10;
  const footer = opts.usesPictograms ? 8 : 0;

  // Fit the image inside the remaining area, keeping its proportions.
  const boxW = pageW - margin * 2;
  const boxH = pageH - top - margin - footer;
  const scale = Math.min(boxW / img.width, boxH / img.height);
  const w = img.width * scale;
  const h = img.height * scale;
  doc.addImage(img.dataUrl, 'PNG', margin + (boxW - w) / 2, top + (boxH - h) / 2, w, h);

  if (opts.usesPictograms) {
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7);
    doc.setTextColor(100);
    doc.text(ARASAAC_CREDIT, margin, pageH - margin + 2, { maxWidth: boxW });
  }
  return doc.output('datauristring');
}

export async function exportMap(nodes: Node[], background: string, opts: ExportOptions): Promise<void> {
  const img = await renderMap(nodes, background, opts.simple);
  const base = `${slug(opts.title) || 'mappa'}${opts.simple ? '-verifica' : ''}`;
  if (opts.format === 'png') return shareFile(img.dataUrl, `${base}.png`, opts.title);
  return shareFile(await buildPdf(img, opts), `${base}.pdf`, opts.title);
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
