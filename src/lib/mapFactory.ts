import type { ConceptMap, MapTemplate } from '../types/map';
import { newId } from './id';
import { buildTemplate } from './templates';

export function createMap(title = 'Nuova mappa', template: MapTemplate = 'libera'): ConceptMap {
  const now = Date.now();
  return { id: newId(), title, createdAt: now, updatedAt: now, template, ...buildTemplate(template, title) };
}
