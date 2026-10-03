import type { ELK } from 'elkjs/lib/elk-api';
import type { MapEdge, MapNode } from '../types/map';

// elkjs is ~1.4 MB: load it only the first time "Riordina" is pressed.
let elk: Promise<ELK> | undefined;
const getElk = () => (elk ??= import('elkjs/lib/elk.bundled.js').then((m) => new m.default()));

export const DEFAULT_NODE_SIZE = { width: 180, height: 72 };

export type NodeSizes = Record<string, { width: number; height: number } | undefined>;

/**
 * "Riordina": computes a top-down tree layout so children never have to
 * place and align nodes by hand. Returns new positions only.
 */
export async function autoLayout(
  nodes: MapNode[],
  edges: MapEdge[],
  sizes: NodeSizes = {},
): Promise<Record<string, { x: number; y: number }>> {
  const graph = await (await getElk()).layout({
    id: 'root',
    layoutOptions: {
      'elk.algorithm': 'layered',
      'elk.direction': 'DOWN',
      'elk.spacing.nodeNode': '48',
      'elk.layered.spacing.nodeNodeBetweenLayers': '80',
      'elk.edgeLabels.inline': 'true',
    },
    children: nodes.map((n) => ({ id: n.id, ...(sizes[n.id] ?? DEFAULT_NODE_SIZE) })),
    edges: edges.map((e) => ({ id: e.id, sources: [e.source], targets: [e.target] })),
  });
  const positions: Record<string, { x: number; y: number }> = {};
  for (const child of graph.children ?? []) {
    positions[child.id] = { x: child.x ?? 0, y: child.y ?? 0 };
  }
  return positions;
}
