import { describe, expect, it } from 'vitest';
import { pictogramUrl, toPictograms } from './pictograms';

describe('pictograms', () => {
  it('filters out pictograms flagged as sexual or violent', () => {
    const result = toPictograms([
      { _id: 1, keywords: [{ keyword: 'acqua' }] },
      { _id: 2, violence: true, keywords: [{ keyword: 'x' }] },
      { _id: 3, sex: true, keywords: [{ keyword: 'y' }] },
    ]);
    expect(result).toEqual([{ id: '1', keyword: 'acqua' }]);
  });

  it('builds static image URLs', () => {
    expect(pictogramUrl('2248')).toBe('https://static.arasaac.org/pictograms/2248/2248_300.png');
  });
});
