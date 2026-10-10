import type { ConceptMap, MapEdge, MapNode, MapTemplate, NodeShape } from '../types/map';
import { newId } from './id';

/**
 * The ".mappami" file: an editable copy of a map that can travel between
 * devices (home ↔ school, student ↔ teacher). Plain JSON, self-contained:
 * photos and voice notes are embedded as data URLs.
 */
export const MAP_FILE_EXTENSION = '.mappami';
/** Files saved when the app was still called Mappeora: they open as before. */
export const OLD_MAP_FILE_EXTENSION = '.mappeora';
const FORMAT = 'mappeora';
/** «Salva tutte le mappe»: every map of the device in one file, same extension. */
const ARCHIVE_FORMAT = 'mappeora-archivio';
const VERSION = 1;
/** Far more maps than a child makes in years. */
const MAX_MAPS = 1000;

interface MapFile {
  format: typeof FORMAT;
  version: number;
  map: ConceptMap;
}

export class MapFileError extends Error {}

export function serializeMap(map: ConceptMap): string {
  const file: MapFile = { format: FORMAT, version: VERSION, map };
  return JSON.stringify(file);
}

/** A safety copy of all the maps (see services/backup.ts). */
export function serializeArchive(maps: ConceptMap[], savedAt = Date.now()): string {
  return JSON.stringify({ format: ARCHIVE_FORMAT, version: VERSION, savedAt, maps });
}

const SHAPES: NodeShape[] = ['rettangolo', 'ellisse', 'nuvola'];
const TEMPLATES: MapTemplate[] = ['libera', 'causa-effetto', 'timeline', 'confronto', '5w'];

const isObj = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);
/**
 * The limits only stop absurd files: they are well above anything the
 * editor produces, so a map exported and reopened comes back whole.
 */
const TEXT_MAX = 20_000;
const SHORT_TEXT_MAX = 1000;
const MAX_NODES = 2000;
const MAX_EDGES = 4000;
/** Far beyond any real map, small enough for «Mostra tutto» to frame. */
const COORD_MAX = 1e6;

const str = (v: unknown, max = TEXT_MAX): string | undefined => (typeof v === 'string' ? v.slice(0, max) : undefined);
const num = (v: unknown): number | undefined => (typeof v === 'number' && Number.isFinite(v) ? v : undefined);
const coord = (v: unknown): number | undefined => {
  const n = num(v);
  return n === undefined ? undefined : Math.min(COORD_MAX, Math.max(-COORD_MAX, n));
};

/**
 * Only data URLs are accepted for embedded media: a shared file must never
 * make the app load something from an arbitrary web address.
 */
const PHOTO_URL = /^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/=]+$/;

/** Fluent Emoji asset path, e.g. "Droplet/3D/droplet_3d". */
const ILLUSTRATION_PATH = /^[\p{L}\p{N} _.,'’&!()#*:-]+(\/[\p{L}\p{N} _.,'’&!()#*:-]+){2,3}$/u;

function readImage(v: unknown): MapNode['image'] {
  if (!isObj(v)) return undefined;
  const ref = str(v.ref, 10_000_000);
  if (!ref) return undefined;
  const src = str(v.src, 10_000_000);
  const withSrc = <T extends NonNullable<MapNode['image']>>(image: T): T =>
    src && PHOTO_URL.test(src) ? { ...image, src } : image;
  if (v.kind === 'emoji' && ref.length <= 16) return { kind: 'emoji', ref };
  // Older maps only: symbols are no longer offered, so without the picture saved inside there is nothing to show.
  if (v.kind === 'arasaac' && /^\d{1,7}$/.test(ref) && src && PHOTO_URL.test(src)) return { kind: 'arasaac', ref, src };
  if (v.kind === 'illustrazione' && ref.length <= 200 && !ref.includes('..') && ILLUSTRATION_PATH.test(ref)) {
    return withSrc({ kind: 'illustrazione', ref });
  }
  if (v.kind === 'foto' && PHOTO_URL.test(ref)) return { kind: 'foto', ref };
  return undefined;
}

function readNode(v: unknown): MapNode | undefined {
  if (!isObj(v) || !isObj(v.position)) return undefined;
  const id = str(v.id, 100);
  const label = str(v.label);
  const x = coord(v.position.x);
  const y = coord(v.position.y);
  if (!id || label === undefined || x === undefined || y === undefined) return undefined;
  const node: MapNode = { id, label, position: { x, y } };
  const color = str(v.color, 32);
  if (color && /^#[0-9a-f]{3,8}$/i.test(color)) node.color = color;
  if (SHAPES.includes(v.shape as NodeShape)) node.shape = v.shape as NodeShape;
  const image = readImage(v.image);
  if (image) node.image = image;
  if (v.collapsed === true) node.collapsed = true;
  return node;
}

function readEdge(v: unknown, nodeIds: Set<string>): MapEdge | undefined {
  if (!isObj(v)) return undefined;
  const id = str(v.id, 100);
  const source = str(v.source, 100);
  const target = str(v.target, 100);
  if (!id || !source || !target || !nodeIds.has(source) || !nodeIds.has(target)) return undefined;
  const label = str(v.label);
  return label ? { id, source, target, label } : { id, source, target };
}

/**
 * Parses and sanitises a ".mappami" (or older ".mappeora") file. The result is a fresh copy with
 * a new id, so opening a file never overwrites a map already on the device.
 */
export function parseMapFile(text: string): ConceptMap {
  const data = readJson(text);
  if (data.format === ARCHIVE_FORMAT) {
    throw new MapFileError('Questo file contiene tutte le mappe di un dispositivo: aprilo dalla schermata iniziale, con «Apri file».');
  }
  if (data.format !== FORMAT || !isObj(data.map)) throw new MapFileError('Questo file non è una mappa di MappAmi.');
  return readMap(data.map, { keepId: false });
}

/**
 * «Apri file»: one map (a new copy, as parseMapFile) or a safety copy of
 * all the maps, which keep their ids and dates so that opening the same
 * copy twice adds nothing (see services/backup.ts).
 */
export function parseAnyMapFile(text: string): { archive: boolean; maps: ConceptMap[] } {
  const data = readJson(text);
  if (data.format !== ARCHIVE_FORMAT) return { archive: false, maps: [parseMapFile(text)] };
  const list = Array.isArray(data.maps) ? data.maps.slice(0, MAX_MAPS) : [];
  const maps: ConceptMap[] = [];
  for (const raw of list) {
    try {
      maps.push(readMap(raw, { keepId: true }));
    } catch {
      // A damaged map does not stop the others.
    }
  }
  if (maps.length === 0) throw new MapFileError('Nel file non ci sono mappe che riesco ad aprire.');
  return { archive: true, maps };
}

function readJson(text: string): Record<string, unknown> {
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch {
    throw new MapFileError('Questo file non è una mappa di MappAmi.');
  }
  if (!isObj(data)) throw new MapFileError('Questo file non è una mappa di MappAmi.');
  if ((num(data.version) ?? 0) > VERSION) {
    throw new MapFileError('Questa mappa è stata fatta con una versione più nuova di MappAmi. Aggiorna l’app.');
  }
  return data;
}

function readMap(m: unknown, { keepId }: { keepId: boolean }): ConceptMap {
  if (!isObj(m)) throw new MapFileError('La mappa nel file è vuota o rovinata.');
  const tooBig = () => new MapFileError('La mappa nel file è troppo grande.');
  const nodes: MapNode[] = [];
  const seen = new Set<string>();
  for (const raw of Array.isArray(m.nodes) ? m.nodes : []) {
    const node = readNode(raw);
    if (node && !seen.has(node.id)) {
      seen.add(node.id);
      nodes.push(node);
      if (nodes.length > MAX_NODES) throw tooBig();
    }
  }
  if (nodes.length === 0) throw new MapFileError('La mappa nel file è vuota o rovinata.');
  // Same rules as linking in the editor: no link to itself, one link per
  // pair, and every link with its own id.
  const edges: MapEdge[] = [];
  const edgeIds = new Set<string>();
  const pairs = new Set<string>();
  for (const raw of Array.isArray(m.edges) ? m.edges : []) {
    const edge = readEdge(raw, seen);
    if (!edge || edge.source === edge.target) continue;
    const pair = `${edge.source}\u0000${edge.target}`;
    if (pairs.has(pair)) continue;
    pairs.add(pair);
    if (edgeIds.has(edge.id)) edge.id = newId();
    edgeIds.add(edge.id);
    edges.push(edge);
    if (edges.length > MAX_EDGES) throw tooBig();
  }

  const now = Date.now();
  const id = keepId ? str(m.id, 100) : undefined;
  return {
    id: id || newId(),
    title: str(m.title, SHORT_TEXT_MAX)?.trim() || 'Mappa importata',
    createdAt: num(m.createdAt) ?? now,
    updatedAt: keepId ? (num(m.updatedAt) ?? now) : now,
    template: TEMPLATES.includes(m.template as MapTemplate) ? (m.template as MapTemplate) : 'libera',
    ...(m.freeLayout === true && { freeLayout: true }),
    nodes,
    edges,
  };
}

/** UTF-8 safe base64, for handing the JSON to the native share sheet. */
export function textToDataUrl(text: string, mime: string): string {
  const bytes = new TextEncoder().encode(text);
  let binary = '';
  for (let i = 0; i < bytes.length; i += 0x8000) {
    binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  }
  return `data:${mime};base64,${btoa(binary)}`;
}
