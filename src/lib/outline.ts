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
    return { id, label: byId.get(id)!.label, depth: d };
  });
}

/**
 * Rebuilds the map from an edited list. Concepts keep their colour, picture
 * and links that still make sense; empty lines are left out and new lines
 * become new concepts. Positions only give the order: the layout places them.
 */
export function fromOutline(map: Pick<ConceptMap, 'nodes' | 'edges'>, rows: OutlineRow[]): Pick<ConceptMap, 'nodes' | 'edges'> {
  const lines = rows.map((r) => ({ ...r, label: r.label.trim() })).filter((r) => r.label);
  // A line can only go one step further in than the one above it.
  let previous = -1;
  for (const r of lines) {
    r.depth = Math.max(0, Math.min(r.depth, previous + 1));
    previous = r.depth;
  }

  const byId = new Map(map.nodes.map((n) => [n.id, n]));
  const origin = byId.get(lines[0]?.id)?.position ?? map.nodes[0]?.position ?? { x: 0, y: 0 };
  const parents: (string | undefined)[] = [];
  const stack: string[] = [];
  const nodes: MapNode[] = lines.map((r, i) => {
    stack.length = r.depth;
    parents.push(stack[r.depth - 1]);
    stack.push(r.id);
    const position = { x: origin.x + r.depth * HINT_INDENT, y: origin.y + i * HINT_STEP };
    const old = byId.get(r.id);
    return old ? { ...old, label: r.label, position } : { id: r.id, label: r.label, position, color: colorForDepth(r.depth), shape: 'rettangolo' };
  });

  const key = (source: string, target: string) => `${source}→${target}`;
  const oldEdges = new Map(map.edges.map((e) => [key(e.source, e.target), e]));
  const { treeEdges } = ladderLayout(map.nodes, map.edges);
  const edges: MapEdge[] = [];
  const added = new Set<string>();
  lines.forEach((r, i) => {
    const p = parents[i];
    if (!p) return;
    // The same link as before keeps its linking words.
    edges.push(oldEdges.get(key(p, r.id)) ?? { id: newId(), source: p, target: r.id });
    added.add(key(p, r.id));
  });
  // Cross-links stay while both concepts are still there, and only if they
  // point back up the list to an indented line: any other would be followed
  // first and hang that concept somewhere else than the list says.
  const line = new Map(lines.map((r, i) => [r.id, i]));
  for (const e of map.edges) {
    if (treeEdges.has(e.id) || added.has(key(e.source, e.target))) continue;
    const [from, to] = [line.get(e.source), line.get(e.target)];
    if (from !== undefined && to !== undefined && to < from && lines[to].depth > 0) edges.push(e);
  }
  return { nodes, edges };
}
