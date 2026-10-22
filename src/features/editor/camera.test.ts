import { describe, expect, it } from 'vitest';
import { closeUpView, COMFORT_PX, MAX_READ_ZOOM, MIN_ZOOM, pageView, revealView } from './camera';

describe('pageView', () => {
  const computer = { width: 1280, height: 800 };
  const concepts = [{ position: { x: 0, y: 0 } }];

  it('a map that reads fine as a whole is shown whole', () => {
    expect(pageView({ area: computer, bounds: { x: 0, y: 0, width: 600, height: 400 }, concepts, textPx: 18, landscape: true })).toBeNull();
  });

  it('a tall sheet on a wide screen: as wide as the screen, from the top', () => {
    const bounds = { x: 100, y: 50, width: 800, height: 3000 };
    // As wide as it can (capped at MAX_READ_ZOOM), centred, its top 32 px from the top.
    expect(pageView({ area: computer, bounds, concepts, textPx: 18, landscape: true })).toEqual({ x: 160 - 100 * 1.2, y: 32 - 50 * 1.2, zoom: MAX_READ_ZOOM });
  });

  it('on a screen taller than wide the whole map stays: a tap brings a branch close', () => {
    const bounds = { x: 0, y: 0, width: 800, height: 3000 };
    expect(pageView({ area: computer, bounds, concepts, textPx: 18, landscape: false })).toBeNull();
  });

  it('`mustFit`: only when the map cannot be seen whole at all', () => {
    const tall = { x: 0, y: 0, width: 800, height: 3000 };
    expect(pageView({ area: computer, bounds: tall, concepts, textPx: 18, landscape: true, mustFit: true })).toBeNull();
    const huge = { x: 0, y: 0, width: 2000, height: 20000 };
    const phone = { width: 400, height: 700 };
    // Even from as far as possible it would not fit: from the top, as wide as the screen.
    const view = pageView({ area: phone, bounds: huge, concepts, textPx: 18, landscape: false, mustFit: true })!;
    expect(view.zoom).toBeCloseTo(336 / 2000);
    expect(view.x).toBeCloseTo(32);
    expect(view.y).toBe(32);
  });

  it('a map too big even from afar never goes below the farthest zoom', () => {
    const endless = { x: 0, y: 0, width: 100_000, height: 100_000 };
    expect(pageView({ area: computer, bounds: endless, concepts, textPx: 18, landscape: true })?.zoom).toBe(MIN_ZOOM);
  });

  it('a map wider than the screen: names that can be read, around the main concept at the top', () => {
    const bounds = { x: 0, y: 0, width: 4000, height: 1200 };
    const wideMap = [{ position: { x: 0, y: 300 } }, { position: { x: 1800, y: 0 }, measured: { width: 400 } }];
    const view = pageView({ area: computer, bounds, concepts: wideMap, textPx: 18, landscape: true })!;
    const zoom = COMFORT_PX / 18;
    expect(view.zoom).toBeCloseTo(zoom);
    // The main concept's centre (x = 2000) in the middle of the screen.
    expect(view.x).toBeCloseTo(640 - 2000 * zoom);
    expect(view.y).toBe(32);
  });

  it('large text needs less zoom to read, never more than the cap', () => {
    const bounds = { x: 0, y: 0, width: 4000, height: 1200 };
    const view = pageView({ area: computer, bounds, concepts, textPx: 8, landscape: true })!;
    expect(view.zoom).toBe(MAX_READ_ZOOM);
  });
});

describe('closeUpView', () => {
  const phone = { width: 400, height: 800 };
  const box = (id: string, x: number, y: number) => ({ id, x, y, width: 100, height: 50 });

  it('a branch that fits comes close as a whole, centred', () => {
    const view = closeUpView([box('a', 0, 0), box('b', 200, 100)], 'a', phone, 18)!;
    expect(view.x).toBe(150);
    expect(view.y).toBe(75);
    expect(view.zoom).toBeCloseTo(352 / 300);
  });

  it('a branch too long for the screen: just the concept, close enough to read', () => {
    const view = closeUpView([box('a', 0, 0), box('b', 2900, 0)], 'a', phone, 18)!;
    expect(view).toEqual({ x: 50, y: 25, zoom: COMFORT_PX / 18 });
  });

  it('never closer than the cap', () => {
    expect(closeUpView([box('a', 0, 0)], 'a', phone, 18)!.zoom).toBe(MAX_READ_ZOOM);
  });

  it('a concept not on screen (hidden) is not brought close', () => {
    expect(closeUpView([box('b', 0, 0)], 'a', phone, 18)).toBeNull();
  });
});

describe('revealView', () => {
  const concept = { x: 100, y: 100, width: 180, height: 72 };
  const area = { width: 1000, bottom: 700 };
  const view = { x: 0, y: 0, zoom: 1 };

  it('a concept in sight stays where it is', () => {
    expect(revealView(concept, view, area, 18, false)).toBeNull();
    expect(revealView(concept, view, area, 18, true)).toBeNull();
  });

  it('a concept off the side: the view moves to it, same zoom', () => {
    expect(revealView({ ...concept, x: 900 }, view, area, 18, false)).toEqual({ x: 990, y: 136, zoom: 1 });
    expect(revealView(concept, { x: -200, y: 0, zoom: 1 }, area, 18, false)).toEqual({ x: 190, y: 136, zoom: 1 });
  });

  it('a concept under the bars at the bottom comes up', () => {
    expect(revealView(concept, view, { width: 1000, bottom: 150 }, 18, false)).not.toBeNull();
  });

  it('a concept hugging the edge (less than 24 px) is not in sight', () => {
    expect(revealView({ ...concept, x: 20 }, view, area, 18, false)).not.toBeNull();
    expect(revealView({ ...concept, x: 24 }, view, area, 18, false)).toBeNull();
  });

  it('one about to be written comes close enough to read what is typed', () => {
    const far = { x: 0, y: 0, zoom: 0.5 };
    expect(revealView(concept, far, area, 18, true)).toEqual({ x: 190, y: 136, zoom: COMFORT_PX / 18 });
    // Only when it is written: just shown, the zoom stays.
    expect(revealView(concept, far, area, 18, false)).toBeNull();
  });
});
