/**
 * React Flow hands every edge a fresh props object on each render of the
 * map (a select, a drag frame, a letter typed in the title, a word read
 * aloud), with a new `data` object and new arrays inside it, even for the
 * lines that did not change. With a few hundred lines that is most of the
 * time spent. The edge components are wrapped in memo() with this
 * comparison, so a line draws again only when what it draws changed.
 */

/** Same value, or the same list of the same values, or the same object with the same values. */
function sameShallow(a: unknown, b: unknown): boolean {
  if (Object.is(a, b)) return true;
  if (typeof a !== 'object' || typeof b !== 'object' || a === null || b === null) return false;
  if (Array.isArray(a) !== Array.isArray(b)) return false;
  const [ka, kb] = [Object.keys(a), Object.keys(b)];
  if (ka.length !== kb.length) return false;
  return ka.every((k) => k in b && Object.is((a as Record<string, unknown>)[k], (b as Record<string, unknown>)[k]));
}

type Point = { x: number; y: number };

const samePoints = (a: unknown, b: unknown): boolean => {
  if (Object.is(a, b)) return true;
  if (!Array.isArray(a) || !Array.isArray(b) || a.length !== b.length) return false;
  return a.every((p: Point, i) => p.x === (b[i] as Point).x && p.y === (b[i] as Point).y);
};

/**
 * Callbacks in `data` that are only compared by being there or not. Every
 * render of the editor makes a new function for each line, but it always
 * does the same thing: it opens the window for that line's linking words
 * (it closes over the line's id and a state setter, never over anything that
 * changes). It is missing only while a review is running, when the «+» and
 * the words are not buttons. If one of these ever closes over something that
 * changes, take it out of this list.
 */
const PRESENCE_ONLY = new Set(['onEdit']);

function sameData(a: unknown, b: unknown): boolean {
  if (Object.is(a, b)) return true;
  if (typeof a !== 'object' || typeof b !== 'object' || a === null || b === null) return false;
  const [da, db] = [a as Record<string, unknown>, b as Record<string, unknown>];
  const keys = Object.keys(da);
  if (keys.length !== Object.keys(db).length) return false;
  return keys.every((k) => {
    if (!(k in db)) return false;
    if (k === 'points') return samePoints(da[k], db[k]);
    if (PRESENCE_ONLY.has(k) && typeof da[k] === 'function' && typeof db[k] === 'function') return true;
    return Object.is(da[k], db[k]);
  });
}

/**
 * For memo(): true when a line would draw exactly the same. Every prop is
 * compared (position of the ends, sides, markers, label, selected, style…),
 * one level deep where it is an object or a list (`style`, `labelBgPadding`),
 * except `data`, which is compared field by field (see above).
 */
export function sameEdgeProps<P extends object>(prev: P, next: P): boolean {
  const [a, b] = [prev as Record<string, unknown>, next as Record<string, unknown>];
  const keys = Object.keys(a);
  if (keys.length !== Object.keys(b).length) return false;
  return keys.every((k) => k in b && (k === 'data' ? sameData(a[k], b[k]) : sameShallow(a[k], b[k])));
}
