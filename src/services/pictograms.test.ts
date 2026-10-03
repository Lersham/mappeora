import { describe, expect, it, vi } from 'vitest';
import { pictogramUrl, rankByWord, searchPictograms, toPictograms } from './pictograms';

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

describe('pictogram search', () => {
  const pic = (id: number, ...keywords: string[]) => ({ _id: id, keywords: keywords.map((keyword) => ({ keyword })) });

  it('keeps pictograms about the word, exact matches first', () => {
    const ranked = rankByWord(
      [pic(1, 'battere i piedi in acqua'), pic(2, 'acque'), pic(3, 'acqua'), pic(4, 'peruviano'), pic(5, 'acqua minerale')],
      'acqua',
    );
    expect(ranked.map((p) => p._id)).toEqual([3, 2, 5]);
  });

  it('searches the phrase, then each important word, without duplicates', async () => {
    const calls: string[] = [];
    vi.stubGlobal('fetch', async (url: string) => {
      const path = decodeURIComponent(url.split('/it/')[1]);
      calls.push(path);
      const body: Record<string, unknown[]> = {
        'bestsearch/ciclo acqua': [],
        'bestsearch/acqua': [pic(3, 'acqua')],
        'search/acqua': [pic(3, 'acqua'), pic(9, 'giocare con l’acqua'), pic(7, 'acqua', 'liquido')],
        'bestsearch/ciclo': [pic(4, 'ciclo')],
      };
      return body[path] ? new Response(JSON.stringify(body[path])) : new Response('', { status: 404 });
    });
    const result = await searchPictograms("Il ciclo dell'acqua");
    vi.unstubAllGlobals();
    expect(calls).toContain('bestsearch/ciclo acqua');
    expect(calls).not.toContain('search/il');
    expect(result.map((p) => p.id)).toEqual(['4', '3', '7']); // words in the order typed
  });

  it('reports a failure only when every request fails', async () => {
    vi.stubGlobal('fetch', async () => {
      throw new TypeError('offline');
    });
    await expect(searchPictograms('acqua')).rejects.toThrow('offline');
    vi.unstubAllGlobals();
  });
});
