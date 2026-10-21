import { describe, expect, it } from 'vitest';
import { spokenWordAt, spokenWords } from './spokenWords';

const said = (text: string) => spokenWords(text).map((s) => text.slice(s.start, s.end));

describe('spokenWords', () => {
  it('keeps articles with the word after them', () => {
    expect(said('Il governo approva la legge')).toEqual(['Il governo', 'approva', 'la legge']);
    expect(said('gli alberi e le piante')).toEqual(['gli alberi', 'e', 'le piante']);
  });

  it('keeps articulated prepositions with their word too', () => {
    expect(said('il ciclo della pioggia')).toEqual(['il ciclo', 'della pioggia']);
  });

  it('leaves an article at the end, or before punctuation, as it is', () => {
    expect(said('prendi il')).toEqual(['prendi', 'il']);
    expect(said('Il cane, il gatto')).toEqual(['Il cane,', 'il gatto']);
  });

  it('joins an elided article written with a space', () => {
    expect(said("l' acqua")).toEqual(["l' acqua"]);
    expect(said("l'acqua")).toEqual(["l'acqua"]);
  });
});

describe('spokenWordAt', () => {
  it('turns the article a voice reports into the whole word', () => {
    const text = 'Il governo';
    expect(spokenWordAt(text, 0, 2)).toEqual({ start: 0, end: 10 });
    expect(spokenWordAt(text, 3, 10)).toEqual({ start: 0, end: 10 });
  });

  it('keeps a range it cannot place', () => {
    expect(spokenWordAt('ciao', 9, 12)).toEqual({ start: 9, end: 12 });
  });
});
