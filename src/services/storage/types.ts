import type { ConceptMap, MapSummary } from '../../types/map';

export interface StorageService {
  list(): Promise<MapSummary[]>;
  get(id: string): Promise<ConceptMap | undefined>;
  save(map: ConceptMap): Promise<void>;
  remove(id: string): Promise<void>;
}
