import type { ConceptMap, MapEdge, MapNode } from '../types/map';
import { ladderLayout } from './ladder';
import { colorForDepth } from './palette';
import { newId } from './id';

/** One line of the "scaletta": a concept and how far it is indented. */
export interface OutlineRow {
  id: string;
  label: string;
  depth: number;
}

/** Vertical step between concepts before the layout places them. */
const HINT_STEP = 100;
const HINT_INDENT = 40;

/** A concept written on more lines fits on one row of the list. */
const oneLine = (label: string) => label.replace(/\s*\n\s*/g, ' ').trim();

/**
 * The map as an indented list, in the order it is read on the sheet: each
 * concept under the one it hangs from. Cross-links are not part of the list.
 */
export function toOutline(map: Pick<ConceptMap, 'nodes' | 'edges'>): OutlineRow[] {
  const { order, treeEdges } = ladderLayout(map.nodes, map.edges);
  const parent = new Map(map.edges.filter((e) => treeEdges.has(e.id)).map((e) => [e.target, e.source]));
  const depth = new Map<string, number>();
  const byId = new Map(map.nodes.map((n) => [n.id, n]));
  return order.map((id) => {
    const p = parent.get(id);
    const d = p === undefined ? 0 : (depth.get(p) ?? 0) + 1;
    depth.set(id, d);
    return { id, label: oneLine(byId.get(id)!.label), depth: d };
  });
}

/**
 * Rebuilds the map from an edited list. Concepts keep their colour, picture
 * and links that still make sense; empty lines are left out and new lines
 * become new concepts. Positions only give the order: the layout places them.
 */
export function fromOutline(map: Pick<ConceptMap, 'nodes' | 'edges'>, rows: OutlineRow[]): Pick<ConceptMap, 'nodes' | 'edges'> {
  const before = toOutline(map);
  const same = (a: OutlineRow, b: OutlineRow) => a.id === b.id && a.depth === b.depth && oneLine(a.label) === b.label;
  // Only looked at the list: the map stays exactly as it was.
  if (rows.length === before.length && rows.every((r, i) => same(r, before[i]))) return map;

  const raw = rows.map((r) => ({ ...r, label: r.label.trim() }));
  // An emptied line goes away like with 🗑️: the lines under it move one step left.
  for (let i = 0; i < raw.length; i++) {
    if (raw[i].label) continue;
    let end = i + 1;
    while (end < raw.length && raw[end].depth > raw[i].depth) end++;
    for (let j = i + 1; j < end; j++) raw[j].depth--;
  }
  const lines = raw.filter((r) => r.label);
  // A line can only go one step further in than the one above it.
  let previous = -1;
  for (const r of lines) {
    r.depth = Math.max(0, Math.min(r.depth, previous + 1));
    previous = r.depth;
  }

  const byId = new Map(map.nodes.map((n) => [n.id, n]));
  const origin = byId.get(lines[0]?.id)?.position ?? map.nodes[0]?.position ?? { x: 0, y: 0 };
  const parents: (number | undefined)[] = [];
  const stack: number[] = [];
  const nodes: MapNode[] = lines.map((r, i) => {
    stack.length = r.depth;
    parents.push(stack[r.depth - 1]);
    stack.push(i);
    const position = { x: origin.x + r.depth * HINT_INDENT, y: origin.y + i * HINT_STEP };
    const old = byId.get(r.id);
    // A concept written on more lines keeps them if the row was not changed.
    const label = old && oneLine(old.label) === r.label ? old.label : r.label;
    return old ? { ...old, label, position } : { id: r.id, label, position, color: colorForDepth(r.depth), shape: 'rettangolo' };
  });

  const key = (source: string, target: string) => `${source}→${target}`;
  const oldEdges = new Map(map.edges.map((e) => [key(e.source, e.target), e]));
  const edges: MapEdge[] = [];
  const added = new Set<string>();
  lines.forEach((r, i) => {
    const p = parents[i];
    if (p === undefined) return;
    const source = lines[p].id;
    // The same link as before keeps its linking words.
    const old = oldEdges.get(key(source, r.id));
    edges.push(old ?? { id: newId(), source, target: r.id });
    added.add(key(source, r.id));
    // A new line under a closed branch must show on the map.
    if (!old) for (let a: number | undefined = p; a !== undefined; a = parents[a]) nodes[a] = { ...nodes[a], collapsed: false };
  });
  for (const n of nodes) if (n.collapsed === false) delete n.collapsed;

  // Cross-links stay while both concepts are still there, as long as they
  // don't change the list: one followed before the line it points to would
  // hang that concept somewhere else than the list says.
  const tree = ladderLayout(nodes, edges);
  const sameTree = (t: typeof tree) => t.order.join() === tree.order.join() && t.treeEdges.size === tree.treeEdges.size && [...t.treeEdges].every((id) => tree.treeEdges.has(id));
  const { treeEdges: oldTree } = ladderLayout(map.nodes, map.edges);
  const kept = new Set(lines.map((r) => r.id));
  for (const e of map.edges) {
    if (oldTree.has(e.id) || added.has(key(e.source, e.target))) continue;
    if (!kept.has(e.source) || !kept.has(e.target)) continue;
    if (sameTree(ladderLayout(nodes, [...edges, e]))) edges.push(e);
  }
  return { nodes, edges };
}
