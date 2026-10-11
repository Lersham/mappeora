import { describe, expect, it } from 'vitest';
import { mentionedConcepts, mentions, sameWord } from './spokenMatch';

describe('sameWord', () => {
  it.each([
    ['piante', 'pianta'],
    ['api', 'ape'],
    ['funghi', 'fungo'],
    ['evapora', 'evaporazione'],
    ['fotosintetica', 'fotosintesi'],
    ['radici', 'radice'],
  ])('%s ≈ %s', (a, b) => expect(sameWord(a, b)).toBe(true));

  it.each([
    ['pioggia', 'piove'],
    ['sole', 'suolo'],
    ['mare', 'mammifero'],
  ])('%s ≠ %s', (a, b) => expect(sameWord(a, b)).toBe(false));
});

describe('mentions', () => {
  it('finds a concept said with accents, capitals or in the plural', () => {
    expect(mentions('le Piante fanno la fotosintesi', 'Pianta')).toBe(true);
    expect(mentions('poi arriva la pioggia', 'Pioggia')).toBe(true);
    expect(mentions('il perche della cosa', 'Perché')).toBe(true);
  });

  it('is happy with half of a concept of many words', () => {
    expect(mentions("parliamo del ciclo", "Il ciclo dell'acqua")).toBe(true);
    expect(mentions('la rivoluzione', 'Rivoluzione francese')).toBe(true);
    expect(mentions('le radici prendono acqua e sali dal terreno', 'Le radici assorbono acqua e sali minerali dal terreno')).toBe(true);
  });

  it('does not find what was not said', () => {
    expect(mentions('le foglie sono verdi', 'Radici')).toBe(false);
    expect(mentions('', 'Radici')).toBe(false);
  });

  it('a concept of little words must be said as it is', () => {
    expect(mentions('e poi non lo so', 'non')).toBe(true);
  });
});

it('mentionedConcepts returns the ids of the concepts named', () => {
  const concepts = [
    { nodeId: 'a', text: 'Pianta' },
    { nodeId: 'b', text: 'Radici' },
    { nodeId: 'c', text: 'Foglie' },
  ];
  expect(mentionedConcepts('la pianta ha le foglie', concepts)).toEqual(['a', 'c']);
});
