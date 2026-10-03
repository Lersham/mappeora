/**
 * Helpers for text that comes out of OCR: clean it up, split it into
 * tappable words, and turn the words a child selected into concepts.
 */

/** Fixes the usual OCR artefacts of a printed page. */
export function cleanOcrText(raw: string): string {
  return (
    raw
      .replace(/\r\n?/g, '\n')
      // "foto-\nsintesi" → "fotosintesi": a word hyphenated at the end of a
      // line (OCR engines sometimes put a blank line in between)
      .replace(/(\p{L})[-‐‑][ \t]*\n\s*(\p{Ll})/gu, '$1$2')
      // "Emilia-\nRomagna" → "Emilia-Romagna" (a real hyphen)
      .replace(/(\p{L})[-‐‑][ \t]*\n\s*(\p{Lu})/gu, '$1-$2')
      // A "paragraph" that starts in lowercase after an unfinished sentence
      // is the same paragraph, split by mistake.
      .replace(/([^.!?:;\s])[ \t]*\n[ \t]*\n\s*(\p{Ll})/gu, '$1 $2')
      .split(/\n[ \t]*\n+/)
      .map((p) =>
        p
          .replace(/\s*\n\s*/g, ' ') // lines of the same paragraph
          .replace(/[ \t]+/g, ' ')
          .replace(/ ([,.;:!?])/g, '$1')
          .trim(),
      )
      .filter((p) => p.length > 0)
      .join('\n\n')
  );
}

export interface Token {
  /** Position among *word* tokens only (-1 for spaces and punctuation). */
  word: number;
  text: string;
  start: number;
  end: number;
}

const WORD = /[\p{L}\p{N}]+(?:['’-][\p{L}\p{N}]+)*/gu;

/** Splits text into words and the gaps between them, keeping offsets. */
export function tokenize(text: string): Token[] {
  const tokens: Token[] = [];
  let last = 0;
  let word = 0;
  for (const m of text.matchAll(WORD)) {
    const start = m.index!;
    if (start > last) tokens.push({ word: -1, text: text.slice(last, start), start: last, end: start });
    tokens.push({ word: word++, text: m[0], start, end: start + m[0].length });
    last = start + m[0].length;
  }
  if (last < text.length) tokens.push({ word: -1, text: text.slice(last), start: last, end: text.length });
  return tokens;
}

/**
 * Selected words that are next to each other become one concept
 * ("luce" + "del" + "sole" → "Luce del sole"), unless a sentence or
 * clause break sits between them.
 */
export function selectionToConcepts(text: string, tokens: Token[], selected: ReadonlySet<number>): string[] {
  const words = tokens.filter((t) => t.word >= 0);
  const concepts: string[] = [];
  const seen = new Set<string>();
  let group: Token[] = [];

  const flush = () => {
    if (group.length === 0) return;
    const phrase = text.slice(group[0].start, group[group.length - 1].end).replace(/\s+/g, ' ');
    const label = phrase.charAt(0).toLocaleUpperCase('it-IT') + phrase.slice(1);
    const key = label.toLocaleLowerCase('it-IT');
    if (!seen.has(key)) {
      seen.add(key);
      concepts.push(label);
    }
    group = [];
  };

  for (const w of words) {
    if (!selected.has(w.word)) {
      flush();
      continue;
    }
    const prev = group[group.length - 1];
    if (prev && /[.!?;:\n]/.test(text.slice(prev.end, w.start))) flush();
    group.push(w);
  }
  flush();
  return concepts;
}

export interface Chunk {
  text: string;
  start: number;
}

/**
 * Sentences to read aloud one by one: some engines (Chrome) stop long
 * utterances after ~15 s, and short chunks make "Stop" immediate.
 */
export function sentences(text: string): Chunk[] {
  const chunks: Chunk[] = [];
  for (const m of text.matchAll(/[^.!?;\n]+[.!?;]*/g)) {
    if (m[0].trim()) chunks.push({ text: m[0], start: m.index! });
  }
  return chunks;
}
