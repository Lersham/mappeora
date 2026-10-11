import type { ConceptMap } from '../../types/map';
import { NEW_CONCEPT_LABEL } from '../../lib/mapFactory';
import { spanningTree } from '../../lib/tree';

/** The title of the map the tutorial makes. */
export const TUTORIAL_TITLE = 'La mia prima mappa';

/** The button a step asks for: it is highlighted (and «Altro» too, when it is in there). */
export type TutorialTarget =
  | 'concetto'
  | 'detta'
  | 'leggi'
  | 'ripassa'
  | 'scaletta'
  | 'libro'
  | 'sposta'
  | 'riordina'
  | 'annulla'
  | 'salva'
  | 'aspetto'
  | 'immagine'
  | 'collega'
  | 'cambia-ramo'
  | 'elimina'
  | 'solo-mappa';

/** A window the editor opens: «Ripassa», «Stampa e manda»… ('settings' is «Aspetto», 'focus' «Solo la mappa», 'style' «Immagine e colore»). */
export type TutorialTool = 'outline' | 'photo' | 'review' | 'export' | 'settings' | 'focus' | 'style';

/** What the child has done so far, as the tutorial sees it. */
export interface TutorialProgress {
  map: ConceptMap;
  /** The map has been read aloud since the step began. */
  read: boolean;
  /** How many times each tool has been opened, since the editor opened. */
  used: Partial<Record<TutorialTool, number>>;
}

export interface TutorialStep {
  title: string;
  text: string;
  target?: TutorialTarget;
  /** The map doesn't allow the step yet: what to say and point at instead. */
  first?(map: ConceptMap): Pick<TutorialStep, 'text' | 'target'> | undefined;
  /** Done: `now` shows the child did what the step asks, compared with `start`. */
  done?(now: TutorialProgress, start: TutorialProgress): boolean;
}

/** What a step says and points at, on the map as it is now. */
export function guideFor(step: TutorialStep, map: ConceptMap | null): Pick<TutorialStep, 'text' | 'target'> {
  return (map && step.first?.(map)) || step;
}

/** Every concept is already linked to every other one: no new line can be drawn. */
function allLinked(map: ConceptMap): boolean {
  const pairs = new Set(map.edges.map((e) => [e.source, e.target].sort().join(' ')));
  const n = map.nodes.length;
  return pairs.size >= (n * (n - 1)) / 2;
}

/** Lines drawn (> 0) or taken away (< 0) since `start`, leaving out the ones that come and go with a concept. */
function linesChanged(now: TutorialProgress, start: TutorialProgress): number {
  return now.map.edges.length - start.map.edges.length - (now.map.nodes.length - start.map.nodes.length);
}

/** The tool has been opened since the step began. */
const opened = (tool: TutorialTool) => (now: TutorialProgress, start: TutorialProgress) =>
  (now.used[tool] ?? 0) > (start.used[tool] ?? 0);

/** Fewer than two concepts besides the main idea: nothing to move, or to put under another. */
const needsTwo = (map: ConceptMap) =>
  map.nodes.length < 3
    ? {
        text: 'Per questo passo servono almeno due concetti oltre all’idea principale. Premi «Concetto», in basso, e scrivi un’idea nuova, per esempio «Il giorno». Poi ti dico cosa fare.',
        target: 'concetto' as const,
      }
    : undefined;

/** The main idea: the oval, or else the first concept nothing points to. */
function mainIdea(map: ConceptMap) {
  const targets = new Set(map.edges.map((e) => e.target));
  return map.nodes.find((n) => n.shape === 'ellisse') ?? map.nodes.find((n) => !targets.has(n.id)) ?? map.nodes[0];
}

/** Colours go by branch: with fewer than two under the main idea there is nothing to tell apart. */
const needsTwoBranches = (map: ConceptMap) => {
  const root = mainIdea(map);
  if (!root) return undefined;
  const { parent } = spanningTree(map);
  const branches = map.nodes.filter((n) => parent.get(n.id) === root.id).length;
  return branches >= 2
    ? undefined
    : {
        text: `Per vedere i colori servono almeno due rami sotto l’idea principale. Tocca «${root.label}» per sceglierla, poi premi «Concetto», in basso, e scrivi un’idea nuova, per esempio «Il giorno». Poi ti dico come colorare.`,
        target: 'concetto' as const,
      };
};

/** Where to find a tool that may not fit in the bottom bar. */
const IN_ALTRO = 'Se non lo vedi, è dentro «Altro», l’ultimo pulsante in basso a destra (quello con le tre righe).';
const TOP_OR_ALTRO = 'È in alto a destra; sul telefono è dentro «Altro», l’ultimo pulsante in basso a destra (quello con le tre righe).';

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
    text: 'Il riquadro nuovo è già pronto: scrivi un’idea che c’entra, per esempio «Luce e calore», e premi Invio. Per cambiarlo dopo: tieni premuto il riquadro, o toccalo e premi «Nome».',
    done: (now) => now.map.nodes.length > 1 && !now.map.nodes.some((n) => n.label === NEW_CONCEPT_LABEL),
  },
  {
    title: 'Tocca, ritocca, tieni premuto',
    text: 'Su un riquadro funzionano tre gesti. Un tocco lo sceglie: in basso compare la sua barra. Un altro tocco sullo stesso riquadro, anche dopo un po’, apre «Immagine e colore». Tenerlo premuto e poi alzare il dito serve a cambiarne il nome. Prova: tocca «Luce e calore» e poi toccalo ancora.',
    done: opened('style'),
  },
  {
    title: 'Le parole che collegano',
    text: 'Tocca il «+» sulla linea tra i due riquadri (o la linea stessa) e scegli come sono legati, per esempio «serve per» o «causa». Così la mappa si legge come una frase.',
    done: (now, start) =>
      now.map.edges.some((e) => !!e.label?.trim() && start.map.edges.find((s) => s.id === e.id)?.label !== e.label),
  },
  {
    title: 'Ascolta la mappa',
    text: 'Premi «Leggi»: MappAmi legge la mappa ad alta voce e illumina il riquadro che sta leggendo. Mentre legge, al posto di «Leggi» c’è «Stop»: premilo per fermarla.',
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
    title: 'Collega due idee',
    text: 'Quando tocchi un riquadro, in basso compare la sua barra: Nome, Immagine, Collega, Cambia ramo, Elimina. Tutto quello che serve per quel riquadro è lì. Premi «Collega» e poi tocca un riquadro che non è ancora unito a questo: nasce una freccia tra i due.',
    target: 'collega',
    first: (map) =>
      allLinked(map)
        ? {
            text: 'I tuoi riquadri sono già tutti collegati: per fare una freccia nuova ne serve un altro. Premi «Concetto» e scrivi un’idea, per esempio «Le stelle». Poi ti dico come collegarla.',
            target: 'concetto',
          }
        : undefined,
    // A new concept comes with its own line: only a line more than that counts.
    done: (now, start) => linesChanged(now, start) > 0,
  },
  {
    title: 'Togli una freccia',
    text: 'Una freccia sbagliata si toglie: tocca il «+» sulla freccia (o la freccia stessa) e premi «Togli freccia». I due riquadri restano al loro posto.',
    first: (map) =>
      map.edges.length
        ? undefined
        : {
            text: 'Qui non ci sono ancora frecce. Premi «Concetto»: nasce un riquadro, già unito da una freccia. Poi ti dico come toglierla.',
            target: 'concetto',
          },
    // Not a concept deleted with its lines, nor one moved under another («Cambia ramo»).
    done: (now, start) =>
      linesChanged(now, start) < 0 && start.map.nodes.every((s) => now.map.nodes.some((n) => n.id === s.id)),
  },
  {
    title: 'Rimetti la freccia',
    text: 'Hai cambiato idea? Premi «Annulla», in alto: la freccia che hai tolto torna al suo posto. «Annulla» disfa l’ultima cosa che hai fatto, qualunque sia, e «Ripeti», lì accanto, la rifà.',
    target: 'annulla',
    done: (now, start) => linesChanged(now, start) > 0,
  },
  {
    title: 'Cambia ramo',
    text: 'Un concetto è finito sotto l’idea sbagliata? Toccalo e premi «Cambia ramo», nella barra in basso. Poi tocca il concetto sotto cui metterlo: si sposta lì, con tutto quello che ha sotto. Per lasciar perdere, tocca un punto vuoto della mappa.',
    target: 'cambia-ramo',
    first: needsTwo,
    done: (now, start) => {
      const before = spanningTree(start.map).parent;
      const after = spanningTree(now.map).parent;
      return start.map.nodes.some((n) => before.has(n.id) && after.has(n.id) && before.get(n.id) !== after.get(n.id));
    },
  },
  {
    title: 'Metti i concetti dove vuoi',
    text: `I concetti si mettono in fila da soli, uno sotto l’altro come un albero. Per cambiare l’ordine di due fratelli, trascina un concetto a destra o a sinistra. Per metterli proprio dove vuoi tu, premi «Sposta», in basso, e poi trascinali. ${IN_ALTRO}`,
    target: 'sposta',
    first: (map) =>
      map.freeLayout
        ? { text: 'Hai già premuto «Sposta»: ora trascina un concetto dove vuoi, con il dito o con il mouse.' }
        : undefined,
    done: (now, start) =>
      (!!now.map.freeLayout && !start.map.freeLayout) ||
      now.map.nodes.some((n) => {
        const s = start.map.nodes.find((x) => x.id === n.id);
        return !!s && (s.position.x !== n.position.x || s.position.y !== n.position.y);
      }),
  },
  {
    title: 'Bianca o colorata',
    text: `La tua mappa è bianca, come un foglio nuovo. Per colorarla premi «Riordina», in basso: la mappa torna in ordine e in alto compare «🎨 Colora i rami». Premilo: ogni ramo prende un colore pastello, uguale per tutti i suoi concetti. Non ti piace? Premi «Annulla». ${IN_ALTRO}`,
    target: 'riordina',
    first: needsTwoBranches,
    done: (now, start) =>
      now.map.nodes.some((n) => {
        const s = start.map.nodes.find((x) => x.id === n.id);
        return !!s && (s.color ?? '') !== (n.color ?? '');
      }),
  },
  {
    title: 'Un colore tutto suo',
    text: 'Puoi colorare anche un concetto solo. Toccalo una volta per sceglierlo, poi toccalo ancora (oppure premi «Immagine», in basso): si apre «Immagine e colore». Scegli un colore e premi «Fatto».',
    target: 'immagine',
    done: (now, start) =>
      now.map.nodes.some((n) => {
        const s = start.map.nodes.find((x) => x.id === n.id);
        return !!s && (s.color ?? '') !== (n.color ?? '');
      }),
  },
  {
    title: 'Togli un concetto',
    text: 'Tocca un concetto e premi «Elimina», l’ultimo pulsante della barra in basso. Se ha altri concetti sotto, ti chiede se togliere solo lui o tutto il ramo. Ti sei sbagliato? «Annulla», in alto, lo rimette al suo posto.',
    target: 'elimina',
    first: (map) =>
      map.nodes.length < 2
        ? { text: 'Qui c’è solo l’idea principale. Premi «Concetto» per farne uno nuovo: poi lo togliamo.', target: 'concetto' }
        : undefined,
    done: (now, start) => now.map.nodes.length < start.map.nodes.length,
  },
  {
    title: 'La scaletta',
    text: `Premi «Scaletta», in basso: la mappa diventa un elenco, un concetto per riga, e puoi scriverla lì come un riassunto. Le frecce a destra e a sinistra mettono una riga sotto quella di sopra o la riportano indietro. «Fatto» la rimette nella mappa. ${IN_ALTRO}`,
    target: 'scaletta',
    done: opened('outline'),
  },
  {
    title: 'Dal libro',
    text: `Premi «Dal libro», in basso: fotografi una pagina, MappAmi legge il testo e tu tocchi le parole importanti, che diventano concetti della mappa. Se ora non hai un libro, guarda e premi «Chiudi». ${IN_ALTRO}`,
    target: 'libro',
    done: opened('photo'),
  },
  {
    title: 'Ripassa',
    text: 'Premi «Ripassa», in basso, per studiare la mappa. «Un passo alla volta»: i concetti appaiono uno alla volta, letti ad alta voce. «Indovina»: il concetto è nascosto e provi a ricordarlo. «Interrogazione»: la mappa a schermo intero, per spiegarla. Per tornare qui premi «Esci», in alto.',
    target: 'ripassa',
    done: opened('review'),
  },
  {
    title: 'Stampa e manda',
    text: `La mappa si salva da sola, mentre lavori. «Stampa e manda» serve a portarla fuori: «PDF da stampare» per il quaderno, «Immagine» da mandare in chat, «File modificabile» per continuarla su un altro dispositivo. ${TOP_OR_ALTRO}`,
    target: 'salva',
    done: opened('export'),
  },
  {
    title: 'Come la vedi',
    text: `Premi «Aspetto»: scegli il carattere (anche OpenDyslexic), lo sfondo, la grandezza del testo, il maiuscolo e la voce che legge. Vale per tutte le mappe. ${TOP_OR_ALTRO}`,
    target: 'aspetto',
    done: opened('settings'),
  },
  {
    title: 'Solo la mappa',
    text: 'In basso a sinistra, sulla mappa, ci sono i pulsanti per guardarla: il riquadro la fa vedere tutta, «+» e «−» la ingrandiscono e rimpiccioliscono (sul tablet basta allargare o stringere due dita). L’ultimo, con la lavagna, nasconde tutti i pulsanti: solo la mappa, per studiarla o mostrarla alla classe. Premilo; poi «Mostra i pulsanti», in alto a destra, li fa tornare.',
    target: 'solo-mappa',
    done: opened('focus'),
  },
  {
    title: 'Ce l’hai fatta!',
    text: 'Ora conosci tutti i pulsanti. Il titolo, in alto, si cambia toccandolo. Con «Mappe», in alto a sinistra, torni all’elenco: la tua mappa è lì, salvata. Quando premi «Fine» i colori se ne vanno e la mappa torna bianca: per ricolorarla, «Riordina» e poi «Colora i rami». Puoi rifare questo giro quando vuoi: nella pagina iniziale premi «Impara facendo».',
  },
];
