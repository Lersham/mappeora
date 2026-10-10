import type { ConceptMap } from '../../types/map';
import { NEW_CONCEPT_LABEL } from '../../lib/mapFactory';

/** The title of the map the tutorial makes. */
export const TUTORIAL_TITLE = 'La mia prima mappa';

/** The toolbar button a step asks for: it is highlighted. */
export type TutorialTarget = 'concetto' | 'detta' | 'leggi' | 'immagine';

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
    text: 'Tieni premuto il riquadro al centro, poi alza il dito, e scrivi di che cosa parla la tua mappa. Per esempio: «Il sole». Poi premi Invio.',
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
    text: 'Il riquadro nuovo è già pronto: scrivi un’idea che c’entra, per esempio «Luce e calore», e premi Invio. Per cambiare un nome più tardi, tieni premuto il riquadro.',
    done: (now) => now.map.nodes.length > 1 && !now.map.nodes.some((n) => n.label === NEW_CONCEPT_LABEL),
  },
  {
    title: 'Le parole che collegano',
    text: 'Tocca il «+» sulla linea tra i due riquadri (o la linea stessa) e scegli come sono legati, per esempio «serve per» o «causa». Così la mappa si legge come una frase.',
    done: (now, start) =>
      now.map.edges.some((e) => !!e.label?.trim() && start.map.edges.find((s) => s.id === e.id)?.label !== e.label),
  },
  {
    title: 'Ascolta la mappa',
    text: 'Premi «Leggi»: MappAmi legge la mappa ad alta voce e illumina il riquadro che sta leggendo.',
    target: 'leggi',
    done: (now) => now.read,
  },
  {
    title: 'Detta un concetto',
    text: 'Premi «Detta» e di’ una parola, per esempio «Estate». MappAmi la scrive per te in un riquadro nuovo. Se non puoi usare il microfono, premi «Salta».',
    target: 'detta',
    done: (now, start) => now.map.nodes.length > start.map.nodes.length,
  },
  {
    title: 'Un’immagine',
    text: 'Tocca un riquadro e premi «Immagine». Scegli un disegno, oppure apri «Foto e Google» e premi «Cerca su Google»: tieni premuta l’immagine che ti piace, scegli «Copia immagine» e torna qui. L’immagine arriva da sola; se non arriva, premi «Incolla immagine».',
    target: 'immagine',
    done: (now, start) =>
      now.map.nodes.some((n) => n.image && n.image.ref !== start.map.nodes.find((s) => s.id === n.id)?.image?.ref),
  },
  {
    title: 'Ce l’hai fatta!',
    text: 'Hai costruito la tua prima mappa. Si salva da sola: la ritrovi in «Le mie mappe». Con «Ripassa» la ripeti un concetto alla volta, con «Salva» la stampi o ne fai un’immagine.',
  },
];
