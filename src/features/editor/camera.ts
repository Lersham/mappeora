/** Names smaller than this on screen (px) are brought closer when tapped. */
export const READABLE_PX = 12;
/** …to this size, comfortable to read on a phone. */
export const COMFORT_PX = 16;
export const MAX_READ_ZOOM = 1.2;
/** The farthest the map can be seen from. */
export const MIN_ZOOM = 0.05;

type Box = { x: number; y: number; width: number; height: number };
type Size = { width: number; height: number };
export type Viewport = { x: number; y: number; zoom: number };
/** Where to look (map coordinates) and from how close. */
export type Centre = { x: number; y: number; zoom: number };

/**
 * A sheet is tall. On a screen wider than it is tall (a computer, a
 * Chromebook, a tablet held sideways) the whole map fits the height: two
 * empty bands at its sides and names too small to read. Then the map is
 * shown as wide as the screen, from the top, like a page: the rest is a
 * scroll away. Null when the whole map reads fine, or when the screen is
 * no wider than the sheet (a phone, a tablet held upright: no bands, and
 * a tap brings a branch close). `mustFit`: only when the whole map cannot
 * be seen even from afar.
 */
export function pageView({
  area,
  bounds,
  concepts,
  textPx,
  landscape,
  mustFit = false,
}: {
  /** The part of the screen the map is drawn in. */
  area: Size;
  /** Around the concepts on screen. */
  bounds: Box;
  concepts: { position: { x: number; y: number }; measured?: { width?: number } }[];
  /** The smallest name, in px at zoom 1. */
  textPx: number;
  /** The window is wider than it is tall. */
  landscape: boolean;
  mustFit?: boolean;
}): Viewport | null {
  const pad = 32;
  const whole = Math.min(MAX_READ_ZOOM, (area.width - pad * 2) / bounds.width, (area.height - pad * 2) / bounds.height);
  const wide = Math.min(MAX_READ_ZOOM, (area.width - pad * 2) / bounds.width);
  const top = (zoom: number) => ({ x: (area.width - bounds.width * zoom) / 2 - bounds.x * zoom, y: pad - bounds.y * zoom, zoom });
  // Too big to be seen whole even from afar (large text on a phone): from
  // the top, where the main concept is, not centred and cut at both ends.
  if (whole < MIN_ZOOM) return top(Math.max(MIN_ZOOM, wide));
  if (mustFit || textPx * whole >= READABLE_PX) return null;
  // The screen, not the map's area: on a phone the guide takes the lower
  // half and leaves the map a strip wider than it is tall, and a page view
  // there hid the branches under the tools of the concept in hand.
  if (!landscape) return null;
  if (wide >= whole * 1.5) return top(wide);
  // A map wider than the screen (a sheet spread in rows): names that can
  // be read, from the top and around the main concept; the rest is a
  // scroll away. A phone sees all of it, and a tap brings a branch close.
  const zoom = Math.min(MAX_READ_ZOOM, COMFORT_PX / textPx);
  const head = concepts.reduce((a, n) => (n.position.y < a.position.y ? n : a));
  const centre = head.position.x + (head.measured?.width ?? 0) / 2;
  return { x: area.width / 2 - centre * zoom, y: pad - bounds.y * zoom, zoom };
}

/**
 * A tap on a concept seen from afar: its whole group if it fits the screen
 * with names that can be read, else just the concept. Null if the concept
 * is not among `boxes`.
 */
export function closeUpView(boxes: (Box & { id: string })[], id: string, area: Size, textPx: number): Centre | null {
  const self = boxes.find((b) => b.id === id);
  if (!self) return null;
  const want = Math.min(MAX_READ_ZOOM, COMFORT_PX / textPx);
  const left = Math.min(...boxes.map((b) => b.x));
  const top = Math.min(...boxes.map((b) => b.y));
  const right = Math.max(...boxes.map((b) => b.x + b.width));
  const bottom = Math.max(...boxes.map((b) => b.y + b.height));
  const pad = 24;
  const fit = Math.min(MAX_READ_ZOOM, (area.width - pad * 2) / (right - left), (area.height - pad * 2) / (bottom - top));
  if (fit >= want) return { x: (left + right) / 2, y: (top + bottom) / 2, zoom: fit };
  return { x: self.x + self.width / 2, y: self.y + self.height / 2, zoom: want };
}

/**
 * A concept just added may be off screen, or under the bars floating over
 * the bottom of the map (`area.bottom`): where to look so it shows. With
 * `readable`, it also comes close enough to read what is typed. Null when it
 * is already in sight.
 */
export function revealView(concept: Box, view: Viewport, area: { width: number; bottom: number }, textPx: number, readable: boolean): Centre | null {
  const { x, y, zoom } = view;
  const tooSmall = readable && textPx * zoom < READABLE_PX;
  const [left, top] = [concept.x * zoom + x, concept.y * zoom + y];
  const m = 24;
  if (!tooSmall && left >= m && top >= m && left + concept.width * zoom <= area.width - m && top + concept.height * zoom <= area.bottom - m) return null;
  const z = tooSmall ? Math.min(MAX_READ_ZOOM, COMFORT_PX / textPx) : zoom;
  return { x: concept.x + concept.width / 2, y: concept.y + concept.height / 2, zoom: z };
}
