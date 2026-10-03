import { describe, expect, it } from 'vitest';
import { slug } from './export';
import { nextWordEnd } from './speech/web';

describe('text helpers', () => {
  it('slug strips accents and punctuation', () => {
    expect(slug("L'Età del Ferro!")).toBe('l-eta-del-ferro');
  });

  it('nextWordEnd finds the end of the current word', () => {
    expect(nextWordEnd('ciao bella gente', 5)).toBe(10);
    expect(nextWordEnd('ciao', 0)).toBe(4);
  });
});
