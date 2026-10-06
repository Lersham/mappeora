import { describe, expect, it } from 'vitest';
import { cleanOcrText, confidentText, selectionToConcepts, sentences, tokenize } from './ocrText';

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

  it('keeps words apart across commas, brackets, quotes, dashes and bullets', () => {
    const t = 'Radici, fusto • foglie (clorofilla) – «fotosintesi» / luce';
    const tk = tokenize(t);
    const all = new Set(tk.filter((x) => x.word >= 0).map((x) => x.word));
    expect(selectionToConcepts(t, tk, all)).toEqual(['Radici', 'Fusto', 'Foglie', 'Clorofilla', 'Fotosintesi', 'Luce']);
  });

  it('drops an elided article or preposition, but not from names', () => {
    const t = "dell'acqua, l'Italia, un'isola, D'Annunzio";
    const tk = tokenize(t);
    expect(selectionToConcepts(t, tk, new Set([0, 1, 2, 3]))).toEqual(['Acqua', 'Italia', 'Isola', "D'Annunzio"]);
  });

  it('keeps numbers and abbreviations whole', () => {
    const t = 'Il monte è alto 4.810 metri, fondata nel 753 a.C. dai Romani. Pi greco vale 3,14 circa.';
    const tk = tokenize(t);
    const words = tk.filter((x) => x.word >= 0).map((x) => x.text);
    expect(words).toContain('4.810');
    expect(words).toContain('3,14');
    const idx = (w: string) => words.indexOf(w);
    const sel = new Set([idx('4.810'), idx('metri'), idx('753'), idx('a'), idx('C')]);
    expect(selectionToConcepts(t, tk, sel)).toEqual(['4.810 metri', '753 a.C.']);
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

  it('does not stop at numbers, abbreviations or lowercase after a dot', () => {
    expect(sentences('Alto 4.810 metri. Nel 753 a.C. nasce Roma, ecc. e poi. Fine').map((c) => c.text.trim())).toEqual([
      'Alto 4.810 metri.',
      'Nel 753 a.C. nasce Roma, ecc. e poi.',
      'Fine',
    ]);
  });
});

describe('confidentText', () => {
  const line = (text: string, confidence: number) => ({ text, confidence });

  it('drops the lines the engine is unsure of and keeps the paragraphs', () => {
    const page = {
      text: 'tutto',
      blocks: [
        { paragraphs: [{ lines: [line('La fotosintesi\n', 93), line('~ ;i ,:\n', 21)] }] },
        { paragraphs: [{ lines: [line('{ill \n', 30)] }, { lines: [line('Le piante\n', 88), line('usano la luce.', 75)] }] },
      ],
    };
    expect(confidentText(page)).toBe('La fotosintesi\n\nLe piante\nusano la luce.\n');
    expect(cleanOcrText(confidentText(page))).toBe('La fotosintesi\n\nLe piante usano la luce.');
  });

  it('uses the plain text when the engine gives no lines', () => {
    expect(confidentText({ text: 'La fotosintesi' })).toBe('La fotosintesi');
    expect(confidentText({ text: 'La fotosintesi', blocks: null })).toBe('La fotosintesi');
  });
});
