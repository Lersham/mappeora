import { toPng } from 'html-to-image';
import { getNodesBounds, getViewportForBounds, type Node } from '@xyflow/react';
import { Directory, Filesystem } from '@capacitor/filesystem';
import { Share } from '@capacitor/share';
import { isNative } from './platform';

const PADDING = 0.1;

/** Renders the whole map (not just the visible area) to a PNG data URL. */
export async function renderMapPng(nodes: Node[], background: string): Promise<string> {
  const bounds = getNodesBounds(nodes);
  const width = Math.max(800, Math.ceil(bounds.width * (1 + PADDING * 2)));
  const height = Math.max(600, Math.ceil(bounds.height * (1 + PADDING * 2)));
  const viewport = getViewportForBounds(bounds, width, height, 0.2, 2, PADDING);
  const el = document.querySelector<HTMLElement>('.react-flow__viewport');
  if (!el) throw new Error('viewport-not-found');
  return toPng(el, {
    backgroundColor: background,
    width,
    height,
    pixelRatio: 2,
    style: {
      width: `${width}px`,
      height: `${height}px`,
      transform: `translate(${viewport.x}px, ${viewport.y}px) scale(${viewport.zoom})`,
    },
  });
}

/** Web: downloads the file. Android/iOS: opens the native share sheet. */
export async function shareImage(dataUrl: string, title: string): Promise<void> {
  const fileName = `${slug(title) || 'mappa'}.png`;
  if (!isNative()) {
    const a = document.createElement('a');
    a.href = dataUrl;
    a.download = fileName;
    a.click();
    return;
  }
  const { uri } = await Filesystem.writeFile({
    path: fileName,
    data: dataUrl.split(',')[1],
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
