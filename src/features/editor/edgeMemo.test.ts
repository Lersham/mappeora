import { describe, expect, it } from 'vitest';
import { sameEdgeProps } from './edgeMemo';

/** What React Flow hands a line, with a fresh object for everything on each render. */
const props = (over: Record<string, unknown> = {}, data: Record<string, unknown> = {}) => ({
  id: 'e1',
  source: 'a',
  target: 'b',
  type: 'bus',
  selected: false,
  animated: false,
  label: undefined as string | undefined,
  labelBgPadding: [8, 4] as [number, number],
  labelBgBorderRadius: 6,
  sourceX: 10,
  sourceY: 20,
  targetX: 110,
  targetY: 220,
  sourcePosition: 'bottom',
  targetPosition: 'top',
  markerEnd: undefined as string | undefined,
  style: { stroke: '#123' } as Record<string, unknown> | undefined,
  interactionWidth: 40,
  data: {
    points: [
      { x: 10, y: 50 },
      { x: 110, y: 50 },
    ],
    own: 1,
    branch: 2,
    column: false,
    near: false,
    onEdit: () => {},
    ...data,
  },
  ...over,
});

describe('sameEdgeProps', () => {
  it('treats two renders with fresh but equal objects as the same line', () => {
    expect(sameEdgeProps(props(), props())).toBe(true);
  });

  it('draws again when an end moves, a side changes, or it is selected', () => {
    for (const change of [
      { sourceX: 11 },
      { sourceY: 21 },
      { targetX: 111 },
      { targetY: 221 },
      { sourcePosition: 'left' },
      { targetPosition: 'right' },
      { selected: true },
      { animated: true },
    ]) {
      expect(sameEdgeProps(props(), props(change)), JSON.stringify(change)).toBe(false);
    }
  });

  it('draws again when the arrow, the linking words or the width of the tap area change', () => {
    expect(sameEdgeProps(props(), props({ markerEnd: "url('#arrow')" }))).toBe(false);
    expect(sameEdgeProps(props({ label: 'causa' }), props({ label: 'causa' }))).toBe(true);
    expect(sameEdgeProps(props({ label: 'causa' }), props({ label: 'effetto' }))).toBe(false);
    expect(sameEdgeProps(props({ label: 'causa' }), props({ label: undefined }))).toBe(false);
    expect(sameEdgeProps(props(), props({ interactionWidth: 16 }))).toBe(false);
    expect(sameEdgeProps(props(), props({ target: 'c' }))).toBe(false);
  });

  it('compares the padding of the words element by element, and the style one level deep', () => {
    expect(sameEdgeProps(props({ labelBgPadding: [8, 4] }), props({ labelBgPadding: [8, 4] }))).toBe(true);
    expect(sameEdgeProps(props({ labelBgPadding: [8, 4] }), props({ labelBgPadding: [8, 5] }))).toBe(false);
    expect(sameEdgeProps(props({ style: { stroke: '#123' } }), props({ style: { stroke: '#123' } }))).toBe(true);
    expect(sameEdgeProps(props({ style: { stroke: '#123' } }), props({ style: { stroke: '#456' } }))).toBe(false);
    expect(sameEdgeProps(props({ style: { stroke: '#123' } }), props({ style: undefined }))).toBe(false);
    expect(sameEdgeProps(props({ style: { a: 1 } }), props({ style: { a: 1, b: 2 } }))).toBe(false);
  });

  it('compares the bends of a line by value, not by object', () => {
    const same = [
      { x: 10, y: 50 },
      { x: 110, y: 50 },
    ];
    expect(sameEdgeProps(props({}, { points: same }), props({}, { points: same.map((p) => ({ ...p })) }))).toBe(true);
    expect(sameEdgeProps(props({}, { points: same }), props({}, { points: [{ x: 10, y: 50 }, { x: 110, y: 51 }] }))).toBe(false);
    expect(sameEdgeProps(props({}, { points: same }), props({}, { points: [{ x: 10, y: 50 }] }))).toBe(false);
    expect(sameEdgeProps(props({}, { points: same }), props({}, { points: undefined }))).toBe(false);
  });

  it('looks at the other fields of data one by one', () => {
    for (const change of [{ own: 0 }, { branch: 3 }, { branch: undefined }, { column: true }, { near: true }]) {
      expect(sameEdgeProps(props(), props({}, change)), JSON.stringify(change)).toBe(false);
    }
  });

  it('only checks that «onEdit» is there: a new function with the same job is the same line', () => {
    expect(sameEdgeProps(props({}, { onEdit: () => {} }), props({}, { onEdit: () => {} }))).toBe(true);
    // Away during a review (no buttons), back after it.
    expect(sameEdgeProps(props({}, { onEdit: undefined }), props({}, { onEdit: () => {} }))).toBe(false);
    expect(sameEdgeProps(props({}, { onEdit: () => {} }), props({}, { onEdit: undefined }))).toBe(false);
    expect(sameEdgeProps(props({}, { onEdit: undefined }), props({}, { onEdit: undefined }))).toBe(true);
  });

  it('does not trust a function it does not know: another callback is compared by identity', () => {
    const f = () => {};
    expect(sameEdgeProps(props({}, { onOther: f }), props({}, { onOther: f }))).toBe(true);
    expect(sameEdgeProps(props({}, { onOther: f }), props({}, { onOther: () => {} }))).toBe(false);
  });

  it('draws again when a prop appears or disappears, and when data does', () => {
    const { markerEnd: _gone, ...fewer } = props();
    expect(sameEdgeProps(props(), fewer as ReturnType<typeof props>)).toBe(false);
    expect(sameEdgeProps(props({ data: undefined }), props({ data: undefined }))).toBe(true);
    expect(sameEdgeProps(props({ data: undefined }), props())).toBe(false);
    expect(sameEdgeProps(props(), props({ data: undefined }))).toBe(false);
    const { near: _near, ...noNear } = props().data;
    expect(sameEdgeProps(props(), props({ data: noNear }))).toBe(false);
  });
});
