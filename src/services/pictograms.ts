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

interface ApiPictogram {
  _id: number;
  sex?: boolean;
  violence?: boolean;
  keywords?: { keyword: string }[];
}

export function pictogramUrl(id: string, size: 300 | 500 = 300): string {
  return `https://static.arasaac.org/pictograms/${id}/${id}_${size}.png`;
}

/** Italian keyword search. The API answers 404 when nothing matches. */
export async function searchPictograms(query: string, signal?: AbortSignal): Promise<Pictogram[]> {
  const q = query.trim();
  if (!q) return [];
  const res = await fetch(`${API}/it/search/${encodeURIComponent(q)}`, { signal });
  if (!res.ok) return [];
  return toPictograms((await res.json()) as ApiPictogram[]);
}

export function toPictograms(items: ApiPictogram[]): Pictogram[] {
  return items
    .filter((p) => !p.sex && !p.violence) // the audience is children
    .slice(0, MAX_RESULTS)
    .map((p) => ({ id: String(p._id), keyword: p.keywords?.[0]?.keyword ?? '' }));
}
