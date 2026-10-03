import type { MapEdge, MapNode, MapTemplate, NodeImage } from '../types/map';
import { newId } from './id';
import { colorForDepth } from './palette';

export interface TemplateInfo {
  id: MapTemplate;
  icon: string;
  name: string;
  /** Read aloud in the template picker, so keep it short and concrete. */
  description: string;
  /** Direction used by "Riordina" for maps made from this template. */
  direction: 'DOWN' | 'RIGHT';
}

export const TEMPLATES: TemplateInfo[] = [
  { id: 'libera', icon: '✏️', name: 'Libera', description: 'Una mappa vuota: parti da un concetto e aggiungi quello che vuoi.', direction: 'DOWN' },
  { id: '5w', icon: '❓', name: 'Le 5 W', description: 'Chi, che cosa, quando, dove, perché. Per storia, geografia e per riassumere un racconto.', direction: 'DOWN' },
  { id: 'causa-effetto', icon: '➡️', name: 'Causa ed effetto', description: 'Che cosa succede e perché: le cause sopra, le conseguenze sotto.', direction: 'DOWN' },
  { id: 'timeline', icon: '📅', name: 'Linea del tempo', description: 'Fatti in ordine: prima, poi, dopo, alla fine.', direction: 'RIGHT' },
  { id: 'confronto', icon: '⚖️', name: 'Confronto', description: 'Due cose a confronto: le differenze e che cosa hanno in comune.', direction: 'DOWN' },
];

export const templateInfo = (id: MapTemplate): TemplateInfo => TEMPLATES.find((t) => t.id === id) ?? TEMPLATES[0];

interface Spec {
  key: string;
  label: string;
  x: number;
  y: number;
  depth: number;
  emoji?: string;
  shape?: MapNode['shape'];
}

/** Hand-placed starting layouts, so the structure is obvious at a glance. */
function specs(template: MapTemplate, title: string): { nodes: Spec[]; edges: [string, string, string?][] } {
  switch (template) {
    case '5w':
      return {
        nodes: [
          { key: 'r', label: title, x: 400, y: 0, depth: 0, shape: 'ellisse' },
          { key: 'chi', label: 'Chi?', x: 0, y: 180, depth: 1, emoji: '👤' },
          { key: 'cosa', label: 'Che cosa?', x: 200, y: 180, depth: 1, emoji: '💬' },
          { key: 'quando', label: 'Quando?', x: 400, y: 180, depth: 1, emoji: '📅' },
          { key: 'dove', label: 'Dove?', x: 600, y: 180, depth: 1, emoji: '📍' },
          { key: 'perche', label: 'Perché?', x: 800, y: 180, depth: 1, emoji: '💡' },
        ],
        edges: [['r', 'chi'], ['r', 'cosa'], ['r', 'quando'], ['r', 'dove'], ['r', 'perche']],
      };
    case 'causa-effetto':
      return {
        nodes: [
          { key: 'c1', label: 'Causa 1', x: 0, y: 0, depth: 1 },
          { key: 'c2', label: 'Causa 2', x: 260, y: 0, depth: 1 },
          { key: 'r', label: title, x: 130, y: 180, depth: 0, shape: 'ellisse' },
          { key: 'e1', label: 'Effetto 1', x: 0, y: 360, depth: 2 },
          { key: 'e2', label: 'Effetto 2', x: 260, y: 360, depth: 2 },
        ],
        edges: [['c1', 'r', 'causa'], ['c2', 'r', 'causa'], ['r', 'e1', 'provoca'], ['r', 'e2', 'provoca']],
      };
    case 'timeline':
      return {
        nodes: [
          { key: 'r', label: title, x: 0, y: 0, depth: 0, shape: 'ellisse' },
          { key: 't1', label: 'Prima', x: 260, y: 0, depth: 1, emoji: '1️⃣' },
          { key: 't2', label: 'Poi', x: 500, y: 0, depth: 2, emoji: '2️⃣' },
          { key: 't3', label: 'Dopo', x: 740, y: 0, depth: 3, emoji: '3️⃣' },
          { key: 't4', label: 'Alla fine', x: 980, y: 0, depth: 4, emoji: '🏁' },
        ],
        edges: [['r', 't1'], ['t1', 't2', 'poi'], ['t2', 't3', 'poi'], ['t3', 't4', 'infine']],
      };
    case 'confronto':
      return {
        nodes: [
          { key: 'r', label: title, x: 220, y: 0, depth: 0, shape: 'ellisse' },
          { key: 'a', label: 'Prima cosa', x: 0, y: 170, depth: 1 },
          { key: 'b', label: 'Seconda cosa', x: 440, y: 170, depth: 1 },
          { key: 'da', label: 'Solo la prima…', x: 0, y: 340, depth: 2 },
          { key: 'db', label: 'Solo la seconda…', x: 440, y: 340, depth: 2 },
          { key: 'u', label: 'In comune…', x: 220, y: 500, depth: 3, emoji: '🤝' },
        ],
        edges: [['r', 'a'], ['r', 'b'], ['a', 'da', 'ha'], ['b', 'db', 'ha'], ['a', 'u'], ['b', 'u']],
      };
    case 'libera':
      return { nodes: [{ key: 'r', label: title, x: 0, y: 0, depth: 0, shape: 'ellisse' }], edges: [] };
  }
}

export function buildTemplate(template: MapTemplate, title: string): { nodes: MapNode[]; edges: MapEdge[] } {
  const { nodes, edges } = specs(template, title);
  const ids = new Map(nodes.map((n) => [n.key, newId()]));
  return {
    nodes: nodes.map((n) => {
      const image: NodeImage | undefined = n.emoji ? { kind: 'emoji', ref: n.emoji } : undefined;
      return {
        id: ids.get(n.key)!,
        label: n.label,
        position: { x: n.x, y: n.y },
        color: colorForDepth(n.depth),
        shape: n.shape ?? 'rettangolo',
        ...(image && { image }),
      };
    }),
    edges: edges.map(([s, t, label]) => ({
      id: newId(),
      source: ids.get(s)!,
      target: ids.get(t)!,
      ...(label && { label }),
    })),
  };
}
