import { describe, expect, it } from 'vitest';
import { roundedPath, sheetLayout, splitRoundedPath } from './sheetLayout';

const size = { width: 200, height: 70 };

/** Main concept with branches of the given sizes (number of items each). */
function map(branchItems: number[]) {
  const nodes = [{ id: 'r', position: { x: 0, y: 0 } }];
  const edges: { id: string; source: string; target: string; label?: string }[] = [];
  let y = 1;
  branchItems.forEach((items, b) => {
    nodes.push({ id: `b${b}`, position: { x: b, y: y++ } });
    edges.push({ id: `r-b${b}`, source: 'r', target: `b${b}`, label: b === 0 ? 'nasce da' : undefined });
    for (let i = 0; i < items; i++) {
      nodes.push({ id: `b${b}i${i}`, position: { x: 0, y: y++ } });
      edges.push({ id: `b${b}-i${i}`, source: `b${b}`, target: `b${b}i${i}` });
    }
  });
  const sizes = Object.fromEntries(nodes.map((n) => [n.id, size]));
  return { nodes, edges, sizes };
}

const boxes = (r: ReturnType<typeof sheetLayout>) => Object.values(r.positions).map((p) => ({ ...p, w: size.width, h: size.height }));
const overlaps = (r: ReturnType<typeof sheetLayout>) => {
  const b = boxes(r);
  let n = 0;
  for (let i = 0; i < b.length; i++)
    for (let j = i + 1; j < b.length; j++)
      if (b[i].x < b[j].x + b[j].w && b[j].x < b[i].x + b[i].w && b[i].y < b[j].y + b[j].h && b[j].y < b[i].y + b[i].h) n++;
  return n;
};

/** A map from a nested list: [name, concepts under it]. */
type T = [string, T[]?];
function tree(root: T) {
  const nodes: { id: string; position: { x: number; y: number }; collapsed?: boolean }[] = [];
  const edges: { id: string; source: string; target: string; label?: string }[] = [];
  const walk = ([id, kids]: T, parent?: string) => {
    nodes.push({ id, position: { x: 0, y: nodes.length } });
    if (parent) edges.push({ id: `${parent}-${id}`, source: parent, target: id });
    for (const k of kids ?? []) walk(k, id);
  };
  walk(root);
  const sizes = Object.fromEntries(nodes.map((n) => [n.id, size]));
  return { nodes, edges, sizes };
}
const centre = (r: ReturnType<typeof sheetLayout>, id: string) => r.positions[id].x + size.width / 2;

describe('sheetLayout', () => {
  it('puts the branches in one row under the main concept, and their concepts below them', () => {
    const { nodes, edges, sizes } = map([7, 5, 11, 4, 3, 0]);
    const r = sheetLayout(nodes, edges, sizes);
    expect(Object.keys(r.positions)).toHaveLength(nodes.length);
    expect(overlaps(r)).toBe(0);
    const heads = ['b0', 'b1', 'b2', 'b3', 'b4', 'b5'];
    // one row, in order, the main concept above it and over its middle
    expect(new Set(heads.map((b) => r.positions[b].y)).size).toBe(1);
    expect([...heads].sort((a, b) => r.positions[a].x - r.positions[b].x)).toEqual(heads);
    expect(Math.min(...Object.entries(r.positions).filter(([id]) => id !== 'r').map(([, p]) => p.y))).toBeGreaterThan(r.positions.r.y);
    expect(centre(r, 'r')).toBeCloseTo((centre(r, 'b0') + centre(r, 'b5')) / 2);
    expect(r.roles).toMatchObject({ r: 'root', b0: 'hub', b0i0: 'item', b5: 'item' });
    expect(r.heads).toEqual({ b0: 0, b1: 1, b2: 2, b3: 3, b4: 4, b5: 5 });
  });

  it('a long list of concepts goes down in a column, centred under its concept', () => {
    const { nodes, edges, sizes } = map([3]);
    const r = sheetLayout(nodes, edges, sizes);
    for (const i of ['b0i0', 'b0i1', 'b0i2']) expect(centre(r, i)).toBeCloseTo(centre(r, 'b0'));
    expect(r.positions.b0i1.y).toBeGreaterThan(r.positions.b0i0.y + size.height);
    expect(r.positions.b0i2.y).toBeGreaterThan(r.positions.b0i1.y + size.height);
    // each line starts just under the concept above it
    expect(r.edges['b0-i1']).toEqual({ points: [{ x: centre(r, 'b0'), y: r.positions.b0i0.y + size.height }], branch: 0, own: 0, column: true });
  });

  it('a few short concepts stay in a row; a single one goes right under its concept', () => {
    const t = tree(['r', [['a', [['L'], ['E'], ['G']]], ['b', [['b1', [['b1x']]]]]]]);
    const small = { width: 120, height: 50 };
    for (const id of ['L', 'E', 'G']) t.sizes[id] = small;
    const r = sheetLayout(t.nodes, t.edges, t.sizes);
    expect(r.positions.E.y).toBe(r.positions.L.y);
    expect(r.positions.G.x).toBeGreaterThan(r.positions.E.x + small.width);
    expect(r.positions.L.x + small.width / 2 + r.positions.G.x + small.width / 2).toBeCloseTo(2 * centre(r, 'a'));
    expect(r.edges['a-E']).toMatchObject({ branch: 0, own: 1 });
    // a chain goes straight down
    expect(centre(r, 'b1')).toBeCloseTo(centre(r, 'b'));
    expect(centre(r, 'b1x')).toBeCloseTo(centre(r, 'b'));
    expect(r.positions.b1x.y).toBeGreaterThan(r.positions.b1.y);
  });

  it('spreads in a row the concepts with concepts of their own, at every level', () => {
    const t = tree(['r', [
      ['a', [['a1', [['a1x'], ['a1y']]], ['a2', [['a2x']]]]],
      ['b', [['b1'], ['b2', [['b2x']]]]],
    ]]);
    const r = sheetLayout(t.nodes, t.edges, t.sizes);
    expect(overlaps(r)).toBe(0);
    expect(r.positions.a2.y).toBe(r.positions.a1.y);
    expect(r.positions.a2.x).toBeGreaterThan(r.positions.a1.x + size.width);
    expect(centre(r, 'a')).toBeCloseTo((centre(r, 'a1') + centre(r, 'a2')) / 2);
    // a mixed list too
    expect(r.positions.b2.y).toBe(r.positions.b1.y);
    expect(r.roles).toMatchObject({ r: 'root', a: 'hub', a1: 'hub', a1x: 'item', b: 'hub', b1: 'item', b2: 'hub', b2x: 'item' });
    // only the main concept's branches stand out; lines keep their branch's colour all the way down
    expect(r.heads).toEqual({ a: 0, b: 1 });
    expect(r.edges['a-a1']).toMatchObject({ branch: 0, own: 1 });
    expect(r.edges['a1-a1x']).toMatchObject({ branch: 0 });
    expect(r.edges['b-b1']).toMatchObject({ branch: 1 });
    // the line leaves from under the middle of the concept and turns above the row
    const bus = r.edges['a-a2'];
    expect(bus.points[0].x).toBeCloseTo(centre(r, 'a'));
    expect(bus.points[1].x).toBeCloseTo(centre(r, 'a2'));
    expect(bus.points[1].y).toBeGreaterThan(r.positions.a.y + size.height);
    expect(bus.points[1].y).toBeLessThan(r.positions.a2.y);
  });

  it('closing a concept doesn’t turn its row into a column', () => {
    const t = tree(['r', [['a', [['a1'], ['a2'], ['a3']]]]]);
    const open = sheetLayout(t.nodes, t.edges, t.sizes);
    expect(open.positions.a2.y).toBeGreaterThan(open.positions.a1.y);
    // «a1» closed, with concepts hidden under it: the list is a row
    t.edges.push({ id: 'a1-a1x', source: 'a1', target: 'a1x' });
    t.nodes.push({ id: 'a1x', position: { x: 0, y: 99 } });
    t.sizes.a1x = size;
    t.nodes.find((n) => n.id === 'a1')!.collapsed = true;
    const shown = { ...t, nodes: t.nodes.filter((n) => n.id !== 'a1x'), edges: t.edges.filter((e) => e.target !== 'a1x') };
    const closed = sheetLayout(shown.nodes, shown.edges, shown.sizes);
    expect(closed.positions.a2.y).toBe(closed.positions.a1.y);
  });

  it('puts a separate concept in the branches’ row, without a line', () => {
    const { nodes, edges, sizes } = map([2, 2]);
    nodes.push({ id: 'solo', position: { x: 900, y: 500 } });
    const r = sheetLayout(nodes, edges, sizes);
    expect(r.positions.solo.y).toBe(r.positions.b0.y);
    expect(r.positions.solo.x).toBeGreaterThan(r.positions.b1.x);
    expect(r.heads).toEqual({ b0: 0, b1: 1 });
  });

  it('keeps the main concept where it is', () => {
    const { nodes, edges, sizes } = map([2, 2]);
    expect(sheetLayout(nodes, edges, sizes, { x: 40, y: 90 }).positions.r).toEqual({ x: 40, y: 90 });
  });

  it('laying out the sheet again changes nothing, even with linking words', () => {
    const nested = tree(['r', [['a', [['a1', [['a1x']]], ['a2', [['a2x'], ['a2y']]]]], ['b', [['b1']]]]]);
    for (const m of [map([2, 2, 2, 2]), map([5, 5, 5, 5, 5, 5]), map([3, 0, 1, 4, 0, 2, 1]), nested]) {
      // linking words on some lines, next to ones without
      for (const e of m.edges) if (['b2', 'b3', 'a2', 'a2x'].includes(e.target)) e.label = 'porta a';
      const first = sheetLayout(m.nodes, m.edges, m.sizes);
      const again = sheetLayout(m.nodes.map((n) => ({ ...n, position: first.positions[n.id] })), m.edges, m.sizes);
      expect(again.positions).toEqual(first.positions);
    }
  });

  it('dragging a branch sideways in its row moves it, a few pixels up or down do not matter', () => {
    const m = map([5, 5, 5]);
    const first = sheetLayout(m.nodes, m.edges, m.sizes);
    const moved = (id: string, dx: number, dy: number) =>
      m.nodes.map((n) => {
        const p = first.positions[n.id];
        return { ...n, position: n.id === id ? { x: p.x + dx, y: p.y + dy } : p };
      });
    const order = (r: ReturnType<typeof sheetLayout>) => ['b0', 'b1', 'b2'].sort((a, b) => r.positions[a].x - r.positions[b].x);
    // the first branch dropped past the last one, 3 px higher
    expect(order(sheetLayout(moved('b0', 700, -3), m.edges, m.sizes))).toEqual(['b1', 'b2', 'b0']);
    // the last branch dropped before the first one, 3 px lower
    expect(order(sheetLayout(moved('b2', -700, 3), m.edges, m.sizes))).toEqual(['b2', 'b0', 'b1']);
  });

  it('draws rounded corners only where the line turns', () => {
    expect(roundedPath([{ x: 0, y: 0 }, { x: 0, y: 50 }, { x: 100, y: 50 }])).toBe('M 0,0 L 0,40 Q 0,50 10,50 L 100,50');
  });

  describe('splitRoundedPath', () => {
    // From the parent down to the row line, along it, down into the concept.
    const line = [{ x: 50, y: 0 }, { x: 50, y: 30 }, { x: 100, y: 30 }, { x: 100, y: 80 }];

    it('il tratto del ramo parte dove inizia la sua curva, con la stessa curva del tronco', () => {
      const { shared, own } = splitRoundedPath(line, 2);
      expect(own).toBe('M 90,30 Q 100,30 100,40 L 100,80');
      // the shared piece reaches the end of that curve, under the colour
      expect(shared).toBe('M 50,0 L 50,20 Q 50,30 60,30 L 90,30 Q 100,30 100,40');
      // together they are the plain rounded path
      expect(roundedPath(line)).toBe('M 50,0 L 50,20 Q 50,30 60,30 L 90,30 Q 100,30 100,40 L 100,80');
    });

    it('con la curva stretta dal poco spazio, il tratto del ramo e il tronco restano uguali', () => {
      const near = [{ x: 50, y: 0 }, { x: 50, y: 30 }, { x: 56, y: 30 }, { x: 56, y: 80 }];
      const { shared, own } = splitRoundedPath(near, 2);
      expect(own).toBe('M 53,30 Q 56,30 56,33 L 56,80');
      expect(shared.endsWith('L 53,30 Q 56,30 56,33')).toBe(true);
    });

    it('sotto il concetto centrale, dove il tronco va dritto, il colore parte dalla linea e non dal tronco comune', () => {
      // the corner under the parent is a repeat: the line goes straight down
      const straight = [{ x: 50, y: 0 }, { x: 50, y: 30 }, { x: 50, y: 30 }, { x: 50, y: 80 }];
      const { shared, own } = splitRoundedPath(straight, 2);
      expect(own).toBe('M 50,30 L 50,80');
      expect(shared).toBe('M 50,0 L 50,30');
    });

    it('in colonna il colore è tutta la linea, senza tronco', () => {
      const column = [{ x: 50, y: 0 }, { x: 50, y: 40 }];
      expect(splitRoundedPath(column, 0)).toEqual({ shared: '', own: 'M 50,0 L 50,40' });
    });

    it('senza un tratto proprio il tronco è tutta la linea', () => {
      expect(splitRoundedPath(line, line.length)).toEqual({ shared: roundedPath(line), own: '' });
    });
  });
});
