import { beforeEach, describe, expect, it } from 'vitest';
import { reviewVisibility, useReview } from './reviewStore';

const steps = [
  { nodeId: 'a', text: 'A' },
  { nodeId: 'b', text: 'B' },
  { nodeId: 'c', text: 'C' },
];
const vis = (id: string) => reviewVisibility(useReview.getState(), id);

beforeEach(() => useReview.getState().exit());

describe('review mode', () => {
  it('reveals one concept at a time', () => {
    useReview.getState().start(steps, 'passo');
    expect([vis('a'), vis('b'), vis('c')]).toEqual(['current', 'hidden', 'hidden']);
    useReview.getState().next();
    expect([vis('a'), vis('b'), vis('c')]).toEqual(['normal', 'current', 'hidden']);
  });

  it('in quiz mode hides the current concept until revealed', () => {
    useReview.getState().start(steps, 'quiz');
    expect(vis('a')).toBe('mystery');
    useReview.getState().reveal();
    expect(vis('a')).toBe('current');
    useReview.getState().next();
    expect(vis('b')).toBe('mystery');
    useReview.getState().prev();
    expect(vis('a')).toBe('current');
  });

  it('does not go past the ends', () => {
    useReview.getState().start(steps, 'passo');
    useReview.getState().prev();
    expect(useReview.getState().index).toBe(0);
    for (let i = 0; i < 5; i++) useReview.getState().next();
    expect(useReview.getState().index).toBe(2);
  });

  it('in interrogazione keeps the whole map visible, one concept in focus', () => {
    useReview.getState().start(steps, 'interrogazione');
    expect([vis('a'), vis('b'), vis('c')]).toEqual(['current', 'dim', 'dim']);
    useReview.getState().goTo(2);
    expect([vis('a'), vis('b'), vis('c')]).toEqual(['dim', 'dim', 'current']);
    useReview.getState().goTo(7);
    expect(useReview.getState().index).toBe(2);
  });

  it('shows every node normally when not reviewing', () => {
    expect(vis('a')).toBe('normal');
  });
});
