import { beforeEach, describe, expect, it } from 'vitest';
import { beginDrag, endDrag, mapHistory, useMapStore } from './mapStore';
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
    beginDrag();
    for (let x = 1; x <= 30; x++) state().moveNode(root.id, { x, y: 0 });
    endDrag();
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
});
