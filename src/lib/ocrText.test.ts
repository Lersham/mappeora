import { describe, expect, it } from 'vitest';
import { cleanOcrText, selectionToConcepts, sentences, tokenize } from './ocrText';

describe('cleanOcrText', () => {
  it('joins hyphenated words and lines of the same paragraph, keeps paragraphs', () => {
    const raw = 'La foto-\nsintesi avviene nelle\nfoglie .\n\n  Le piante  usano la luce.\r\n';
    expect(cleanOcrText(raw)).toBe('La fotosintesi avviene nelle foglie.\n\nLe piante usano la luce.');
  });

  it('rejoins words and sentences split by a spurious blank line', () => {
    expect(cleanOcrText('si chiama foto-\n\nsintesi e avviene\n\nnelle foglie.\n\nPoi')).toBe(
      'si chiama fotosintesi e avviene nelle foglie.\n\nPoi',
    );
  });

  it('keeps real hyphens before capitals (e.g. names)', () => {
    expect(cleanOcrText('Emilia-\nRomagna')).toBe('Emilia-Romagna');
  });
});

describe('tokenize', () => {
  it('keeps apostrophes inside words and records offsets', () => {
    const tokens = tokenize("L'acqua bolle, a 100 gradi.");
    const words = tokens.filter((t) => t.word >= 0).map((t) => t.text);
    expect(words).toEqual(["L'acqua", 'bolle', 'a', '100', 'gradi']);
    expect(tokens.map((t) => t.text).join('')).toBe("L'acqua bolle, a 100 gradi.");
  });
});

describe('selectionToConcepts', () => {
  const text = 'Le piante usano la luce del sole. Producono ossigeno e zuccheri.';
  const tokens = tokenize(text);
  const idx = (w: string) => tokens.find((t) => t.text === w)!.word;

  it('merges adjacent words into one capitalised concept', () => {
    const sel = new Set([idx('luce'), idx('del'), idx('sole'), idx('ossigeno')]);
    expect(selectionToConcepts(text, tokens, sel)).toEqual(['Luce del sole', 'Ossigeno']);
  });

  it('splits at the end of a sentence even if words are adjacent', () => {
    const sel = new Set([idx('sole'), idx('Producono')]);
    expect(selectionToConcepts(text, tokens, sel)).toEqual(['Sole', 'Producono']);
  });

  it('removes duplicates', () => {
    const t = 'acqua e acqua';
    const tk = tokenize(t);
    expect(selectionToConcepts(t, tk, new Set([0, 2]))).toEqual(['Acqua']);
  });
});

describe('sentences', () => {
  it('splits text into sentences with their offsets', () => {
    const text = 'Prima frase. Seconda!\n\nTerza';
    expect(sentences(text)).toEqual([
      { text: 'Prima frase.', start: 0 },
      { text: ' Seconda!', start: 12 },
      { text: 'Terza', start: 23 },
    ]);
  });
});
