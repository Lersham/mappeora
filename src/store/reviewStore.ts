import { create } from 'zustand';
import type { ReadingStep } from '../lib/readingOrder';

/**
 * - "passo": the map is revealed one concept at a time, read aloud;
 * - "quiz": like "passo", but the concept shows "?" until "Scopri", and the
 *   child then says whether they knew it (kept for this session only);
 * - "interrogazione": the whole map stays visible and the child walks
 *   through it, one concept in focus at a time, while explaining it;
 * - "ripetimi": the child explains the map aloud and the concepts named
 *   light up; at the end the ones left out are shown.
 */
export type ReviewMode = 'passo' | 'quiz' | 'interrogazione' | 'ripetimi';

interface ReviewState {
  active: boolean;
  mode: ReviewMode;
  steps: ReadingStep[];
  /** nodeId → position in `steps`, for O(1) lookups while rendering. */
  order: Record<string, number>;
  index: number;
  revealed: boolean;
  /** Ripetimi: the concepts the child has named so far. */
  heard: Record<string, true>;
  /** Ripetimi: «Ho finito» was pressed, the missing concepts are shown. Indovina: the last concept is done, the summary is shown. */
  done: boolean;
  /** Indovina: the concepts the child said they knew, and the ones they did not. A concept skipped with «Avanti» is in neither. */
  known: Record<string, true>;
  missed: Record<string, true>;
  /** Indovina after «Ripassa solo questi»: only some concepts are asked, the others stay on the map as clues. */
  scoped: boolean;

  start(steps: ReadingStep[], mode: ReviewMode): void;
  next(): void;
  prev(): void;
  goTo(index: number): void;
  reveal(): void;
  exit(): void;
  hear(ids: string[]): void;
  toggleHeard(id: string): void;
  finish(): void;
  retry(): void;
  /** Indovina: records whether the child knew the concept. */
  mark(id: string, knew: boolean): void;
  /** Indovina: records the answer for the concept in view, then goes on (or ends). */
  answer(knew: boolean): void;
  /** Indovina: asks again only the concepts the child did not know. */
  retryMissed(): void;
}

const noAnswers = { known: {}, missed: {}, scoped: false };

function withMark(s: Pick<ReviewState, 'order' | 'known' | 'missed'>, id: string, knew: boolean): Partial<ReviewState> {
  if (!Object.hasOwn(s.order, id)) return {};
  // Answering again (after «Indietro») replaces the first answer.
  const known = { ...s.known };
  const missed = { ...s.missed };
  delete known[id];
  delete missed[id];
  (knew ? known : missed)[id] = true;
  return { known, missed };
}

export const useReview = create<ReviewState>()((set) => ({
  active: false,
  mode: 'passo',
  steps: [],
  order: {},
  index: 0,
  revealed: false,
  heard: {},
  done: false,
  ...noAnswers,

  start: (steps, mode) =>
    set({
      active: steps.length > 0,
      mode,
      steps,
      order: Object.fromEntries(steps.map((s, i) => [s.nodeId, i])),
      index: 0,
      revealed: mode !== 'quiz',
      heard: {},
      done: false,
      ...noAnswers,
    }),
  next: () => set((s) => (s.index < s.steps.length - 1 ? { index: s.index + 1, revealed: s.mode !== 'quiz' } : {})),
  // From the Indovina summary, «Indietro» goes back to the last concept.
  prev: () => set((s) => (s.done && s.mode === 'quiz' ? { done: false } : s.index > 0 ? { index: s.index - 1, revealed: true } : {})),
  goTo: (index) => set((s) => (index >= 0 && index < s.steps.length ? { index, revealed: true } : {})),
  reveal: () => set({ revealed: true }),
  exit: () => set({ active: false, steps: [], order: {}, index: 0, heard: {}, done: false, ...noAnswers }),
  hear: (ids) =>
    set((s) => {
      const fresh = ids.filter((id) => !Object.hasOwn(s.heard, id) && Object.hasOwn(s.order, id));
      return fresh.length ? { heard: { ...s.heard, ...Object.fromEntries(fresh.map((id) => [id, true as const])) } } : {};
    }),
  toggleHeard: (id) =>
    set((s) => {
      if (!Object.hasOwn(s.order, id)) return {};
      const heard = { ...s.heard };
      if (Object.hasOwn(heard, id)) delete heard[id];
      else heard[id] = true;
      return { heard };
    }),
  finish: () => set({ done: true }),
  retry: () => set({ done: false }),
  mark: (id, knew) => set((s) => withMark(s, id, knew)),
  answer: (knew) =>
    set((s) => {
      const step = s.steps[s.index];
      if (!s.active || s.mode !== 'quiz' || s.done || !s.revealed || !step) return {};
      const marked = withMark(s, step.nodeId, knew);
      if (s.index < s.steps.length - 1) return { ...marked, index: s.index + 1, revealed: false };
      return { ...marked, done: true };
    }),
  retryMissed: () =>
    set((s) => {
      const steps = s.steps.filter((step) => Object.hasOwn(s.missed, step.nodeId));
      if (s.mode !== 'quiz' || steps.length === 0) return {};
      return {
        steps,
        order: Object.fromEntries(steps.map((st, i) => [st.nodeId, i])),
        index: 0,
        revealed: false,
        done: false,
        known: {},
        missed: {},
        scoped: true,
      };
    }),
}));

/** How a node should look during review. */
export type ReviewVisibility = 'normal' | 'hidden' | 'current' | 'mystery' | 'dim' | 'heard';

export function reviewVisibility(
  s: Pick<ReviewState, 'active' | 'mode' | 'order' | 'index' | 'revealed'> & Partial<Pick<ReviewState, 'heard' | 'done' | 'missed' | 'scoped'>>,
  nodeId: string,
): ReviewVisibility {
  if (!s.active) return 'normal';
  const i = Object.hasOwn(s.order, nodeId) ? s.order[nodeId] : undefined;
  // Named concepts light up; at the end the forgotten ones are ringed.
  // The map stays readable: only the explained concepts are marked.
  if (s.mode === 'ripetimi') return i === undefined ? 'normal' : s.heard && Object.hasOwn(s.heard, nodeId) ? 'heard' : s.done ? 'current' : 'normal';
  if (s.mode === 'interrogazione') return i === s.index ? 'current' : 'dim';
  // Indovina, summary: the whole map, the concepts to look at again ringed.
  if (s.mode === 'quiz' && s.done) return s.missed && Object.hasOwn(s.missed, nodeId) ? 'current' : 'normal';
  // «Ripassa solo questi»: the concepts not asked stay as clues.
  if (i === undefined) return s.mode === 'quiz' && s.scoped ? 'normal' : 'hidden';
  if (i > s.index) return 'hidden';
  if (i < s.index) return 'normal';
  return s.revealed ? 'current' : 'mystery';
}

/** Ripetimi, at the end: how many concepts were explained and which are missing. */
export function ripetimiSummary(s: Pick<ReviewState, 'steps' | 'heard'>): string {
  const missing = s.steps.filter((step) => !Object.hasOwn(s.heard, step.nodeId)).map((step) => step.text);
  const total = s.steps.length;
  if (total === 0) return 'Questa mappa non ha ancora concetti da spiegare.';
  if (missing.length === 0) return `Perfetto! Hai spiegato tutti i concetti: ${total} su ${total}.`;
  const explained = total - missing.length;
  return `Hai spiegato ${explained} ${explained === 1 ? 'concetto' : 'concetti'} su ${total}. ${missing.length === 1 ? 'Ti manca' : 'Ti mancano'}: ${missing.join(', ')}.`;
}

/** Indovina summary: this many names, then «e altri N»; the others are ringed on the map. */
const LISTED = 5;

/**
 * Indovina, at the end: how many concepts the child knew and which ones to
 * look at again. Only the concepts the child answered count; «name» gives the
 * words to show for a concept (its name, not the whole proposition read aloud).
 */
export function quizSummary(
  s: Pick<ReviewState, 'steps' | 'known' | 'missed'>,
  name: (step: ReadingStep) => string = (step) => step.text,
): string {
  const asked = s.steps.filter((step) => Object.hasOwn(s.known, step.nodeId) || Object.hasOwn(s.missed, step.nodeId));
  if (asked.length === 0) return 'Hai guardato tutti i concetti. Bravo!';
  const missed = s.steps.filter((step) => Object.hasOwn(s.missed, step.nodeId)).map(name);
  const total = asked.length;
  if (missed.length === 0) return `Perfetto! Li sapevi tutti: ${total} su ${total}.`;
  // Nobody is told they know «0 su 3».
  const known = total - missed.length;
  const head = known === 0 ? 'Nessun problema, ripassando si impara!' : `Ne sapevi ${known} su ${total}.`;
  // Never «e altri 1»: one more name takes the room of those words.
  const list = missed.length > LISTED + 1 ? `${missed.slice(0, LISTED).join(', ')} e altri ${missed.length - LISTED}` : missed.join(', ');
  return `${head} Da rivedere: ${list}.`;
}
