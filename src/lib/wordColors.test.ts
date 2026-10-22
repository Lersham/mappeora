import { describe, expect, it } from 'vitest';
import { labelPieces, labelWords, remapWordColors } from './wordColors';

describe('labelWords', () => {
  it('finds the words and where they are', () => {
    expect(labelWords(' Il  governo')).toEqual([
      { text: 'Il', start: 1, end: 3 },
      { text: 'governo', start: 5, end: 12 },
    ]);
  });
});

describe('remapWordColors', () => {
  it('keeps each colour on its word when the name changes', () => {
    expect(remapWordColors('Il governo', 'Il nuovo governo', { 1: '#c62828' })).toEqual({ 2: '#c62828' });
    expect(remapWordColors('Il governo', 'il Governo italiano', { 0: '#1565c0', 1: '#c62828' })).toEqual({ 0: '#1565c0', 1: '#c62828' });
  });

  it('takes the nearest of two same words, and drops words that are gone', () => {
    expect(remapWordColors('la casa e la scuola', 'la scuola e la casa', { 3: '#2e7d32' })).toEqual({ 3: '#2e7d32' });
    expect(remapWordColors('Il governo', 'Il parlamento', { 1: '#c62828' })).toBeUndefined();
    expect(remapWordColors('Il governo', 'Il parlamento', undefined)).toBeUndefined();
  });
});

describe('labelPieces', () => {
  it('cuts the name where a coloured word starts and ends', () => {
    expect(labelPieces('Il nuovo governo', { 1: '#c62828' }, null)).toEqual([
      { text: 'Il ', color: undefined, spoken: false },
      { text: 'nuovo', color: '#c62828', spoken: false },
      { text: ' governo', color: undefined, spoken: false },
    ]);
  });

  it('marks the word being read, coloured or not', () => {
    expect(labelPieces('Il governo', { 1: '#c62828' }, { start: 0, end: 10 })).toEqual([
      { text: 'Il ', color: undefined, spoken: true },
      { text: 'governo', color: '#c62828', spoken: true },
    ]);
  });
});
