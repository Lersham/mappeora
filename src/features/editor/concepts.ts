import { collapseInfo } from '../../lib/collapse';
import { NEW_MAP_TITLE } from '../../lib/mapFactory';
import { DEFAULT_COLOR } from '../../lib/palette';
import type { SheetResult } from '../../lib/sheetLayout';
import { spanningTree } from '../../lib/tree';
import type { ConceptMap, MapNode } from '../../types/map';

type Graph = Pick<ConceptMap, 'nodes' | 'edges'>;
type Point = { x: number; y: number };

/** Where a new concept goes when none is selected: under the main one. */
export function mainConcept(map: Graph, hidden: Set<string>): MapNode | undefined {
  const visible = map.nodes.filter((n) => !hidden.has(n.id));
  const targets = new Set(map.edges.map((e) => e.target));
  return visible.find((n) => n.shape === 'ellisse') ?? visible.find((n) => !targets.has(n.id)) ?? visible[0];
}

/** Where a new concept goes: under the one in hand if it is on screen, else under the main one. */
export function parentForNew(map: Graph, selectedId: string | null): string | null {
  const hidden = collapseInfo(map).hidden;
  if (selectedId && map.nodes.some((n) => n.id === selectedId) && !hidden.has(selectedId)) return selectedId;
  return mainConcept(map, hidden)?.id ?? null;
}

/** Tab while writing a concept: one under it. Maiusc+Tab: one next to it (under its parent, if it has one). */
export function parentForNear(map: Graph, id: string, where: 'child' | 'sibling'): string {
  const parent = where === 'sibling' ? spanningTree(map).parent.get(id) : undefined;
  return parent ?? id;
}

/**
 * The concepts a tap on `id` brings close. On a sheet: its branch, from the
 * branch's first concept down (only the main concept, if it is that). Without
 * a sheet: the concept and the ones right under it.
 */
export function closeUpGroup(map: Graph, id: string, sheet: Pick<SheetResult, 'roles' | 'heads'> | null): string[] {
  const below = new Map<string, string[]>();
  const above = new Map<string, string>();
  for (const e of spanningTree(map).forward) {
    if (above.has(e.target)) continue;
    above.set(e.target, e.source);
    below.set(e.source, [...(below.get(e.source) ?? []), e.target]);
  }
  let head = id;
  if (sheet) {
    while (sheet.roles[head] === 'item' && !(head in sheet.heads) && above.has(head)) head = above.get(head)!;
    if (sheet.roles[head] === 'root') return [head];
  }
  const out: string[] = [];
  const visit = (n: string) => {
    if (out.includes(n)) return;
    out.push(n);
    if (!sheet && n !== id) return;
    for (const c of below.get(n) ?? []) visit(c);
  };
  visit(head);
  return out;
}

/** Where the sheet starts: the main concept, i.e. the highest (then leftmost) one nobody points to. */
export function sheetAnchor(map: Graph): Point | undefined {
  const targets = new Set(map.edges.map((e) => e.target));
  const roots = map.nodes.filter((n) => !targets.has(n.id));
  const first = (roots.length ? roots : map.nodes).reduce<MapNode | undefined>(
    (best, n) => (!best || n.position.y < best.position.y || (n.position.y === best.position.y && n.position.x < best.position.x) ? n : best),
    undefined,
  );
  return first?.position;
}

/**
 * A white map is white all over: a branch's line and border take its colour
 * only once its first concept has one («Colora i rami», or by hand).
 */
export function paintedBranches(nodes: Pick<MapNode, 'id' | 'color'>[], heads: Record<string, number>): Set<number> {
  const colors = new Map(nodes.map((n) => [n.id, n.color ?? DEFAULT_COLOR]));
  return new Set(
    Object.entries(heads)
      .filter(([id]) => colors.get(id) !== DEFAULT_COLOR)
      .map(([, b]) => b),
  );
}

/** The places the sheet gives that differ from where the concepts are (by more than half a pixel). */
export function movedPositions(nodes: Pick<MapNode, 'id' | 'position'>[], positions: Record<string, Point>): Record<string, Point> {
  return Object.fromEntries(
    Object.entries(positions).filter(([id, p]) => {
      const n = nodes.find((x) => x.id === id);
      return n && (Math.abs(n.position.x - p.x) > 0.5 || Math.abs(n.position.y - p.y) > 0.5);
    }),
  );
}

/**
 * New places worked out on `before`, only for the concepts nobody moved
 * since (`now`): the child may have dragged one while the layout ran.
 */
export function stillInPlace(positions: Record<string, Point>, before: Graph, now: Graph): Record<string, Point> {
  const was = new Map(before.nodes.map((n) => [n.id, n.position]));
  return Object.fromEntries(Object.entries(positions).filter(([id]) => now.nodes.find((n) => n.id === id)?.position === was.get(id)));
}

/** A map just made and still empty: only its main concept, still unnamed. */
export function isUntouchedNewMap(map: Pick<ConceptMap, 'title' | 'nodes'>): boolean {
  const [root] = map.nodes;
  return map.nodes.length === 1 && map.title === NEW_MAP_TITLE && root.label === NEW_MAP_TITLE;
}
