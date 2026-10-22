import { describe, expect, it } from 'vitest';
import { BRANCH_COLORS, branchClass } from './branchColor';

describe('branch colours', () => {
  it('no colour outside a sheet', () => {
    expect(branchClass(undefined)).toBeUndefined();
  });

  it('each branch takes the next colour, starting again after the last', () => {
    expect(branchClass(0)).toBe('branch-line branch-0');
    expect(branchClass(BRANCH_COLORS - 1)).toBe(`branch-line branch-${BRANCH_COLORS - 1}`);
    expect(branchClass(BRANCH_COLORS)).toBe('branch-line branch-0');
    expect(branchClass(BRANCH_COLORS * 2 + 1)).toBe('branch-line branch-1');
  });
});
