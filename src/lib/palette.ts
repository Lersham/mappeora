import type { MapEdge, MapNode } from '../types/map';
import { layoutTree } from './ladder';

/**
 * Soft, high-contrast-with-black node colours. Order matters: «Colora i
 * rami» gives them to the branches in turn, each close to its line's
 * colour (see --branch-n in theme.css).
 */
export const NODE_COLORS = ['#a0e7e5', '#ffd166', '#cdb4db', '#b4f8c8', '#ffaebc', '#fbe7c6'] as const;

/** More colours to choose by hand (not used by «Colora i rami»): light too, under dark words. */
export const MORE_COLORS = ['#ffc49b', '#ff9e9e', '#a9c8ff', '#d4b8ff', '#d9f2a0', '#e6cfae', '#dedede'] as const;

/**
 * Colours for a single word of a concept: dark enough to read on every
 * concept colour, as the usual dark grey words are.
 */
export const TEXT_COLORS = ['#b71c1c', '#9a3c00', '#1b5e20', '#0d47a1', '#6a1b9a', '#ad1457', '#5d4037'] as const;

/** The usual colour of a concept's words (see .concept-node in app.css). */
export const TEXT_COLOR = '#1f2430';

/** A new concept is white: colour is the child's choice, or «Colora i rami». */
export const DEFAULT_COLOR = '#ffffff';

/**
 * «Colora i rami»: each branch of the main concept, with everything
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
  '#ffc49b': 'arancione',
  '#ff9e9e': 'rosso',
  '#a9c8ff': 'blu',
  '#d4b8ff': 'viola',
  '#d9f2a0': 'verde chiaro',
  '#e6cfae': 'nocciola',
  '#dedede': 'grigio',
};

/** Names of the word colours, read aloud instead of the code. */
export const TEXT_COLOR_NAMES: Record<string, string> = {
  '#b71c1c': 'rosso',
  '#9a3c00': 'arancione',
  '#1b5e20': 'verde',
  '#0d47a1': 'blu',
  '#6a1b9a': 'viola',
  '#ad1457': 'fucsia',
  '#5d4037': 'marrone',
  '#1f2430': 'nero',
};
