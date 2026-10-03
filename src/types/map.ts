export type NodeShape = 'rettangolo' | 'ellisse' | 'nuvola';

export interface NodeImage {
  kind: 'emoji' | 'arasaac' | 'foto';
  /** Emoji character, ARASAAC pictogram id or local file URI. */
  ref: string;
}

export interface MapNode {
  id: string;
  label: string;
  position: { x: number; y: number };
  color?: string;
  shape?: NodeShape;
  image?: NodeImage;
  note?: string;
}

export interface MapEdge {
  id: string;
  source: string;
  target: string;
  /** Linking words, e.g. "causa", "è formato da". */
  label?: string;
}

export type MapTemplate = 'libera' | 'causa-effetto' | 'timeline' | 'confronto' | '5w';

export interface ConceptMap {
  id: string;
  title: string;
  createdAt: number;
  updatedAt: number;
  template: MapTemplate;
  nodes: MapNode[];
  edges: MapEdge[];
}

export type MapSummary = Pick<ConceptMap, 'id' | 'title' | 'updatedAt'>;
