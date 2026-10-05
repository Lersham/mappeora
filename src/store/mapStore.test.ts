import { beforeEach, describe, expect, it } from 'vitest';
import { beginStep, endStep, mapHistory, useMapStore } from './mapStore';
import { createMap as createEmptyMap } from '../lib/mapFactory';

const state = () => useMapStore.getState();

beforeEach(() => {
  state().load(createEmptyMap('Acqua'));
  mapHistory().clear();
});

describe('mapStore', () => {
  it('adds a linked child under the selected node and selects it', () => {
    const root = state().map!.nodes[0];
    const id = state().addChild(root.id, 'Idrogeno');
    const { map, selectedId } = state();
    expect(selectedId).toBe(id);
    expect(map!.nodes.find((n) => n.id === id)?.label).toBe('Idrogeno');
    expect(map!.edges).toEqual([expect.objectContaining({ source: root.id, target: id })]);
  });

  it('removing a node also removes its edges', () => {
    const root = state().map!.nodes[0];
    const id = state().addChild(root.id);
    state().removeNodes([id]);
    expect(state().map!.edges).toHaveLength(0);
    expect(state().selectedId).toBeNull();
  });

  it('collapsing moves the selection off hidden concepts; adding a child reopens', () => {
    const root = state().map!.nodes[0];
    const child = state().addChild(root.id, 'Idrogeno');
    state().toggleCollapsed(root.id);
    expect(state().map!.nodes.find((n) => n.id === root.id)?.collapsed).toBe(true);
    expect(state().selectedId).toBe(root.id);
    state().addChild(root.id, 'Ossigeno');
    expect(state().map!.nodes.find((n) => n.id === root.id)?.collapsed).toBe(false);
    expect(state().map!.nodes.some((n) => n.id === child)).toBe(true);
  });

  it('does not record selection changes in the undo history', () => {
    state().select(state().map!.nodes[0].id);
    expect(mapHistory().pastStates).toHaveLength(0);
  });

  it('undoes a whole drag in one step', () => {
    const root = state().map!.nodes[0];
    beginStep();
    for (let x = 1; x <= 30; x++) state().moveNode(root.id, { x, y: 0 });
    endStep();
    expect(mapHistory().pastStates).toHaveLength(1);
    mapHistory().undo();
    expect(state().map!.nodes[0].position).toEqual({ x: 0, y: 0 });
  });

  it('ignores duplicate and self connections', () => {
    const root = state().map!.nodes[0];
    const id = state().addChild(root.id);
    state().connect(root.id, id);
    state().connect(id, id);
    expect(state().map!.edges).toHaveLength(1);
  });

  it('after «Annulla» the selection never points to a concept that is gone', () => {
    const root = state().map!.nodes[0];
    state().addChild(root.id, 'Idrogeno');
    mapHistory().undo();
    expect(state().selectedId).toBeNull();
  });

  it('moves the selection up when «Annulla» hides it in a collapsed branch', () => {
    const root = state().map!.nodes[0];
    const a = state().addChild(root.id, 'A');
    const b = state().addChild(a, 'B');
    state().toggleCollapsed(a);
    expect(state().selectedId).toBe(a);
    state().toggleCollapsed(a);
    state().select(b);
    mapHistory().undo(); // A collapsed again: B is hidden
    expect(state().selectedId).toBe(a);
  });

  it('actions that change nothing add no undo step and keep updatedAt', () => {
    const root = state().map!.nodes[0];
    const before = state().map;
    state().removeNodes(['nessuno']);
    state().setTitle(before!.title);
    state().connect(root.id, root.id);
    state().applyPositions({ [root.id]: root.position });
    expect(state().map).toBe(before);
    expect(mapHistory().pastStates).toHaveLength(0);
  });

  it('the automatic layout does not touch updatedAt', () => {
    const root = state().map!.nodes[0];
    const { updatedAt } = state().map!;
    state().applyPositions({ [root.id]: { x: 5, y: 5 } }, { auto: true });
    expect(state().map!.nodes[0].position).toEqual({ x: 5, y: 5 });
    expect(state().map!.updatedAt).toBe(updatedAt);
  });

  it('a drag that ends where it started adds no undo step', () => {
    const root = state().map!.nodes[0];
    beginStep();
    state().moveNode(root.id, { x: 40, y: 0 });
    state().moveNode(root.id, { x: 0, y: 0 });
    endStep();
    expect(mapHistory().pastStates).toHaveLength(0);
  });

  it('a link back to the main concept does not change the colour of new branches', () => {
    const root = state().map!.nodes[0];
    const a = state().addChild(root.id, 'A');
    const b = state().addChild(a, 'B');
    state().connect(b, root.id);
    const c = state().addChild(root.id, 'C');
    const color = (id: string) => state().map!.nodes.find((n) => n.id === id)?.color;
    expect(color(c)).toBe(color(a));
  });

  it('a concept added under a hidden parent opens the branch that hides it', () => {
    const root = state().map!.nodes[0];
    const a = state().addChild(root.id, 'A');
    const b = state().addChild(a, 'B');
    state().toggleCollapsed(a);
    state().addChild(b, 'C');
    expect(state().map!.nodes.find((n) => n.id === a)?.collapsed).toBe(false);
  });
});
