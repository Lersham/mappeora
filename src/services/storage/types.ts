import type { ConceptMap, MapSummary } from '../../types/map';

/** A map in the bin: it comes back with «Rimetti» until it is too old (see TRASH_DAYS). */
export interface TrashedSummary {
  id: string;
  title: string;
  removedAt: number;
}

/** How long a deleted map can still be put back. */
export const TRASH_DAYS = 30;
export const TRASH_MS = TRASH_DAYS * 24 * 60 * 60 * 1000;

export interface StorageService {
  list(): Promise<MapSummary[]>;
  get(id: string): Promise<ConceptMap | undefined>;
  /** When the stored map was last saved, without reading it (photos and all). */
  updatedAt(id: string): Promise<number | undefined>;
  save(map: ConceptMap): Promise<void>;
  /** Moves the map to the bin, as it is stored: even a damaged one can come back. */
  remove(id: string): Promise<void>;
  /** The maps in the bin, newest first. Those deleted more than TRASH_DAYS ago are dropped. */
  trash(): Promise<TrashedSummary[]>;
  /**
   * Puts a map back from the bin. If a map with its id exists again (a
   * safety copy opened since), it comes back as a new map next to it.
   * The id of the map put back, or undefined if it was no longer there.
   */
  restore(id: string): Promise<string | undefined>;
}
