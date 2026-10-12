import { create } from 'zustand';
import type { ReadingStep } from '../lib/readingOrder';

/**
 * - "passo": the map is revealed one concept at a time, read aloud;
 * - "quiz": like "passo", but the concept shows "?" until "Scopri";
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
  /** Ripetimi: «Ho finito» was pressed, the missing concepts are shown. */
  done: boolean;

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
    }),
  next: () => set((s) => (s.index < s.steps.length - 1 ? { index: s.index + 1, revealed: s.mode !== 'quiz' } : {})),
  prev: () => set((s) => (s.index > 0 ? { index: s.index - 1, revealed: true } : {})),
  goTo: (index) => set((s) => (index >= 0 && index < s.steps.length ? { index, revealed: true } : {})),
  reveal: () => set({ revealed: true }),
  exit: () => set({ active: false, steps: [], order: {}, index: 0, heard: {}, done: false }),
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
}));

/** How a node should look during review. */
export type ReviewVisibility = 'normal' | 'hidden' | 'current' | 'mystery' | 'dim' | 'heard';

export function reviewVisibility(
  s: Pick<ReviewState, 'active' | 'mode' | 'order' | 'index' | 'revealed'> & Partial<Pick<ReviewState, 'heard' | 'done'>>,
  nodeId: string,
): ReviewVisibility {
  if (!s.active) return 'normal';
  const i = Object.hasOwn(s.order, nodeId) ? s.order[nodeId] : undefined;
  // Named concepts light up; at the end the forgotten ones are ringed.
  // The map stays readable: only the explained concepts are marked.
  if (s.mode === 'ripetimi') return i === undefined ? 'normal' : s.heard && Object.hasOwn(s.heard, nodeId) ? 'heard' : s.done ? 'current' : 'normal';
  if (s.mode === 'interrogazione') return i === s.index ? 'current' : 'dim';
  if (i === undefined || i > s.index) return 'hidden';
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
