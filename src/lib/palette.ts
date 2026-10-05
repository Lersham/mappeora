/** Soft, high-contrast-with-black node colours. Order matters: index = depth. */
export const NODE_COLORS = ['#ffd166', '#a0e7e5', '#b4f8c8', '#ffaebc', '#cdb4db', '#fbe7c6'] as const;

export function colorForDepth(depth: number): string {
  return NODE_COLORS[depth % NODE_COLORS.length];
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
