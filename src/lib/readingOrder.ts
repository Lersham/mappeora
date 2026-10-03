import type { ConceptMap, MapNode } from '../types/map';

export interface ReadingStep {
  nodeId: string;
  /** Text spoken for this step, e.g. "Acqua. È formata da: idrogeno". */
  text: string;
}

/**
 * Breadth-first reading order starting from root nodes (nodes with no
 * incoming edge), so a map is read "from the general to the particular".
 * Nodes in cycles or disconnected islands are appended at the end.
 */
export function readingOrder(map: Pick<ConceptMap, 'nodes' | 'edges'>): ReadingStep[] {
  const byId = new Map(map.nodes.map((n) => [n.id, n]));
  const hasParent = new Set(map.edges.map((e) => e.target));
  const roots = map.nodes.filter((n) => !hasParent.has(n.id));
  const queue: MapNode[] = roots.length > 0 ? [...roots] : map.nodes.slice(0, 1);
  const visited = new Set<string>();
  const steps: ReadingStep[] = [];

  const visit = (start: MapNode) => {
    queue.push(start);
    while (queue.length > 0) {
      const node = queue.shift()!;
      if (visited.has(node.id)) continue;
      visited.add(node.id);
      const incoming = map.edges.find((e) => e.target === node.id && visited.has(e.source));
      const prefix = incoming?.label ? `${incoming.label}: ` : '';
      steps.push({ nodeId: node.id, text: `${prefix}${node.label}` });
      for (const edge of map.edges) {
        if (edge.source !== node.id) continue;
        const child = byId.get(edge.target);
        if (child && !visited.has(child.id)) queue.push(child);
      }
    }
  };

  // Drain the initial queue, then pick up anything left over.
  const initial = queue.splice(0);
  for (const n of initial) visit(n);
  for (const n of map.nodes) if (!visited.has(n.id)) visit(n);
  return steps;
}
