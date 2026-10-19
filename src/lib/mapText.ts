import type { ConceptMap } from '../types/map';
import { visiblePart } from './collapse';
import { layoutTree } from './ladder';
import { readingOrder } from './readingOrder';

/** «Scaletta» (bullets, one level more for each step down) or «Frasi» (the propositions read aloud). */
export type TextStyle = 'scaletta' | 'frasi';

const oneLine = (text: string) => text.replace(/\s+/g, ' ').trim();
const sameText = (a: string, b: string) => oneLine(a).toLocaleLowerCase('it-IT') === oneLine(b).toLocaleLowerCase('it-IT');

interface Entry {
  id: string;
  label: string;
  /** Steps down from the top of the text (0 for the first level of bullets). */
  depth: number;
  /** Concepts of one branch share it: a paragraph of «Frasi». */
  branch: number;
}

/**
 * The visible concepts depth first, branch by branch, as the app reads a
 * sheet (collapsed branches stay out, like in the reading and the export).
 * A map nearly always starts from a concept named like the map: that one
 * is the title, not a first bullet repeating it.
 */
function walk(map: ConceptMap): { title: string; entries: Entry[] } {
  const title = oneLine(map.title) || 'Mappa';
  const shown = visiblePart(map);
  const labels = new Map(shown.nodes.map((n) => [n.id, oneLine(n.label)]));
  const { kids, tops } = layoutTree(shown.nodes, shown.edges);
  const titleIsTop = tops.length === 1 && sameText(labels.get(tops[0]) ?? '', title);

  const entries: Entry[] = [];
  let branch = -1;
  const visit = (id: string, depth: number) => {
    const label = labels.get(id) ?? '';
    // A concept left empty adds no line, and what hangs from it does not step in for nothing.
    if (label) entries.push({ id, label, depth, branch });
    for (const e of kids.get(id) ?? []) visit(e.target, label ? depth + 1 : depth);
  };
  for (const top of tops) {
    if (titleIsTop) {
      for (const e of kids.get(top) ?? []) {
        branch++;
        visit(e.target, 0);
      }
      continue;
    }
    // The main concept on its own, then each of its branches.
    branch++;
    const label = labels.get(top) ?? '';
    if (label) entries.push({ id: top, label, depth: 0, branch });
    for (const e of kids.get(top) ?? []) {
      branch++;
      visit(e.target, label ? 1 : 0);
    }
  }
  return { title, entries };
}

/** The title, then the concepts as bullets («- », two spaces more for each level). */
export function mapToOutline(map: ConceptMap): string {
  const { title, entries } = walk(map);
  return [title, ...entries.map((e) => `${'  '.repeat(e.depth)}- ${e.label}`)].join('\n');
}

/** A sentence ends with a full stop, unless it already ends with a mark. */
const closed = (text: string) => (/[.!?…:;]$/.test(text) ? text : `${text}.`);

/**
 * The title, then the sentences of the reading («L’acqua è formata da
 * idrogeno»), a paragraph for each branch of the main concept.
 */
export function mapToSentences(map: ConceptMap): string {
  const { title, entries } = walk(map);
  const said = new Map(readingOrder(visiblePart(map), { depthFirst: true }).map((s) => [s.nodeId, oneLine(s.text)]));
  const paragraphs: string[][] = [];
  for (const e of entries) (paragraphs[e.branch] ??= []).push(closed(said.get(e.id) ?? e.label));
  return [title, ...paragraphs.filter(Boolean).map((p) => p.join(' '))].join('\n\n');
}

export function mapToText(map: ConceptMap, style: TextStyle): string {
  return style === 'scaletta' ? mapToOutline(map) : mapToSentences(map);
}

/** The text without its bullets, one concept per line: the voice pauses between them, and never says «trattino». */
export function speakable(text: string, style: TextStyle): string {
  if (style !== 'scaletta') return text;
  return text
    .split('\n')
    .map((line, i) => (i === 0 ? line : line.replace(/^ *- /, '')))
    .join('\n');
}
