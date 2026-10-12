import { beforeEach, describe, expect, it } from 'vitest';
import { reviewVisibility, ripetimiSummary, useReview } from './reviewStore';

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

  it('in ripetimi lights up the concepts named, then rings the ones left out', () => {
    useReview.getState().start(steps, 'ripetimi');
    expect([vis('a'), vis('b'), vis('c')]).toEqual(['normal', 'normal', 'normal']);
    useReview.getState().hear(['a', 'zzz']);
    expect([vis('a'), vis('b'), vis('c')]).toEqual(['heard', 'normal', 'normal']);
    useReview.getState().toggleHeard('c');
    useReview.getState().finish();
    expect([vis('a'), vis('b'), vis('c')]).toEqual(['heard', 'current', 'heard']);
    useReview.getState().retry();
    useReview.getState().toggleHeard('c');
    expect([vis('a'), vis('b'), vis('c')]).toEqual(['heard', 'normal', 'normal']);
    expect(Object.keys(useReview.getState().heard)).toEqual(['a']);
  });

  it('sums up what ripetimi heard', () => {
    useReview.getState().start(steps, 'ripetimi');
    useReview.getState().hear(['b']);
    expect(ripetimiSummary(useReview.getState())).toMatch(/^Hai spiegato 1 concetto su 3\. Ti mancano: .+, .+\.$/);
    useReview.getState().hear(['a', 'c']);
    expect(ripetimiSummary(useReview.getState())).toBe('Perfetto! Hai spiegato tutti i concetti: 3 su 3.');
    expect(ripetimiSummary({ steps: [], heard: {} })).not.toMatch(/Perfetto/);
  });

  it('shows every node normally when not reviewing', () => {
    expect(vis('a')).toBe('normal');
  });
});
