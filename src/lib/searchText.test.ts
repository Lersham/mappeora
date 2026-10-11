import { describe, expect, it } from 'vitest';
import { fold, searchTerms, stem, titleMatches } from './searchText';

describe('searchText', () => {
  it('keeps only the meaningful words', () => {
    expect(searchTerms("Il ciclo dell'acqua")).toEqual(['ciclo', 'acqua']);
    expect(searchTerms('Perché?')).toEqual(['perché']);
    expect(searchTerms('La Prima guerra mondiale')).toEqual(['prima', 'guerra', 'mondiale']);
    expect(searchTerms('città e campagna')).toEqual(['città', 'campagna']);
  });

  it('folds accents and apostrophes for comparisons', () => {
    expect(fold('Perché L’acqua')).toBe('perche l acqua');
  });

  it('matches singular and plural', () => {
    expect(stem('piante')).toBe(stem('pianta'));
    expect(stem('vulcani')).toBe(stem('vulcano'));
    expect(stem('re')).toBe('re');
    for (const [plural, singular] of [['cani', 'cane'], ['api', 'ape'], ['funghi', 'fungo'], ['foche', 'foca'], ['fuochi', 'fuoco'], ['mele', 'mela']]) {
      expect(stem(plural)).toBe(stem(singular));
    }
  });

  it('finds a map by its title the way a child types it', () => {
    expect(titleMatches('La Rivoluzione francese', 'rivoluzione')).toBe(true);
    expect(titleMatches('La Rivoluzione francese', 'francese rivoluzione')).toBe(true);
    expect(titleMatches('Rivoluzione francese', 'la rivoluzione')).toBe(true);
    expect(titleMatches('Perché piove?', 'perche')).toBe(true);
    expect(titleMatches('Il vulcano', 'vulcani')).toBe(true);
    expect(titleMatches('Il ciclo dell’acqua', "dell'acqua")).toBe(true);
    expect(titleMatches('Il ciclo dell’acqua', 'RIV')).toBe(false);
    expect(titleMatches('La Rivoluzione francese', 'rivoluzione russa')).toBe(false);
    // While typing: the first letters already narrow the list.
    expect(titleMatches('I vulcani', 'v')).toBe(true);
    expect(titleMatches('Le stagioni', 'v')).toBe(false);
    expect(titleMatches('Le stagioni', '  ')).toBe(true);
  });
});
