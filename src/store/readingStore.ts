import { create } from 'zustand';

interface ReadingState {
  /** Node currently being read aloud, if any. */
  nodeId: string | null;
  /** The label as it was when reading started: if the concept is renamed meanwhile, the word range no longer fits it. */
  label: string | null;
  /** Character range of the word being spoken inside that node's text. */
  word: { start: number; end: number } | null;
  /** Length of the prefix (edge label) spoken before the node label. */
  offset: number;
  active: boolean;
  set(patch: Partial<Omit<ReadingState, 'set'>>): void;
}

export const useReading = create<ReadingState>()((set) => ({
  nodeId: null,
  label: null,
  word: null,
  offset: 0,
  active: false,
  set: (patch) => set(patch),
}));
