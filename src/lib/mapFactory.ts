import type { ConceptMap, MapTemplate } from '../types/map';
import { newId } from './id';
import { buildTemplate } from './templates';

/** The title of a map nobody has named yet. */
export const NEW_MAP_TITLE = 'Nuova mappa';

export function createMap(title = NEW_MAP_TITLE, template: MapTemplate = 'libera'): ConceptMap {
  const now = Date.now();
  return { id: newId(), title, createdAt: now, updatedAt: now, template, ...buildTemplate(template, title) };
}
