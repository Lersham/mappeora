import { describe, expect, it } from 'vitest';
import { createMap, NEW_CONCEPT_LABEL, NEW_MAP_TITLE } from '../../lib/mapFactory';
import type { NodeRole } from '../../lib/sheetLayout';
import type { MapEdge, MapNode } from '../../types/map';
import {
  closeUpGroup,
  isUntouchedNewMap,
  mainConcept,
  movedPositions,
  paintedBranches,
  parentForNear,
  parentForNew,
  sheetAnchor,
  stillInPlace,
} from './concepts';

const node = (id: string, extra: Partial<MapNode> = {}): MapNode => ({ id, label: id, position: { x: 0, y: 0 }, ...extra });
const edge = (source: string, target: string): MapEdge => ({ id: `${source}>${target}`, source, target });
const at = (x: number, y: number) => ({ position: { x, y } });

// acqua → (mare, fiume); fiume → (lago, cascata); lago → stagno
const water = {
  nodes: ['acqua', 'mare', 'fiume', 'lago', 'cascata', 'stagno'].map((id) => node(id)),
  edges: [edge('acqua', 'mare'), edge('acqua', 'fiume'), edge('fiume', 'lago'), edge('fiume', 'cascata'), edge('lago', 'stagno')],
};

describe('mainConcept', () => {
  it('is the oval one, even when others point to it (cause and effect)', () => {
    const map = {
      nodes: [node('causa 1'), node('causa 2'), node('effetto', { shape: 'ellisse' })],
      edges: [edge('causa 1', 'effetto'), edge('causa 2', 'effetto')],
    };
    expect(mainConcept(map, new Set())?.id).toBe('effetto');
  });

  it('without an oval, the first one nobody points to', () => {
    const map = { nodes: [node('figlio'), node('capo')], edges: [edge('capo', 'figlio')] };
    expect(mainConcept(map, new Set())?.id).toBe('capo');
  });

  it('when everything is pointed to (a cycle), the first one', () => {
    const map = { nodes: [node('a'), node('b')], edges: [edge('a', 'b'), edge('b', 'a')] };
    expect(mainConcept(map, new Set())?.id).toBe('a');
  });

  it('skips hidden concepts', () => {
    const map = { nodes: [node('ovale', { shape: 'ellisse' }), node('altro')], edges: [] };
    expect(mainConcept(map, new Set(['ovale']))?.id).toBe('altro');
    expect(mainConcept(map, new Set(['ovale', 'altro']))).toBeUndefined();
  });

  it('an empty map has none', () => {
    expect(mainConcept({ nodes: [], edges: [] }, new Set())).toBeUndefined();
  });
});

describe('parentForNew', () => {
  it('goes under the concept in hand', () => {
    expect(parentForNew(water, 'lago')).toBe('lago');
  });

  it('without one in hand, under the main concept', () => {
    expect(parentForNew(water, null)).toBe('acqua');
  });

  it('a concept in hand that is gone (deleted, undone) does not count', () => {
    expect(parentForNew(water, 'sparito')).toBe('acqua');
  });

  it('a concept in hand hidden in a closed branch does not count', () => {
    const closed = { ...water, nodes: water.nodes.map((n) => (n.id === 'fiume' ? { ...n, collapsed: true } : n)) };
    expect(parentForNew(closed, 'lago')).toBe('acqua');
    expect(parentForNew(closed, 'fiume')).toBe('fiume');
  });

  it('an empty map has nowhere to put it', () => {
    expect(parentForNew({ nodes: [], edges: [] }, null)).toBeNull();
  });

  describe('again right after adding one', () => {
    // acqua → (mare, fiume); mare and stagno are new and still unnamed.
    const fresh = {
      nodes: [node('acqua'), node('mare', { label: NEW_CONCEPT_LABEL }), node('fiume'), node('lago'), node('stagno', { label: NEW_CONCEPT_LABEL })],
      edges: [edge('acqua', 'mare'), edge('acqua', 'fiume'), edge('fiume', 'lago'), edge('lago', 'stagno')],
    };

    it('unnamed: beside it, under the same parent', () => {
      expect(parentForNew(fresh, 'mare', 'mare')).toBe('acqua');
      expect(parentForNew(fresh, 'stagno', 'stagno')).toBe('lago');
    });

    it('once it has a name, under it', () => {
      expect(parentForNew(water, 'mare', 'mare')).toBe('mare');
    });

    it('the one just added but no longer in hand does not count', () => {
      expect(parentForNew(fresh, 'fiume', 'mare')).toBe('fiume');
      expect(parentForNew(fresh, null, 'mare')).toBe('acqua');
    });

    it('a main concept just added, with no parent, takes the next under it', () => {
      const alone = { nodes: [node('idea', { label: NEW_CONCEPT_LABEL })], edges: [] };
      expect(parentForNew(alone, 'idea', 'idea')).toBe('idea');
    });
  });
});

describe('parentForNear', () => {
  it('Tab: under the concept being written', () => {
    expect(parentForNear(water, 'fiume', 'child')).toBe('fiume');
  });

  it('Maiusc+Tab: next to it, under the same parent', () => {
    expect(parentForNear(water, 'lago', 'sibling')).toBe('fiume');
  });

  it('next to the main concept there is nothing: it goes under it', () => {
    expect(parentForNear(water, 'acqua', 'sibling')).toBe('acqua');
  });

  it('Maiusc+Tab stays in the branch, whatever «Collega» drew later', () => {
    // concetto is under stato; a cross-link from governo, made later, does not move it
    const g = {
      nodes: ['paese', 'governo', 'stato', 'concetto'].map((id) => node(id)),
      edges: [edge('paese', 'governo'), edge('paese', 'stato'), edge('stato', 'concetto'), edge('governo', 'concetto')],
    };
    expect(parentForNear(g, 'concetto', 'sibling')).toBe('stato');
  });

  it('a link back to the main concept does not make it anyone’s sibling', () => {
    const cycle = { nodes: [node('a'), node('b')], edges: [edge('a', 'b'), edge('b', 'a')] };
    expect(parentForNear(cycle, 'a', 'sibling')).toBe('a');
  });
});

describe('closeUpGroup', () => {
  it('without a sheet: the concept and the ones right under it', () => {
    expect(closeUpGroup(water, 'fiume', null)).toEqual(['fiume', 'lago', 'cascata']);
    expect(closeUpGroup(water, 'stagno', null)).toEqual(['stagno']);
  });

  // On the sheet «acqua» is the root, «mare» and «fiume» start its two branches.
  const roles: Record<string, NodeRole> = { acqua: 'root', mare: 'item', fiume: 'hub', lago: 'hub', cascata: 'item', stagno: 'item' };
  const sheet = { roles, heads: { mare: 0, fiume: 1 } };

  it('on a sheet: a concept in a row brings its whole branch, from the branch’s first concept', () => {
    expect(closeUpGroup(water, 'stagno', sheet)).toEqual(['lago', 'stagno']);
    expect(closeUpGroup(water, 'cascata', sheet)).toEqual(['fiume', 'lago', 'stagno', 'cascata']);
  });

  it('on a sheet: a concept with others under it brings all of them', () => {
    expect(closeUpGroup(water, 'fiume', sheet)).toEqual(['fiume', 'lago', 'stagno', 'cascata']);
  });

  it('on a sheet: a branch’s first concept without others stays alone', () => {
    expect(closeUpGroup(water, 'mare', sheet)).toEqual(['mare']);
  });

  it('on a sheet: the main concept alone, not the whole map', () => {
    expect(closeUpGroup(water, 'acqua', sheet)).toEqual(['acqua']);
  });

  it('a cross-link does not bring a concept twice', () => {
    const crossed = { ...water, edges: [...water.edges, edge('cascata', 'stagno')] };
    expect(closeUpGroup(crossed, 'fiume', sheet)).toEqual(['fiume', 'lago', 'stagno', 'cascata']);
  });
});

describe('sheetAnchor', () => {
  it('is the highest concept nobody points to, the leftmost on a tie', () => {
    const map = {
      nodes: [node('figlio', at(0, -500)), node('b', at(300, 0)), node('a', at(100, 0))],
      edges: [edge('b', 'figlio')],
    };
    expect(sheetAnchor(map)).toEqual({ x: 100, y: 0 });
  });

  it('when everything is pointed to, the highest of all', () => {
    const map = { nodes: [node('a', at(0, 50)), node('b', at(0, 10))], edges: [edge('a', 'b'), edge('b', 'a')] };
    expect(sheetAnchor(map)).toEqual({ x: 0, y: 10 });
  });

  it('an empty map has none', () => {
    expect(sheetAnchor({ nodes: [], edges: [] })).toBeUndefined();
  });
});

describe('paintedBranches', () => {
  it('a branch is painted once its first concept has a colour', () => {
    const nodes = [node('mare', { color: '#a0e7e5' }), node('fiume'), node('lago', { color: '#ffffff' })];
    expect(paintedBranches(nodes, { mare: 0, fiume: 1, lago: 2 })).toEqual(new Set([0]));
  });

  it('colours further down the branch do not count', () => {
    const nodes = [node('fiume'), node('lago', { color: '#ffd166' })];
    expect(paintedBranches(nodes, { fiume: 1 })).toEqual(new Set());
  });

  it('without a sheet, nothing is painted', () => {
    expect(paintedBranches([node('a', { color: '#ffd166' })], {})).toEqual(new Set());
  });
});

describe('movedPositions', () => {
  const nodes = [node('a', at(10, 10)), node('b', at(0, 0))];

  it('keeps only the places that differ by more than half a pixel', () => {
    expect(movedPositions(nodes, { a: { x: 10.4, y: 9.6 }, b: { x: 0, y: 0.6 } })).toEqual({ b: { x: 0, y: 0.6 } });
  });

  it('ignores places for concepts that are gone', () => {
    expect(movedPositions(nodes, { gone: { x: 99, y: 99 } })).toEqual({});
  });
});

describe('stillInPlace', () => {
  const before = { nodes: [node('a', at(0, 0)), node('b', at(0, 0)), node('c', at(0, 0))], edges: [] };
  const positions = { a: { x: 1, y: 1 }, b: { x: 2, y: 2 }, c: { x: 3, y: 3 } };

  it('leaves alone a concept dragged while the layout ran, and one deleted', () => {
    const now = { nodes: [before.nodes[0], { ...before.nodes[1], position: { x: 50, y: 50 } }], edges: [] };
    expect(stillInPlace(positions, before, now)).toEqual({ a: { x: 1, y: 1 } });
  });

  it('a concept put back exactly where it was still counts as moved', () => {
    const now = { nodes: [{ ...before.nodes[0], position: { x: 0, y: 0 } }], edges: [] };
    expect(stillInPlace(positions, before, now)).toEqual({});
  });
});

describe('isUntouchedNewMap', () => {
  it('a map just made, with only its unnamed main concept', () => {
    expect(isUntouchedNewMap(createMap())).toBe(true);
  });

  it('not once the child named it, gave it a title or added a concept', () => {
    const map = createMap();
    expect(isUntouchedNewMap({ ...map, title: 'Il fiume' })).toBe(false);
    expect(isUntouchedNewMap({ ...map, nodes: [{ ...map.nodes[0], label: 'Il fiume' }] })).toBe(false);
    expect(isUntouchedNewMap({ ...map, nodes: [...map.nodes, node('altro')] })).toBe(false);
  });

  it('a map with a template is not empty', () => {
    expect(isUntouchedNewMap(createMap(NEW_MAP_TITLE, '5w'))).toBe(false);
  });

  it('a map with no concepts at all is not a new one', () => {
    expect(isUntouchedNewMap({ title: NEW_MAP_TITLE, nodes: [] })).toBe(false);
  });
});
