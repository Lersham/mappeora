/**
 * Pictures from Wikipedia in Italian, searched inside the app: the main
 * picture of the articles that match the words. Google's image search API
 * is closed to new projects; Wikipedia's is free, needs no key and answers
 * any web page (CORS with origin=*). The pictures are the encyclopedia's
 * own, under free licences, and fit what is studied at school (people,
 * places, events, animals, plants).
 */
export interface WikiImage {
  /** The article the picture comes from. */
  title: string;
  /** A picture about 480 px wide, on upload.wikimedia.org. */
  thumb: string;
}

const API = 'https://it.wikipedia.org/w/api.php';
const COUNT = 12;
const WIDTH = 480;

export function wikiSearchUrl(query: string): string {
  const params = new URLSearchParams({
    action: 'query',
    format: 'json',
    formatversion: '2',
    origin: '*',
    generator: 'search',
    gsrsearch: query.trim(),
    gsrnamespace: '0',
    gsrlimit: String(COUNT),
    prop: 'pageimages',
    piprop: 'thumbnail',
    pithumbsize: String(WIDTH),
  });
  return `${API}?${params}`;
}

interface ApiPage {
  title?: string;
  index?: number;
  thumbnail?: { source?: string };
}

/** The articles in the search's order, only those with a picture, each picture once. */
export function parseWikiSearch(json: unknown): WikiImage[] {
  const pages = (json as { query?: { pages?: ApiPage[] } })?.query?.pages;
  if (!Array.isArray(pages)) return [];
  const seen = new Set<string>();
  return [...pages]
    .sort((a, b) => (a.index ?? 0) - (b.index ?? 0))
    .flatMap((p) => {
      const thumb = p.thumbnail?.source;
      if (!thumb || !p.title || !/^https:\/\/upload\.wikimedia\.org\//.test(thumb) || seen.has(thumb)) return [];
      seen.add(thumb);
      return [{ title: p.title, thumb }];
    });
}

/** Null when Wikipedia cannot be reached (offline, too many searches): the dialog says so. */
export async function searchWikiImages(query: string, signal?: AbortSignal): Promise<WikiImage[] | null> {
  if (!query.trim()) return [];
  try {
    // Wikimedia asks apps to say who they are, so they are not taken for bots.
    const res = await fetch(wikiSearchUrl(query), { signal, headers: { 'Api-User-Agent': 'MappAmi (https://mapp-ami.vercel.app)' } });
    if (!res.ok) return null;
    return parseWikiSearch(await res.json());
  } catch {
    return null;
  }
}
