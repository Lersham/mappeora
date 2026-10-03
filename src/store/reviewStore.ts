import { create } from 'zustand';
import type { ReadingStep } from '../lib/readingOrder';

/**
 * - "passo": the map is revealed one concept at a time, read aloud;
 * - "quiz": like "passo", but the concept shows "?" until "Scopri";
 * - "interrogazione": the whole map stays visible and the child walks
 *   through it, one concept in focus at a time, while explaining it.
 */
export type ReviewMode = 'passo' | 'quiz' | 'interrogazione';

interface ReviewState {
  active: boolean;
  mode: ReviewMode;
  steps: ReadingStep[];
  /** nodeId → position in `steps`, for O(1) lookups while rendering. */
  order: Record<string, number>;
  index: number;
  revealed: boolean;

  start(steps: ReadingStep[], mode: ReviewMode): void;
  next(): void;
  prev(): void;
  goTo(index: number): void;
  reveal(): void;
  exit(): void;
}

export const useReview = create<ReviewState>()((set) => ({
  active: false,
  mode: 'passo',
  steps: [],
  order: {},
  index: 0,
  revealed: false,

  start: (steps, mode) =>
    set({
      active: steps.length > 0,
      mode,
      steps,
      order: Object.fromEntries(steps.map((s, i) => [s.nodeId, i])),
      index: 0,
      revealed: mode !== 'quiz',
    }),
  next: () => set((s) => (s.index < s.steps.length - 1 ? { index: s.index + 1, revealed: s.mode !== 'quiz' } : {})),
  prev: () => set((s) => (s.index > 0 ? { index: s.index - 1, revealed: true } : {})),
  goTo: (index) => set((s) => (index >= 0 && index < s.steps.length ? { index, revealed: true } : {})),
  reveal: () => set({ revealed: true }),
  exit: () => set({ active: false, steps: [], order: {}, index: 0 }),
}));

/** How a node should look during review. */
export type ReviewVisibility = 'normal' | 'hidden' | 'current' | 'mystery' | 'dim';

export function reviewVisibility(
  s: Pick<ReviewState, 'active' | 'mode' | 'order' | 'index' | 'revealed'>,
  nodeId: string,
): ReviewVisibility {
  if (!s.active) return 'normal';
  const i = s.order[nodeId];
  if (s.mode === 'interrogazione') return i === s.index ? 'current' : 'dim';
  if (i === undefined || i > s.index) return 'hidden';
  if (i < s.index) return 'normal';
  return s.revealed ? 'current' : 'mystery';
}
