/**
 * Little words that are said together with the next one: an article or an
 * articulated preposition lit up on its own («il», then «governo») reads as
 * a word of its own. Highlighted while spoken, «il governo» is one word.
 */
const LEADING = new Set(
  (
    'il lo la i gli le l un uno una ' +
    'del dello della dei degli delle dell al allo alla ai agli alle all ' +
    'dal dallo dalla dai dagli dalle dall nel nello nella nei negli nelle nell ' +
    'sul sullo sulla sui sugli sulle sull'
  ).split(' '),
);

export interface Span {
  start: number;
  end: number;
}

/** The words of a text as they light up while spoken, each article with the word after it. */
export function spokenWords(text: string): Span[] {
  const spans: Span[] = [];
  let glue = false;
  for (const m of text.matchAll(/\S+/g)) {
    const start = m.index;
    const end = start + m[0].length;
    if (glue) spans[spans.length - 1].end = end;
    else spans.push({ start, end });
    // «l' acqua» written with a space is still one word.
    glue = LEADING.has(m[0].toLowerCase().replace(/[’'`]$/, ''));
  }
  return spans;
}

/** The spoken word a voice is on (it reports «il» and «governo» apart), with its article. */
export function spokenWordAt(text: string, start: number, end: number): Span {
  return spokenWords(text).find((s) => start >= s.start && start < s.end) ?? { start, end };
}
