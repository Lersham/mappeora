export type NodeShape = 'rettangolo' | 'ellisse' | 'nuvola';

export interface NodeImage {
  kind: 'emoji' | 'arasaac' | 'illustrazione' | 'foto';
  /**
   * Emoji character, ARASAAC pictogram id, Fluent Emoji asset path
   * (see services/illustrations.ts) or, for photos, a JPEG data URL.
   */
  ref: string;
  /**
   * The picture itself as a data URL, saved when it is chosen: it keeps
   * showing offline and travels inside ".mappeora" files.
   */
  src?: string;
}


export interface MapNode {
  id: string;
  label: string;
  position: { x: number; y: number };
  color?: string;
  shape?: NodeShape;
  image?: NodeImage;
  note?: string;
  /** Hides the concepts below this one (see lib/collapse.ts). */
  collapsed?: boolean;
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
