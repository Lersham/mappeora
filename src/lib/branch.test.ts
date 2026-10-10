import { describe, expect, it } from 'vitest';
import type { ConceptMap } from '../types/map';
import { branchOf, cannotMoveUnder, childrenOf, moveUnder, removeBranch, removeLiftingChildren } from './branch';

const n = (id: string) => ({ id, label: id, position: { x: 0, y: 0 } });
const e = (source: string, target: string, label?: string) => ({ id: `${source}>${target}`, source, target, label });
// acqua → evaporazione → (calore, vapore); acqua → pioggia; a cross-link vapore → pioggia
const map: Pick<ConceptMap, 'nodes' | 'edges'> = {
  nodes: ['acqua', 'evaporazione', 'calore', 'vapore', 'pioggia'].map(n),
  edges: [e('acqua', 'evaporazione', 'inizia con'), e('evaporazione', 'calore', 'grazie al'), e('evaporazione', 'vapore'), e('acqua', 'pioggia'), e('vapore', 'pioggia', 'diventa')],
};
const links = (g: { edges: { source: string; target: string; label?: string }[] }) => g.edges.map((x) => `${x.source}>${x.target}${x.label ? `:${x.label}` : ''}`).sort();

describe('branch', () => {
  it('finds the children and the whole branch, not the cross-links', () => {
    expect(childrenOf(map, 'evaporazione').sort()).toEqual(['calore', 'vapore']);
    expect([...branchOf(map, 'evaporazione')].sort()).toEqual(['calore', 'evaporazione', 'vapore']);
    expect(childrenOf(map, 'vapore')).toEqual([]);
  });

  it('deleting one concept lifts its children under its parent, with their linking words', () => {
    const g = removeLiftingChildren(map, 'evaporazione')!;
    expect(g.nodes.map((x) => x.id)).not.toContain('evaporazione');
    expect(links(g)).toEqual(['acqua>calore:grazie al', 'acqua>pioggia', 'acqua>vapore', 'vapore>pioggia:diventa']);
  });

  it('the main concept with concepts under it cannot be taken away alone', () => {
    expect(removeLiftingChildren(map, 'acqua')).toBeNull();
    expect(removeLiftingChildren({ nodes: [n('solo')], edges: [] }, 'solo')!.nodes).toEqual([]);
  });

  it('deleting a branch takes everything below and the links that touch it', () => {
    const g = removeBranch(map, 'evaporazione');
    expect(g.nodes.map((x) => x.id).sort()).toEqual(['acqua', 'pioggia']);
    expect(links(g)).toEqual(['acqua>pioggia']);
  });

  it('moves a concept with its branch under another one, keeping its linking words', () => {
    const g = moveUnder(map, 'evaporazione', 'pioggia')!;
    expect(links(g)).toContain('pioggia>evaporazione:inizia con');
    expect(links(g)).not.toContain('acqua>evaporazione:inizia con');
    expect(links(g)).toContain('evaporazione>calore:grazie al');
  });

  it('a cross-link between the two becomes the tree link, not a second line', () => {
    const g = moveUnder(map, 'pioggia', 'vapore')!;
    expect(links(g).filter((l) => l.includes('pioggia'))).toEqual(['vapore>pioggia:diventa']);
  });

  it('never under itself, under its own branch, or where it already is', () => {
    expect(cannotMoveUnder(map, 'evaporazione', 'evaporazione')).toBe('self');
    expect(cannotMoveUnder(map, 'evaporazione', 'vapore')).toBe('below');
    expect(cannotMoveUnder(map, 'calore', 'evaporazione')).toBe('already');
    expect(moveUnder(map, 'evaporazione', 'calore')).toBeNull();
  });
});
