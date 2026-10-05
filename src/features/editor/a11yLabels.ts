import type { AriaLabelConfig } from '@xyflow/react';

const DIRECTIONS: Record<string, string> = { up: 'in su', down: 'in giù', left: 'a sinistra', right: 'a destra' };

/** What a screen reader says about the map, in Italian like the rest of the app. */
export const MAP_ARIA_LABELS: Partial<AriaLabelConfig> = {
  'node.a11yDescription.default': 'Premi Invio per scegliere il concetto, poi Invio o F2 per cambiarne il nome e Canc per toglierlo.',
  'node.a11yDescription.keyboardDisabled':
    'Premi Invio per scegliere il concetto, poi Invio o F2 per cambiarne il nome, le frecce per spostarlo e Canc per toglierlo.',
  'node.a11yDescription.ariaLiveMessage': ({ direction }) => `Concetto spostato ${DIRECTIONS[direction] ?? direction}.`,
  'edge.a11yDescription.default': 'Premi Invio per scrivere la parola di collegamento, Canc per togliere il collegamento.',
  'controls.ariaLabel': 'Zoom',
  'controls.zoomIn.ariaLabel': 'Ingrandisci',
  'controls.zoomOut.ariaLabel': 'Rimpicciolisci',
  'controls.fitView.ariaLabel': 'Mostra tutta la mappa',
  'controls.interactive.ariaLabel': 'Blocca la mappa',
  'minimap.ariaLabel': 'Mappa in piccolo',
  'handle.ariaLabel': 'Punto da trascinare per collegare',
};

/** One line, for a name read aloud by a screen reader. */
export const spokenLabel = (label: string) => label.replace(/\s+/g, ' ').trim() || 'Concetto senza nome';

export function edgeAriaLabel(from: string, to: string, word?: string) {
  return `Collegamento da «${spokenLabel(from)}» a «${spokenLabel(to)}»${word?.trim() ? `: ${word.trim()}` : ''}`;
}
