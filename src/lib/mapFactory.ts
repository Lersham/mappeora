import type { ConceptMap, MapTemplate } from '../types/map';
import { newId } from './id';
import { buildTemplate } from './templates';

/** The title of a map nobody has named yet. */
export const NEW_MAP_TITLE = 'Nuova mappa';

/** The title of the map the tutorial makes (here, not in features/tutorial, so the home does not load the tutorial). */
export const TUTORIAL_TITLE = 'La mia prima mappa';

/** The text of a concept just added, before the child names it. */
export const NEW_CONCEPT_LABEL = 'Nuovo concetto';

export function createMap(title = NEW_MAP_TITLE, template: MapTemplate = 'libera'): ConceptMap {
  const now = Date.now();
  return { id: newId(), title, createdAt: now, updatedAt: now, template, ...buildTemplate(template, title) };
}
