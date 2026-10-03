import { fold, searchTerms, stem } from '../lib/searchText';

/**
 * ARASAAC pictograms (https://arasaac.org), widely used in Italian schools.
 * Licence CC BY-NC-SA: the credit below must be shown wherever pictograms
 * appear (picker, exports) and the app must stay non-commercial.
 */
export const ARASAAC_CREDIT =
  'Pittogrammi: Sergio Palao. Origine: ARASAAC (https://arasaac.org). Licenza: CC BY-NC-SA. Proprietà: Governo di Aragona (Spagna).';

const API = 'https://api.arasaac.org/v1/pictograms';
const MAX_RESULTS = 30;

export interface Pictogram {
  id: string;
  keyword: string;
}

export interface ApiPictogram {
  _id: number;
  sex?: boolean;
  violence?: boolean;
  keywords?: { keyword: string }[];
}

export function pictogramUrl(id: string, size: 300 | 500 = 300): string {
  return `https://static.arasaac.org/pictograms/${id}/${id}_${size}.png`;
}

const enc = encodeURIComponent;

async function query(path: string, signal?: AbortSignal): Promise<ApiPictogram[]> {
  const res = await fetch(`${API}/it/${path}`, { signal });
  if (!res.ok) return []; // the API answers 404 when nothing matches
  return (await res.json()) as ApiPictogram[];
}

/**
 * The plain search matches any pictogram containing the word, in any
 * position ("acqua" → "battere i piedi in acqua"): keep the ones where the
 * word really is the subject, exact matches first.
 */
export function rankByWord(items: ApiPictogram[], word: string): ApiPictogram[] {
  const w = fold(word);
  const s = stem(word);
  const rank = (p: ApiPictogram) => {
    const keys = (p.keywords ?? []).map((k) => fold(k.keyword));
    if (keys.includes(w)) return 0;
    if (keys.some((k) => stem(k) === s)) return 1;
    if (keys.some((k) => k.split(/\s+/).length <= 2 && k.split(/\s+/).some((x) => stem(x) === s))) return 2;
    return 3;
  };
  return items
    .map((p) => ({ p, r: rank(p) }))
    .filter(({ r }) => r < 3)
    .sort((a, b) => a.r - b.r)
    .map(({ p }) => p);
}

/**
 * Italian search that copes with what children actually type: "Il ciclo
 * dell'acqua" searches the whole phrase, then "ciclo" and "acqua" alone.
 * Throws only if every request fails (e.g. offline).
 */
export async function searchPictograms(text: string, signal?: AbortSignal): Promise<Pictogram[]> {
  const terms = searchTerms(text);
  if (terms.length === 0) return [];
  const words = terms.slice(0, 3);
  const requests: Promise<ApiPictogram[]>[] = [];
  if (terms.length > 1) requests.push(query(`bestsearch/${enc(terms.join(' '))}`, signal));
  for (const w of words) {
    requests.push(query(`bestsearch/${enc(w)}`, signal));
    requests.push(query(`search/${enc(w)}`, signal).then((r) => rankByWord(r, w)));
  }
  const settled = await Promise.allSettled(requests);
  signal?.throwIfAborted();
  if (settled.every((r) => r.status === 'rejected')) throw (settled[0] as PromiseRejectedResult).reason;

  const seen = new Set<number>();
  const merged: ApiPictogram[] = [];
  for (const r of settled) {
    if (r.status !== 'fulfilled') continue;
    for (const p of r.value) {
      if (seen.has(p._id)) continue;
      seen.add(p._id);
      merged.push(p);
    }
  }
  return toPictograms(merged);
}

export function toPictograms(items: ApiPictogram[]): Pictogram[] {
  return items
    .filter((p) => !p.sex && !p.violence) // the audience is children
    .slice(0, MAX_RESULTS)
    .map((p) => ({ id: String(p._id), keyword: p.keywords?.[0]?.keyword ?? '' }));
}
