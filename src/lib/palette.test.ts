import { describe, expect, it } from 'vitest';
import { DEFAULT_COLOR, NODE_COLORS, branchColors } from './palette';

const at = (id: string, x: number, y: number) => ({ id, position: { x, y } });
const link = (source: string, target: string) => ({ id: `${source}-${target}`, source, target });

describe('branchColors', () => {
  it('gives each branch, with everything under it, its own colour; the main concept stays white', () => {
    const nodes = [at('r', 300, 0), at('a', 0, 200), at('b', 400, 200), at('a1', 0, 400), at('a1x', 0, 600), at('b1', 400, 400)];
    const edges = [link('r', 'a'), link('r', 'b'), link('a', 'a1'), link('a1', 'a1x'), link('b', 'b1')];
    expect(branchColors(nodes, edges)).toEqual({
      r: DEFAULT_COLOR,
      a: NODE_COLORS[0],
      a1: NODE_COLORS[0],
      a1x: NODE_COLORS[0],
      b: NODE_COLORS[1],
      b1: NODE_COLORS[1],
    });
  });

  it('colours a separate concept as a branch of its own, and nothing on an empty map', () => {
    const colors = branchColors([at('r', 0, 0), at('a', 0, 200), at('solo', 600, 200)], [link('r', 'a')]);
    expect(colors.solo).not.toBe(colors.a);
    expect(colors.solo).not.toBe(DEFAULT_COLOR);
    expect(branchColors([], [])).toEqual({});
  });
});
