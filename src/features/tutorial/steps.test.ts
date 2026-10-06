import { describe, expect, it } from 'vitest';
import { createMap, NEW_CONCEPT_LABEL } from '../../lib/mapFactory';
import type { ConceptMap } from '../../types/map';
import { TUTORIAL_STEPS, TUTORIAL_TITLE, type TutorialProgress } from './steps';

const step = (title: string) => {
  const found = TUTORIAL_STEPS.find((s) => s.title === title);
  if (!found?.done) throw new Error(`passo senza controllo: ${title}`);
  return found.done;
};
const at = (map: ConceptMap, read = false): TutorialProgress => ({ map, read });

const first = createMap(TUTORIAL_TITLE);
const root = first.nodes[0];
const withChild = (label: string, link?: string): ConceptMap => ({
  ...first,
  nodes: [...first.nodes, { id: 'b', label, position: { x: 0, y: 100 } }],
  edges: [{ id: 'e', source: root.id, target: 'b', label: link }],
});

describe('TUTORIAL_STEPS', () => {
  it('starts from a map with only the main idea, named like the tutorial', () => {
    expect(first.nodes).toHaveLength(1);
    expect(root.label).toBe(TUTORIAL_TITLE);
  });

  it('notices when the main idea gets a name of its own', () => {
    const done = step('L’idea principale');
    expect(done(at(first), at(first))).toBe(false);
    expect(done(at({ ...first, nodes: [{ ...root, label: 'Il sole' }] }), at(first))).toBe(true);
  });

  it('notices a new concept, then its name', () => {
    const added = withChild(NEW_CONCEPT_LABEL);
    expect(step('Un nuovo concetto')(at(added), at(first))).toBe(true);
    expect(step('Un nuovo concetto')(at(first), at(first))).toBe(false);
    expect(step('Dagli un nome')(at(added), at(added))).toBe(false);
    expect(step('Dagli un nome')(at(withChild('Luce e calore')), at(added))).toBe(true);
    // A map with only the main idea has nothing to name yet.
    expect(step('Dagli un nome')(at(first), at(first))).toBe(false);
  });

  it('notices linking words, but not blank ones or the ones already there', () => {
    const done = step('Le parole che collegano');
    const plain = withChild('Luce');
    expect(done(at(withChild('Luce', '  ')), at(plain))).toBe(false);
    expect(done(at(withChild('Luce', 'serve per')), at(plain))).toBe(true);
    const linked = withChild('Luce', 'dà');
    expect(done(at(linked), at(linked))).toBe(false);
  });

  it('notices the map being read aloud and a dictated concept', () => {
    expect(step('Ascolta la mappa')(at(first, true), at(first))).toBe(true);
    expect(step('Ascolta la mappa')(at(first), at(first))).toBe(false);
    expect(step('Detta un concetto')(at(withChild('Estate')), at(first))).toBe(true);
  });

  it('ends with a step that has nothing to check', () => {
    expect(TUTORIAL_STEPS.at(-1)?.done).toBeUndefined();
  });
});
