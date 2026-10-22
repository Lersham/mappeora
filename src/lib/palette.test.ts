import { describe, expect, it } from 'vitest';
import { COLOR_NAMES, DEFAULT_COLOR, MORE_COLORS, NODE_COLORS, TEXT_COLOR, TEXT_COLORS, TEXT_COLOR_NAMES, branchColors } from './palette';

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

describe('word colours', () => {
  const luminance = (hex: string) => {
    const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255).map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
    return 0.2126 * r + 0.7152 * g + 0.0722 * b;
  };
  const contrast = (a: string, b: string) => {
    const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
    return (hi + 0.05) / (lo + 0.05);
  };

  it('every coloured word can be read on every concept colour', () => {
    for (const text of TEXT_COLORS) {
      for (const background of [...NODE_COLORS, ...MORE_COLORS, DEFAULT_COLOR]) {
        expect(contrast(text, background), `${text} su ${background}`).toBeGreaterThanOrEqual(3);
      }
    }
  });

  it('every colour has a name to read aloud', () => {
    for (const c of [...NODE_COLORS, ...MORE_COLORS, DEFAULT_COLOR]) expect(COLOR_NAMES[c]).toBeTruthy();
    for (const c of [...TEXT_COLORS, TEXT_COLOR]) expect(TEXT_COLOR_NAMES[c]).toBeTruthy();
  });
});
