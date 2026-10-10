import { describe, expect, it } from 'vitest';
import { parseWikiSearch, wikiSearchUrl } from './wikiImages';

const img = (name: string) => `https://upload.wikimedia.org/wikipedia/commons/thumb/a/ab/${name}.jpg/480px-${name}.jpg`;

describe('wikiSearchUrl', () => {
  it('asks Italian Wikipedia for the pictures of the matching articles, from any web page', () => {
    const url = new URL(wikiSearchUrl('  il Colosseo '));
    expect(url.origin).toBe('https://it.wikipedia.org');
    expect(url.searchParams.get('gsrsearch')).toBe('il Colosseo');
    expect(url.searchParams.get('origin')).toBe('*');
    expect(url.searchParams.get('prop')).toBe('pageimages');
    expect(url.searchParams.get('pithumbsize')).toBe('480');
  });
});

describe('parseWikiSearch', () => {
  it('keeps the search order, skips articles without a picture and repeated pictures', () => {
    const found = parseWikiSearch({
      query: {
        pages: [
          { title: 'Roma', index: 2, thumbnail: { source: img('Roma') } },
          { title: 'Colosseo', index: 1, thumbnail: { source: img('Colosseo') } },
          { title: 'Anfiteatro', index: 3 },
          { title: 'Colosseo (disambigua)', index: 4, thumbnail: { source: img('Colosseo') } },
        ],
      },
    });
    expect(found).toEqual([
      { title: 'Colosseo', thumb: img('Colosseo') },
      { title: 'Roma', thumb: img('Roma') },
    ]);
  });

  it('only takes pictures from Wikimedia', () => {
    expect(parseWikiSearch({ query: { pages: [{ title: 'X', index: 1, thumbnail: { source: 'https://example.com/x.jpg' } }] } })).toEqual([]);
  });

  it('nothing found, or an unexpected answer: no pictures', () => {
    expect(parseWikiSearch({ batchcomplete: true })).toEqual([]);
    expect(parseWikiSearch(null)).toEqual([]);
  });
});
