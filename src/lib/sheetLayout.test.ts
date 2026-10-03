import { describe, expect, it } from 'vitest';
import { roundedPath, sheetLayout } from './sheetLayout';

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
const ratio = (r: ReturnType<typeof sheetLayout>) => {
  const b = boxes(r);
  const w = Math.max(...b.map((x) => x.x + x.w)) - Math.min(...b.map((x) => x.x));
  const h = Math.max(...b.map((x) => x.y + x.h)) - Math.min(...b.map((x) => x.y));
  return w / h;
};

describe('sheetLayout', () => {
  it('puts the branches side by side and their concepts below them, filling a portrait sheet', () => {
    const { nodes, edges, sizes } = map([7, 5, 11, 4, 3, 0]);
    const r = sheetLayout(nodes, edges, sizes);
    expect(Object.keys(r.positions)).toHaveLength(nodes.length);
    expect(overlaps(r)).toBe(0);
    expect(r.columns).toBeGreaterThan(1);
    expect(r.columns).toBeLessThan(6);
    // close to A4 portrait (≈ 0.72), far from one row or one column
    expect(ratio(r)).toBeGreaterThan(0.45);
    expect(ratio(r)).toBeLessThan(1.1);
    // the main concept is above everything, branches of a row are aligned
    expect(Math.min(...Object.entries(r.positions).filter(([id]) => id !== 'r').map(([, p]) => p.y))).toBeGreaterThan(r.positions.r.y);
    expect(r.positions.b1.y).toBe(r.positions.b0.y);
    expect(r.roles).toMatchObject({ r: 'root', b0: 'head', b0i0: 'item' });
  });

  it('lists a branch’s concepts under it, indented, in on-screen order', () => {
    const { nodes, edges, sizes } = map([3]);
    const r = sheetLayout(nodes, edges, sizes);
    expect(r.positions.b0i0.x).toBeGreaterThan(r.positions.b0.x);
    expect(r.positions.b0i1.y).toBeGreaterThan(r.positions.b0i0.y);
    expect(r.edges['b0-i0']).toEqual({ kind: 'ladder' });
  });

  it('feeds lower rows along the gap between columns', () => {
    const { nodes, edges, sizes } = map([0, 0, 0, 0, 0, 0, 0]);
    const r = sheetLayout(nodes, edges, sizes);
    const rows = new Set(['b0', 'b1', 'b2', 'b3', 'b4', 'b5', 'b6'].map((b) => r.positions[b].y));
    expect(rows.size).toBeGreaterThan(1);
    const lower = Object.entries(r.edges).find(([id, e]) => e.kind === 'bus' && r.positions[id.slice(2)].y > r.positions.b0.y)!;
    expect(lower[1].kind === 'bus' && lower[1].points.length).toBe(4);
  });

  it('keeps the main concept where it is', () => {
    const { nodes, edges, sizes } = map([2, 2]);
    expect(sheetLayout(nodes, edges, sizes, { x: 40, y: 90 }).positions.r).toEqual({ x: 40, y: 90 });
  });

  it('draws rounded corners only where the line turns', () => {
    expect(roundedPath([{ x: 0, y: 0 }, { x: 0, y: 50 }, { x: 100, y: 50 }])).toBe('M 0,0 L 0,40 Q 0,50 10,50 L 100,50');
  });
});
