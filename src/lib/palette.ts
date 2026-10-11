import type { MapEdge, MapNode } from '../types/map';
import { layoutTree } from './ladder';

/**
 * Soft, high-contrast-with-black node colours. Order matters: «Riordina e
 * colora» gives them to the branches in turn, each close to its line's
 * colour (see --branch-n in theme.css).
 */
export const NODE_COLORS = ['#a0e7e5', '#ffd166', '#cdb4db', '#b4f8c8', '#ffaebc', '#fbe7c6'] as const;

/** A new concept is white: colour is the child's choice, or «Riordina e colora». */
export const DEFAULT_COLOR = '#ffffff';

/**
 * «Riordina e colora»: each branch of the main concept, with everything
 * under it, in its own colour; the main concept white. Branches are counted
 * as the sheet lays them out, so the colours follow the lines'.
 */
export function branchColors(nodes: Pick<MapNode, 'id' | 'position'>[], edges: Pick<MapEdge, 'id' | 'source' | 'target'>[]): Record<string, string> {
  const colors: Record<string, string> = {};
  if (nodes.length === 0) return colors;
  const { kids, tops } = layoutTree(nodes, edges);
  const [root, ...others] = tops;
  const paint = (id: string, color: string) => {
    colors[id] = color;
    for (const e of kids.get(id) ?? []) paint(e.target, color);
  };
  colors[root] = DEFAULT_COLOR;
  [...(kids.get(root) ?? []).map((e) => e.target), ...others].forEach((id, i) => paint(id, NODE_COLORS[i % NODE_COLORS.length]));
  return colors;
}

/** Names read aloud by screen readers instead of the colour code. */
export const COLOR_NAMES: Record<string, string> = {
  '#ffd166': 'giallo',
  '#a0e7e5': 'azzurro',
  '#b4f8c8': 'verde',
  '#ffaebc': 'rosa',
  '#cdb4db': 'lilla',
  '#fbe7c6': 'crema',
  '#ffffff': 'bianco',
};
