import { describe, expect, it } from 'vitest';
import { pdfText, safeBreaks, slug, titleLines, wrapText } from './export';

describe('export', () => {
  it('finds the empty space between concepts, never inside one', () => {
    const breaks = safeBreaks([
      { top: 0, bottom: 60 },
      { top: 100, bottom: 160 },
      { top: 150, bottom: 200 }, // overlaps the previous one: no cut between them
      { top: 204, bottom: 240 },
    ]);
    expect(breaks).toEqual([68, 202]);
  });

  it('keeps PDF titles printable with the built-in font', () => {
    expect(pdfText('L’acqua → il “ciclo” 💧 – così…')).toBe(`L'acqua -> il "ciclo" - così...`);
    expect(pdfText('🌍🌱')).toBe('');
  });

  it('puts the PDF title on at most two lines, shortened if longer', () => {
    const measure = (text: string) => [...text].length; // one unit per letter
    expect(titleLines('Il ciclo   dell’acqua', 20, measure)).toEqual(['Il ciclo dell’acqua']);
    expect(titleLines('La Rivoluzione francese', 15, measure)).toEqual(['La Rivoluzione', 'francese']);
    expect(titleLines('Uno due tre quattro cinque sei', 9, measure)).toEqual(['Uno due', 'tre quat…']);
    expect(titleLines('🌍🌱🌋🌊🌍🌱🌋', 3, measure)).toEqual(['🌍🌱🌋', '🌊🌍…']);
    expect(titleLines('  ', 20, measure)).toEqual(['Mappa']);
  });

  it('wraps notes on as many lines as they need, cutting only words too long for a line', () => {
    const measure = (text: string) => [...text].length;
    expect(wrapText('Il 14 luglio 1789 il popolo assalta la Bastiglia', 18, measure)).toEqual(['Il 14 luglio 1789', 'il popolo assalta', 'la Bastiglia']);
    expect(wrapText('vedi https://it.wikipedia.org/wiki/Bastiglia', 12, measure)).toEqual(['vedi', 'https://it.w', 'ikipedia.org', '/wiki/Bastig', 'lia']);
    expect(wrapText('🌍🌱🌋🌊🌍', 2, measure)).toEqual(['🌍🌱', '🌋🌊', '🌍']);
    expect(wrapText('  ', 10, measure)).toEqual([]);
  });

  it('makes file names without accents or spaces', () => {
    expect(slug('La Rivoluzione francese: perché?')).toBe('la-rivoluzione-francese-perche');
  });
});
