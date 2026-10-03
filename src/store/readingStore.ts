import { create } from 'zustand';

interface ReadingState {
  /** Node currently being read aloud, if any. */
  nodeId: string | null;
  /** Character range of the word being spoken inside that node's text. */
  word: { start: number; end: number } | null;
  /** Length of the prefix (edge label) spoken before the node label. */
  offset: number;
  active: boolean;
  set(patch: Partial<Omit<ReadingState, 'set'>>): void;
}

export const useReading = create<ReadingState>()((set) => ({
  nodeId: null,
  word: null,
  offset: 0,
  active: false,
  set: (patch) => set(patch),
}));
