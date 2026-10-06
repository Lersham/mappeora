import type { ConceptMap } from '../../types/map';
import { NEW_CONCEPT_LABEL } from '../../lib/mapFactory';

/** The title of the map the tutorial makes. */
export const TUTORIAL_TITLE = 'La mia prima mappa';

/** The toolbar button a step asks for: it is highlighted. */
export type TutorialTarget = 'concetto' | 'detta' | 'leggi';

/** What the child has done so far, as the tutorial sees it. */
export interface TutorialProgress {
  map: ConceptMap;
  /** The map has been read aloud since the step began. */
  read: boolean;
}

export interface TutorialStep {
  title: string;
  text: string;
  target?: TutorialTarget;
  /** Done: `now` shows the child did what the step asks, compared with `start`. */
  done?(now: TutorialProgress, start: TutorialProgress): boolean;
}

export const TUTORIAL_STEPS: TutorialStep[] = [
  {
    title: 'L’idea principale',
    text: 'Tocca due volte il riquadro al centro e scrivi di che cosa parla la tua mappa. Per esempio: «Il sole». Poi premi Invio.',
    done: (now, start) => {
      const root = start.map.nodes[0];
      const label = now.map.nodes.find((n) => n.id === root?.id)?.label;
      return !!root && label !== undefined && label !== root.label;
    },
  },
  {
    title: 'Un nuovo concetto',
    text: 'Premi «Concetto»: sotto l’idea principale nasce un riquadro nuovo, già collegato.',
    target: 'concetto',
    done: (now, start) => now.map.nodes.length > start.map.nodes.length,
  },
  {
    title: 'Dagli un nome',
    text: 'Tocca due volte «Nuovo concetto» e scrivi un’idea che c’entra. Per esempio: «Luce e calore».',
    done: (now) => now.map.nodes.length > 1 && !now.map.nodes.some((n) => n.label === NEW_CONCEPT_LABEL),
  },
  {
    title: 'Le parole che collegano',
    text: 'Tocca la linea tra i due riquadri e scegli come sono legati, per esempio «serve per» o «causa». Così la mappa si legge come una frase.',
    done: (now, start) =>
      now.map.edges.some((e) => !!e.label?.trim() && start.map.edges.find((s) => s.id === e.id)?.label !== e.label),
  },
  {
    title: 'Ascolta la mappa',
    text: 'Premi «Leggi»: Mappeora legge la mappa ad alta voce e illumina il riquadro che sta leggendo.',
    target: 'leggi',
    done: (now) => now.read,
  },
  {
    title: 'Detta un concetto',
    text: 'Premi «Detta» e di’ una parola, per esempio «Estate». Mappeora la scrive per te in un riquadro nuovo. Se non puoi usare il microfono, premi «Salta».',
    target: 'detta',
    done: (now, start) => now.map.nodes.length > start.map.nodes.length,
  },
  {
    title: 'Ce l’hai fatta!',
    text: 'Hai costruito la tua prima mappa. Si salva da sola: la ritrovi in «Le mie mappe». Con «Ripassa» la ripeti un concetto alla volta, con «Salva» la stampi o ne fai un’immagine.',
  },
];
