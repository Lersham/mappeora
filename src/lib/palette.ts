/** Soft, high-contrast-with-black node colours. Order matters: index = depth. */
export const NODE_COLORS = ['#ffd166', '#a0e7e5', '#b4f8c8', '#ffaebc', '#cdb4db', '#fbe7c6'] as const;

export function colorForDepth(depth: number): string {
  return NODE_COLORS[depth % NODE_COLORS.length];
}
