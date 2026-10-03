import type { ConceptMap } from '../types/map';
import { newId } from './id';
import { colorForDepth } from './palette';

export function createEmptyMap(title = 'Nuova mappa'): ConceptMap {
  const now = Date.now();
  return {
    id: newId(),
    title,
    createdAt: now,
    updatedAt: now,
    template: 'libera',
    nodes: [
      {
        id: newId(),
        label: title,
        position: { x: 0, y: 0 },
        color: colorForDepth(0),
        shape: 'ellisse',
      },
    ],
    edges: [],
  };
}
