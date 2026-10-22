import type { MapNode } from '../types/map';

type WordColors = NonNullable<MapNode['wordColors']>;

/** The words of a concept's name, where they are in it. */
export function labelWords(label: string): { text: string; start: number; end: number }[] {
  return [...label.matchAll(/\S+/g)].map((m) => ({ text: m[0], start: m.index, end: m.index + m[0].length }));
}

const same = (a: string, b: string) => a.toLocaleLowerCase('it-IT') === b.toLocaleLowerCase('it-IT');

/**
 * The coloured words after the name is changed: each colour stays on its
 * word, wherever the word went («governo» in «Il governo» and in «Il nuovo
 * governo»). A word no longer there loses its colour.
 */
export function remapWordColors(before: string, after: string, colors: WordColors | undefined): WordColors | undefined {
  if (!colors) return undefined;
  const old = labelWords(before);
  const now = labelWords(after);
  const taken = new Set<number>();
  const next: WordColors = {};
  for (const [at, color] of Object.entries(colors)) {
    const word = old[Number(at)];
    if (!word) continue;
    let best = -1;
    now.forEach((w, i) => {
      if (taken.has(i) || !same(w.text, word.text)) return;
      if (best < 0 || Math.abs(i - Number(at)) < Math.abs(best - Number(at))) best = i;
    });
    if (best < 0) continue;
    taken.add(best);
    next[best] = color;
  }
  return Object.keys(next).length > 0 ? next : undefined;
}

export interface LabelPiece {
  text: string;
  color?: string;
  /** Inside the word being read aloud. */
  spoken: boolean;
}

/**
 * The name cut where its look changes: a coloured word, the word being read
 * aloud (`spoken`, a range of the name). Pieces next to each other with the
 * same look are one.
 */
export function labelPieces(label: string, colors: WordColors | undefined, spoken: { start: number; end: number } | null): LabelPiece[] {
  const colorAt: (string | undefined)[] = Array.from({ length: label.length }, () => undefined);
  if (colors) {
    labelWords(label).forEach((w, i) => {
      const color = colors[i];
      if (color) for (let c = w.start; c < w.end; c++) colorAt[c] = color;
    });
  }
  const pieces: LabelPiece[] = [];
  for (let c = 0; c < label.length; c++) {
    const color = colorAt[c];
    const isSpoken = !!spoken && c >= spoken.start && c < spoken.end;
    const last = pieces[pieces.length - 1];
    if (last && last.color === color && last.spoken === isSpoken) last.text += label[c];
    else pieces.push({ text: label[c], color, spoken: isSpoken });
  }
  return pieces;
}
