import { describe, expect, it } from 'vitest';
import { hasCrossLinks, mapToOutline, mapToSentences, mapToText, speakable } from './mapText';
import type { ConceptMap, MapEdge, MapNode } from '../types/map';

const at = (id: string, label: string, y: number, extra: Partial<MapNode> = {}): MapNode => ({ id, label, position: { x: 0, y }, ...extra });
const edge = (source: string, target: string, label?: string): MapEdge => ({ id: `${source}-${target}`, source, target, label });
const map = (title: string, nodes: MapNode[], edges: MapEdge[]): ConceptMap => ({
  id: 'm',
  title,
  createdAt: 0,
  updatedAt: 0,
  template: 'libera',
  nodes,
  edges,
});

/** Acqua → idrogeno → atomo; acqua → ossigeno; acqua → mari (with an «Onde» branch under it). */
const water = (collapsed = false) =>
  map(
    'Acqua',
    [
      at('a', 'Acqua', 0),
      at('h', 'Idrogeno', 100),
      at('t', 'Atomo', 200),
      at('o', 'Ossigeno', 300),
      at('m', 'Mari', 400, { collapsed }),
      at('w', 'Onde', 500),
    ],
    [edge('a', 'h', 'è formata da'), edge('h', 't', 'ha un solo'), edge('a', 'o', 'è formata da'), edge('a', 'm', 'si trova nei'), edge('m', 'w', 'hanno le')],
  );

describe('mapToOutline', () => {
  it('writes the title, then the concepts as bullets, two spaces more for each level', () => {
    expect(mapToOutline(water())).toBe(
      ['Acqua', '- Idrogeno', '  - Atomo', '- Ossigeno', '- Mari', '  - Onde'].join('\n'),
    );
  });

  it('leaves out what a collapsed concept hides, like the reading does', () => {
    const text = mapToOutline(water(true));
    expect(text).toBe(['Acqua', '- Idrogeno', '  - Atomo', '- Ossigeno', '- Mari'].join('\n'));
    expect(text).not.toContain('Onde');
  });

  it('keeps the main concept as a bullet when it is not the title', () => {
    expect(mapToOutline({ ...water(), title: 'Il ciclo dell’acqua' })).toBe(
      ['Il ciclo dell’acqua', '- Acqua', '  - Idrogeno', '    - Atomo', '  - Ossigeno', '  - Mari', '    - Onde'].join('\n'),
    );
  });

  it('follows the order of the sheet (top to bottom), not the order the concepts were made in', () => {
    const m = map('Mappa', [at('r', 'Mappa', 0), at('b', 'Seconda', 200), at('a', 'Prima', 100)], [edge('r', 'b'), edge('r', 'a')]);
    expect(mapToOutline(m)).toBe('Mappa\n- Prima\n- Seconda');
  });

  it('puts a concept on two lines on one, and does not repeat the title in a first bullet', () => {
    const m = map('La Rivoluzione  francese', [at('r', 'La Rivoluzione francese', 0), at('c', 'Le cause\n1789', 100)], [edge('r', 'c')]);
    expect(mapToOutline(m)).toBe('La Rivoluzione francese\n- Le cause 1789');
  });

  it('lists the concepts nobody linked after the tree, at the same level as its main concept', () => {
    const m = map('Mappa', [at('r', 'Mappa', 0), at('c', 'Figlio', 100), at('x', 'Solo', 200)], [edge('r', 'c')]);
    expect(mapToOutline(m)).toBe('Mappa\n- Mappa\n  - Figlio\n- Solo');
  });

  it('survives a loop and an empty concept', () => {
    const loop = map('Ciclo', [at('a', 'Evaporazione', 0), at('b', 'Pioggia', 100)], [edge('a', 'b'), edge('b', 'a')]);
    expect(mapToOutline(loop)).toBe('Ciclo\n- Evaporazione\n  - Pioggia');
    const empty = map('Mappa', [at('r', 'Mappa', 0), at('e', '  ', 100), at('c', 'Dentro', 200)], [edge('r', 'e'), edge('e', 'c')]);
    expect(mapToOutline(empty)).toBe('Mappa\n- Dentro');
  });

  it('has just a title for an empty map, «Mappa» if it has none', () => {
    expect(mapToOutline(map('Vuota', [], []))).toBe('Vuota');
    expect(mapToOutline(map('  ', [], []))).toBe('Mappa');
  });
});

describe('mapToSentences', () => {
  it('gives the sentences of the reading, a paragraph for each branch', () => {
    expect(mapToSentences(water())).toBe(
      [
        'Acqua',
        'Acqua è formata da Idrogeno. Idrogeno ha un solo Atomo.',
        'Acqua è formata da Ossigeno.',
        'Acqua si trova nei Mari. Mari hanno le Onde.',
      ].join('\n\n'),
    );
  });

  it('does not say what a collapsed concept hides', () => {
    const text = mapToSentences(water(true));
    expect(text).toBe(['Acqua', 'Acqua è formata da Idrogeno. Idrogeno ha un solo Atomo.', 'Acqua è formata da Ossigeno.', 'Acqua si trova nei Mari.'].join('\n\n'));
    expect(text).not.toContain('Onde');
  });

  it('starts with the main concept when it is not the title, and writes a concept without linking words on its own', () => {
    const m = map('Il ciclo', [at('a', 'Acqua', 0), at('h', 'Idrogeno', 100), at('o', 'Ossigeno', 200)], [edge('a', 'h', 'ha'), edge('a', 'o')]);
    expect(mapToSentences(m)).toBe('Il ciclo\n\nAcqua.\n\nAcqua ha Idrogeno.\n\nOssigeno.');
  });

  it('puts a concept on two lines on one and does not double a full stop', () => {
    const m = map('Storia', [at('a', 'Storia', 0), at('b', 'Il 1789\nè l’anno', 100), at('c', 'Perché?', 200)], [edge('a', 'b', 'inizia con'), edge('a', 'c', 'chiede')]);
    expect(mapToSentences(m)).toBe('Storia\n\nStoria inizia con Il 1789 è l’anno.\n\nStoria chiede Perché?');
  });

  it('has just a title for an empty map', () => {
    expect(mapToSentences(map('Vuota', [], []))).toBe('Vuota');
  });

  describe('links the tree cannot show', () => {
    /** Fuoco and Sole both lead to Calore: one link is a branch, the other goes across. */
    const heat = () =>
      map(
        'Calore',
        [at('c', 'Calore', 0), at('f', 'Fuoco', 100), at('s', 'Sole', 200), at('k', 'Cenere', 300)],
        [edge('c', 'f', 'nasce dal'), edge('c', 's', 'nasce dal'), edge('f', 'k', 'lascia'), edge('s', 'f', 'accende il')],
      );

    it('tells them in a last paragraph, so a relation the child drew is not lost', () => {
      expect(mapToSentences(heat())).toBe(
        ['Calore', 'Calore nasce dal Fuoco. Fuoco lascia Cenere.', 'Calore nasce dal Sole.', 'Sole accende il Fuoco.'].join('\n\n'),
      );
    });

    it('writes a link without words as a connection, in the direction it was drawn', () => {
      const m = map('Acqua', [at('a', 'Acqua', 0), at('e', 'Evaporazione', 100), at('n', 'Nuvole', 200)], [edge('a', 'e', 'comincia con'), edge('a', 'n', 'continua con'), edge('n', 'e')]);
      expect(mapToSentences(m)).toBe(
        ['Acqua', 'Acqua comincia con Evaporazione.', 'Acqua continua con Nuvole.', 'C’è un collegamento da Nuvole a Evaporazione.'].join('\n\n'),
      );
    });

    it('tells the link that closes a loop, once, in the order of the sheet', () => {
      const loop = map('Ciclo', [at('a', 'Evaporazione', 0), at('b', 'Pioggia', 100)], [edge('a', 'b', 'diventa'), edge('b', 'a', 'torna'), edge('b', 'a', 'torna')]);
      expect(mapToSentences(loop)).toBe(['Ciclo', 'Evaporazione.', 'Evaporazione diventa Pioggia.', 'Pioggia torna Evaporazione.'].join('\n\n'));
    });

    it('leaves out a link that starts in a collapsed branch, one with an empty concept and one to itself', () => {
      const m = map(
        'Mappa',
        [at('r', 'Mappa', 0), at('a', 'Chiusa', 100, { collapsed: true }), at('b', 'Nascosta', 200), at('c', 'Aperta', 300), at('e', ' ', 400)],
        [edge('r', 'a'), edge('a', 'b'), edge('r', 'c'), edge('b', 'c', 'guarda'), edge('c', 'e', 'vede'), edge('c', 'c', 'ripete')],
      );
      const text = mapToSentences(m);
      expect(text).toBe(['Mappa', 'Chiusa.', 'Aperta.'].join('\n\n'));
      expect(hasCrossLinks(m)).toBe(false);
    });

    it('does not touch the outline, which says there is something left out', () => {
      expect(mapToOutline(heat())).toBe(['Calore', '- Fuoco', '  - Cenere', '- Sole'].join('\n'));
      expect(hasCrossLinks(heat())).toBe(true);
    });
  });
});

describe('hasCrossLinks', () => {
  it('is false for a plain tree, for a collapsed branch and for an empty map', () => {
    expect(hasCrossLinks(water())).toBe(false);
    expect(hasCrossLinks(water(true))).toBe(false);
    expect(hasCrossLinks(map('Vuota', [], []))).toBe(false);
  });
});

describe('mapToText', () => {
  it('picks the style', () => {
    expect(mapToText(water(), 'scaletta')).toBe(mapToOutline(water()));
    expect(mapToText(water(), 'frasi')).toBe(mapToSentences(water()));
  });
});

describe('speakable', () => {
  it('takes the bullets and the indent off an outline, keeps the title as it is', () => {
    expect(speakable(mapToOutline(water()), 'scaletta')).toBe(['Acqua', 'Idrogeno', 'Atomo', 'Ossigeno', 'Mari', 'Onde'].join('\n'));
    // Only the bullet: a concept that starts with a dash keeps it
    expect(speakable('Mappa\n- - 5 gradi', 'scaletta')).toBe('Mappa\n- 5 gradi');
    expect(speakable('- Titolo da non toccare\n- Due', 'scaletta')).toBe('- Titolo da non toccare\nDue');
  });

  it('leaves the sentences as they are', () => {
    const text = mapToSentences(water());
    expect(speakable(text, 'frasi')).toBe(text);
  });
});
