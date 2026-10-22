import { afterEach, describe, expect, it, vi } from 'vitest';
import { motion } from './motion';

const prefers = (reduce: boolean) =>
  vi.stubGlobal('matchMedia', (query: string) => ({ matches: reduce && query === '(prefers-reduced-motion: reduce)' }));

describe('motion', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('keeps the camera move when motion is fine', () => {
    prefers(false);
    expect(motion(300)).toBe(300);
  });

  it('jumps when the system asks for less motion', () => {
    prefers(true);
    expect(motion(300)).toBe(0);
  });

  it('keeps the move where the browser cannot tell', () => {
    vi.stubGlobal('matchMedia', undefined);
    expect(motion(300)).toBe(300);
  });
});
