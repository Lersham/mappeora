import { create } from 'zustand';
import type { ReadingStep } from '../lib/readingOrder';

/**
 * "Ripasso": the map is revealed one concept at a time, in reading order.
 * In quiz mode the current concept shows "?" until the child taps "Scopri".
 */
interface ReviewState {
  active: boolean;
  quiz: boolean;
  steps: ReadingStep[];
  /** nodeId → position in `steps`, for O(1) lookups while rendering. */
  order: Record<string, number>;
  index: number;
  revealed: boolean;

  start(steps: ReadingStep[], quiz: boolean): void;
  next(): void;
  prev(): void;
  reveal(): void;
  exit(): void;
}

export const useReview = create<ReviewState>()((set) => ({
  active: false,
  quiz: false,
  steps: [],
  order: {},
  index: 0,
  revealed: false,

  start: (steps, quiz) =>
    set({
      active: steps.length > 0,
      quiz,
      steps,
      order: Object.fromEntries(steps.map((s, i) => [s.nodeId, i])),
      index: 0,
      revealed: !quiz,
    }),
  next: () => set((s) => (s.index < s.steps.length - 1 ? { index: s.index + 1, revealed: !s.quiz } : {})),
  prev: () => set((s) => (s.index > 0 ? { index: s.index - 1, revealed: true } : {})),
  reveal: () => set({ revealed: true }),
  exit: () => set({ active: false, steps: [], order: {}, index: 0 }),
}));

/** How a node should look during review. */
export type ReviewVisibility = 'normal' | 'hidden' | 'current' | 'mystery';

export function reviewVisibility(s: Pick<ReviewState, 'active' | 'order' | 'index' | 'revealed'>, nodeId: string): ReviewVisibility {
  if (!s.active) return 'normal';
  const i = s.order[nodeId];
  if (i === undefined || i > s.index) return 'hidden';
  if (i < s.index) return 'normal';
  return s.revealed ? 'current' : 'mystery';
}
