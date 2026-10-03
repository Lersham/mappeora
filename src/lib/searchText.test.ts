import { describe, expect, it } from 'vitest';
import { fold, searchTerms, stem } from './searchText';

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
  });
});
