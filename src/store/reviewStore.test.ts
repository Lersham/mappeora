import { beforeEach, describe, expect, it } from 'vitest';
import { quizSummary, reviewVisibility, ripetimiSummary, useReview } from './reviewStore';

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

describe('Indovina: knew / did not know', () => {
  const state = () => useReview.getState();
  const ids = (r: Record<string, true>) => Object.keys(r);

  it('marks a concept as known or missed, and an answer given again replaces the first', () => {
    state().start(steps, 'quiz');
    state().mark('a', true);
    state().mark('b', false);
    expect([ids(state().known), ids(state().missed)]).toEqual([['a'], ['b']]);
    state().mark('b', true);
    state().mark('a', false);
    expect([ids(state().known), ids(state().missed)]).toEqual([['b'], ['a']]);
    // a concept that is not in the review is not counted
    state().mark('zzz', true);
    expect(ids(state().known)).toEqual(['b']);
  });

  it('answer() records the concept in view and goes on to the next one, hidden again', () => {
    state().start(steps, 'quiz');
    state().reveal();
    state().answer(true);
    expect(state().index).toBe(1);
    expect(state().revealed).toBe(false);
    expect([vis('a'), vis('b'), vis('c')]).toEqual(['normal', 'mystery', 'hidden']);
    state().reveal();
    state().answer(false);
    expect([ids(state().known), ids(state().missed)]).toEqual([['a'], ['b']]);
  });

  it('answer() does nothing until the concept is revealed, or outside Indovina', () => {
    state().start(steps, 'quiz');
    state().answer(true);
    expect([state().index, ids(state().known)]).toEqual([0, []]);
    state().start(steps, 'passo');
    state().answer(true);
    expect([state().index, ids(state().known)]).toEqual([0, []]);
  });

  it('after the last concept the summary is shown: the whole map, the missed ones ringed', () => {
    state().start(steps, 'quiz');
    for (const knew of [true, false, true]) {
      state().reveal();
      state().answer(knew);
    }
    expect(state().done).toBe(true);
    expect(state().index).toBe(2);
    expect([vis('a'), vis('b'), vis('c')]).toEqual(['normal', 'current', 'normal']);
    // «Indietro» takes the child back to the last concept to answer it again
    state().prev();
    expect([state().done, state().index, state().revealed]).toEqual([false, 2, true]);
    expect(vis('c')).toBe('current');
  });

  it('a concept skipped with «Avanti» is neither known nor missed', () => {
    state().start(steps, 'quiz');
    state().reveal();
    state().answer(true);
    state().next();
    state().reveal();
    state().answer(false);
    expect([ids(state().known), ids(state().missed)]).toEqual([['a'], ['c']]);
    const summary = quizSummary(state());
    expect(summary).toBe('Ne sapevi 1 su 2. Da rivedere: C.');
  });

  it('sums up what the child knew, kindly', () => {
    const base = { steps, known: {}, missed: {} };
    expect(quizSummary({ ...base, known: { a: true, b: true }, missed: { c: true } })).toBe('Ne sapevi 2 su 3. Da rivedere: C.');
    expect(quizSummary({ ...base, known: { a: true }, missed: { b: true, c: true } })).toBe('Ne sapevi 1 su 3. Da rivedere: B, C.');
    expect(quizSummary({ ...base, known: { a: true, b: true, c: true } })).toBe('Perfetto! Li sapevi tutti: 3 su 3.');
    // never «0 su 3», never a judgement
    const none = quizSummary({ ...base, missed: { a: true, b: true, c: true } });
    expect(none).toBe('Nessun problema, ripassando si impara! Da rivedere: A, B, C.');
    expect(none).not.toMatch(/sbagliat|0 su/i);
    expect(quizSummary(base)).not.toMatch(/Da rivedere|su 3/);
    // the words shown can be the concept's name instead of the sentence read aloud
    expect(quizSummary({ steps: [{ nodeId: 'a', text: 'A è formato da B' }], known: {}, missed: { a: true } }, () => 'B')).toBe(
      'Nessun problema, ripassando si impara! Da rivedere: B.',
    );
  });

  it('«Ripassa solo questi» asks again only the missed concepts, the others stay as clues', () => {
    state().start(steps, 'quiz');
    for (const knew of [true, false, false]) {
      state().reveal();
      state().answer(knew);
    }
    state().retryMissed();
    expect(state().steps.map((st) => st.nodeId)).toEqual(['b', 'c']);
    expect([state().index, state().revealed, state().done, state().active]).toEqual([0, false, false, true]);
    expect([ids(state().known), ids(state().missed)]).toEqual([[], []]);
    expect([vis('a'), vis('b'), vis('c')]).toEqual(['normal', 'mystery', 'hidden']);
    state().reveal();
    state().answer(true);
    state().reveal();
    state().answer(false);
    expect(quizSummary(state())).toBe('Ne sapevi 1 su 2. Da rivedere: C.');
    // and again, with only what is still missed
    state().retryMissed();
    expect(state().steps.map((st) => st.nodeId)).toEqual(['c']);
  });

  it('there is nothing to ask again when nothing was missed', () => {
    state().start(steps, 'quiz');
    for (let i = 0; i < 3; i++) {
      state().reveal();
      state().answer(true);
    }
    state().retryMissed();
    expect(state().steps).toHaveLength(3);
    expect(state().done).toBe(true);
  });

  it('a new review, or leaving it, forgets the answers', () => {
    state().start(steps, 'quiz');
    state().mark('a', true);
    state().mark('b', false);
    state().start(steps, 'quiz');
    expect([ids(state().known), ids(state().missed), state().scoped]).toEqual([[], [], false]);
    state().mark('a', false);
    state().retryMissed();
    expect(state().scoped).toBe(true);
    state().exit();
    expect([ids(state().known), ids(state().missed), state().scoped, state().done]).toEqual([[], [], false, false]);
    // a plain start after «Ripassa solo questi» hides the concepts again, as in a first round
    state().start(steps.slice(0, 1), 'quiz');
    expect(vis('b')).toBe('hidden');
  });
});
