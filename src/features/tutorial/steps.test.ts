import { describe, expect, it } from 'vitest';
import { createMap, NEW_CONCEPT_LABEL } from '../../lib/mapFactory';
import type { ConceptMap } from '../../types/map';
import { TUTORIAL_STEPS, TUTORIAL_TITLE, guideFor, type TutorialProgress } from './steps';

const step = (title: string) => {
  const found = TUTORIAL_STEPS.find((s) => s.title === title);
  if (!found?.done) throw new Error(`passo senza controllo: ${title}`);
  return found.done;
};
const at = (map: ConceptMap, read = false, used: TutorialProgress['used'] = {}): TutorialProgress => ({ map, read, used });

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

  it('notices a picture put on a concept, not one already there', () => {
    const done = step('Un’immagine');
    const plain = withChild('Luce');
    const pictured = (ref: string): ConceptMap => ({ ...plain, nodes: plain.nodes.map((n) => (n.id === 'b' ? { ...n, image: { kind: 'emoji', ref } } : n)) });
    expect(done(at(plain), at(plain))).toBe(false);
    expect(done(at(pictured('☀️')), at(plain))).toBe(true);
    expect(done(at(pictured('☀️')), at(pictured('☀️')))).toBe(false);
  });

  it('notices two concepts already there being linked, not a new concept', () => {
    const done = step('Collega due idee');
    const two = withChild('Luce');
    const three: ConceptMap = { ...two, nodes: [...two.nodes, { id: 'c', label: 'Estate', position: { x: 0, y: 200 } }], edges: [...two.edges, { id: 'f', source: root.id, target: 'c' }] };
    const linked: ConceptMap = { ...three, edges: [...three.edges, { id: 'g', source: 'c', target: 'b' }] };
    expect(done(at(linked), at(three))).toBe(true);
    expect(done(at(three), at(two))).toBe(false); // a new concept, with its own line
    expect(done(at(three), at(three))).toBe(false);
    // Only two concepts, already linked: a new one first, then the line.
    expect(done(at(linked), at(two))).toBe(true);
  });

  it('asks for a new concept first when every concept is already linked', () => {
    const linking = TUTORIAL_STEPS.find((s) => s.title === 'Collega due idee')!;
    const two = withChild('Luna');
    expect(guideFor(linking, two).target).toBe('concetto');
    expect(guideFor(linking, two).text).toContain('«Concetto»');
    expect(guideFor(linking, first).target).toBe('concetto');
    const three: ConceptMap = { ...two, nodes: [...two.nodes, { id: 'c', label: 'Stelle', position: { x: 0, y: 200 } }], edges: [...two.edges, { id: 'f', source: 'b', target: 'c' }] };
    expect(guideFor(linking, three)).toMatchObject({ text: linking.text, target: 'collega' });
    // The other steps say the same thing on any map.
    expect(guideFor(TUTORIAL_STEPS[0], two).text).toBe(TUTORIAL_STEPS[0].text);
  });

  it('notices a line taken away, not a concept deleted or moved', () => {
    const done = step('Togli una freccia');
    const two = withChild('Luce');
    const three: ConceptMap = { ...two, nodes: [...two.nodes, { id: 'c', label: 'Estate', position: { x: 0, y: 200 } }], edges: [...two.edges, { id: 'f', source: root.id, target: 'c' }] };
    const linked: ConceptMap = { ...three, edges: [...three.edges, { id: 'g', source: 'c', target: 'b' }] };
    expect(done(at(three), at(linked))).toBe(true);
    expect(done(at({ ...three, edges: [three.edges[0]] }), at(three))).toBe(true); // «Estate» stays, on its own
    expect(done(at(linked), at(linked))).toBe(false);
    // «Elimina» on «Estate»: its two lines go with it.
    expect(done(at(two), at(linked))).toBe(false);
    // «Cambia ramo»: «Estate» under «Luce», one line for another.
    expect(done(at({ ...three, edges: [two.edges[0], { id: 'h', source: 'b', target: 'c' }] }), at(three))).toBe(false);
  });

  it('asks for a concept first when there is no line to take away', () => {
    const taking = TUTORIAL_STEPS.find((s) => s.title === 'Togli una freccia')!;
    expect(guideFor(taking, first).target).toBe('concetto');
    expect(guideFor(taking, withChild('Luce')).text).toBe(taking.text);
    expect(guideFor(taking, withChild('Luce')).target).toBeUndefined();
  });

  it('notices the line put back, by «Annulla» or by «Collega»', () => {
    const done = step('Rimetti la freccia');
    const two = withChild('Luce');
    const apart: ConceptMap = { ...two, edges: [] };
    expect(TUTORIAL_STEPS.find((s) => s.title === 'Rimetti la freccia')?.target).toBe('annulla');
    expect(done(at(two), at(apart))).toBe(true);
    expect(done(at(apart), at(apart))).toBe(false);
    // A new concept comes with its own line: that is not the one taken away.
    expect(done(at({ ...apart, nodes: [...apart.nodes, { id: 'c', label: 'Estate', position: { x: 0, y: 200 } }], edges: [{ id: 'f', source: root.id, target: 'c' }] }), at(apart))).toBe(false);
  });

  /** Root, «Luce» and «Estate», both under the root. */
  const three = (): ConceptMap => {
    const two = withChild('Luce');
    return { ...two, nodes: [...two.nodes, { id: 'c', label: 'Estate', position: { x: 0, y: 200 } }], edges: [...two.edges, { id: 'f', source: root.id, target: 'c' }] };
  };

  it('notices a concept put under another with «Cambia ramo», and asks for two concepts first', () => {
    const done = step('Cambia ramo');
    const before = three();
    const moved: ConceptMap = { ...before, edges: [before.edges[0], { id: 'f', source: 'b', target: 'c' }] };
    expect(done(at(moved), at(before))).toBe(true);
    expect(done(at(before), at(before))).toBe(false);
    // A new concept is not a concept moved.
    expect(done(at(before), at(withChild('Luce')))).toBe(false);
    const branching = TUTORIAL_STEPS.find((s) => s.title === 'Cambia ramo')!;
    expect(guideFor(branching, withChild('Luce')).target).toBe('concetto');
    expect(guideFor(branching, before).target).toBe('cambia-ramo');
  });

  it('notices «Sposta», or a concept dragged', () => {
    const done = step('Metti i concetti dove vuoi');
    const before = three();
    expect(done(at({ ...before, freeLayout: true }), at(before))).toBe(true);
    const dragged: ConceptMap = { ...before, nodes: before.nodes.map((n) => (n.id === 'c' ? { ...n, position: { x: 300, y: 200 } } : n)) };
    expect(done(at(dragged), at(before))).toBe(true);
    expect(done(at(before), at(before))).toBe(false);
  });

  it('notices the map coloured, by «Riordina e colora» or by one concept', () => {
    const before = three();
    const coloured: ConceptMap = { ...before, nodes: before.nodes.map((n) => (n.id === 'b' ? { ...n, color: '#ffaebc' } : n)) };
    for (const title of ['Bianca o colorata', 'Un colore tutto suo']) {
      expect(step(title)(at(coloured), at(before))).toBe(true);
      expect(step(title)(at(before), at(before))).toBe(false);
    }
  });

  it('notices a concept taken away', () => {
    const done = step('Togli un concetto');
    expect(done(at(withChild('Luce')), at(three()))).toBe(true);
    expect(done(at(three()), at(three()))).toBe(false);
  });

  it('notices each tool opened since the step began, not before', () => {
    const tools = {
      'La scaletta': 'outline',
      'Dal libro': 'photo',
      Ripassa: 'review',
      'Salva, stampa, manda': 'export',
      'Come la vedi': 'settings',
      'Solo la mappa': 'focus',
    } as const;
    for (const [title, tool] of Object.entries(tools)) {
      const done = step(title);
      expect(done(at(first, false, { [tool]: 1 }), at(first))).toBe(true);
      expect(done(at(first, false, { [tool]: 1 }), at(first, false, { [tool]: 1 }))).toBe(false);
      expect(done(at(first, false, { outline: 1, photo: 1, review: 1, export: 1, settings: 1, focus: 1, [tool]: 0 }), at(first))).toBe(false);
    }
  });

  it('says where every tool is, also when it is in «Altro»', () => {
    for (const title of ['Metti i concetti dove vuoi', 'Bianca o colorata', 'La scaletta', 'Dal libro', 'Salva, stampa, manda', 'Come la vedi']) {
      expect(TUTORIAL_STEPS.find((s) => s.title === title)?.text).toContain('«Altro»');
    }
  });

  it('ends with a step that has nothing to check', () => {
    expect(TUTORIAL_STEPS.at(-1)?.done).toBeUndefined();
  });
});
