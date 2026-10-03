export type NodeShape = 'rettangolo' | 'ellisse' | 'nuvola';

export interface NodeImage {
  kind: 'emoji' | 'arasaac' | 'foto';
  /** Emoji character, ARASAAC pictogram id or, for photos, a JPEG data URL. */
  ref: string;
}

/** A short voice note recorded on a concept ("spiegalo con la tua voce"). */
export interface NodeAudio {
  /** Self-contained data URL, so the note travels with the map file. */
  dataUrl: string;
  durationMs: number;
}

export interface MapNode {
  id: string;
  label: string;
  position: { x: number; y: number };
  color?: string;
  shape?: NodeShape;
  image?: NodeImage;
  note?: string;
  audio?: NodeAudio;
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
