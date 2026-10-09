import type { ConceptMap, MapNode } from '../types/map';
import { ladderLayout } from './ladder';

export interface ReadingStep {
  nodeId: string;
  /**
   * Text spoken for this step. With linking words the whole proposition,
   * as a concept map is meant to be read: "Acqua è formata da Idrogeno".
   * It always ends with the concept's own name (see useReadAloud: offset).
   */
  text: string;
}

const oneLine = (text: string) => text.replace(/\s+/g, ' ').trim();

const step = (node: MapNode, linkWords?: string, from?: MapNode): ReadingStep => ({
  nodeId: node.id,
  text: linkWords?.trim() ? `${from ? `${oneLine(from.label)} ` : ''}${oneLine(linkWords)} ${node.label}` : node.label,
});

/**
 * Reading order starting from root nodes (nodes with no incoming edge), so a
 * map is read "from the general to the particular". "Albero" maps are read
 * level by level (breadth first); "foglio" maps branch by branch, top to bottom, as
 * they appear on screen (depth first). Nodes in cycles or disconnected
 * islands are read at the end.
 */
export function readingOrder(map: Pick<ConceptMap, 'nodes' | 'edges'>, opts: { depthFirst?: boolean } = {}): ReadingStep[] {
  if (opts.depthFirst) {
    const { order, treeEdges } = ladderLayout(map.nodes, map.edges);
    const byId = new Map(map.nodes.map((n) => [n.id, n]));
    const incoming = new Map(map.edges.filter((e) => treeEdges.has(e.id)).map((e) => [e.target, e]));
    return order.map((id) => {
      const via = incoming.get(id);
      return step(byId.get(id)!, via?.label, via && byId.get(via.source));
    });
  }

  const byId = new Map(map.nodes.map((n) => [n.id, n]));
  const hasParent = new Set(map.edges.map((e) => e.target));
  const visited = new Set<string>();
  const steps: ReadingStep[] = [];

  // One level at a time across every root («Causa 1», «Causa 2», then the
  // effect they share), then whatever is left over.
  const visit = (seeds: MapNode[]) => {
    const queue = [...seeds];
    while (queue.length > 0) {
      const node = queue.shift()!;
      if (visited.has(node.id)) continue;
      visited.add(node.id);
      const incoming = map.edges.find((e) => e.target === node.id && visited.has(e.source));
      steps.push(step(node, incoming?.label, incoming && byId.get(incoming.source)));
      for (const edge of map.edges) {
        if (edge.source !== node.id) continue;
        const child = byId.get(edge.target);
        if (child && !visited.has(child.id)) queue.push(child);
      }
    }
  };

  visit(map.nodes.filter((n) => !hasParent.has(n.id)));
  for (const n of map.nodes) if (!visited.has(n.id)) visit([n]);
  return steps;
}
