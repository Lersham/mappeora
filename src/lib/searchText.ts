/**
 * Small helpers to turn what a child types ("il ciclo dell'acqua") into
 * useful search terms ("ciclo", "acqua").
 */

const STOPWORDS = new Set(
  (
    'il lo la i gli le l un uno una di a da in con su per tra fra ' +
    'del dello della dei degli delle dell al allo alla ai agli alle all ' +
    'dal dallo dalla dai dagli dalle dall nel nello nella nei negli nelle nell ' +
    'sul sullo sulla sui sugli sulle sull col coi e ed o od ma che non ' +
    'sono ci si ne mi ti vi'
  ).split(' '),
);
// Question words stay: "Chi?", "Quando?", "Perché?" have their own symbols.

/** Lower case, no accents, apostrophes as spaces: for comparing words. */
export function fold(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[’'`]/g, ' ');
}

/**
 * Meaningful words of a query, lower case with accents kept.
 */
export function searchTerms(query: string): string[] {
  const words = query
    .toLowerCase()
    .replace(/[’'`]/g, ' ')
    .split(/[^\p{L}\p{N}]+/u)
    .filter((w) => w.length >= 2 && !STOPWORDS.has(fold(w)));
  return [...new Set(words)];
}

/** Rough Italian stem, enough to match "piante" with "pianta". */
export function stem(word: string): string {
  const w = fold(word);
  return w.length > 4 ? w.replace(/[aeio]$/, '') : w;
}
