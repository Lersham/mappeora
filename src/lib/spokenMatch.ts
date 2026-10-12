import { fold, stem, STOPWORDS } from './searchText';

const words = (text: string) => fold(text).split(/[^\p{L}\p{N}]+/u).filter(Boolean);

/**
 * Two words said and written are the same word, more or less: «piante» and
 * «pianta», «evaporazione» and «evapora», «fotosintesi» and «fotosintetica».
 * The recogniser and a child explaining in their own words rarely use the
 * exact form written on the map.
 */
export function sameWord(said: string, written: string): boolean {
  if (said === written || stem(said) === stem(written)) return true;
  // Four letters in common are not enough: «piano» and «pianeta», «carta» and «cartello».
  let common = 0;
  while (common < said.length && said[common] === written[common]) common++;
  return common >= 5;
}

/**
 * True when the child has named the concept: at least half of its meaningful
 * words (three at most, for a concept written as a whole sentence) were said.
 * A concept made only of little words («e», «non») must be said as it is.
 */
export function mentions(transcript: string, label: string): boolean {
  const said = words(transcript);
  const written = words(label);
  const meaningful = written.filter((w) => !STOPWORDS.has(w));
  if (meaningful.length === 0) return written.length > 0 && ` ${said.join(' ')} `.includes(` ${written.join(' ')} `);
  const found = meaningful.filter((w) => said.some((s) => sameWord(s, w))).length;
  return found >= Math.min(Math.ceil(meaningful.length / 2), 3);
}

/** Ids of the concepts named in `transcript`. */
export function mentionedConcepts(transcript: string, concepts: { nodeId: string; text: string }[]): string[] {
  return concepts.filter((c) => mentions(transcript, c.text)).map((c) => c.nodeId);
}
