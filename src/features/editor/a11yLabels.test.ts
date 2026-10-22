import { describe, expect, it } from 'vitest';
import { MAP_ARIA_LABELS, edgeAriaLabel, spokenLabel } from './a11yLabels';

describe('screen reader labels', () => {
  it('reads a concept on one line', () => {
    expect(spokenLabel('Il ciclo\ndell’acqua')).toBe('Il ciclo dell’acqua');
    expect(spokenLabel('  tanti   spazi \t qui  ')).toBe('tanti spazi qui');
  });

  it('a concept without words still has a name', () => {
    expect(spokenLabel('')).toBe('Concetto senza nome');
    expect(spokenLabel(' \n\t ')).toBe('Concetto senza nome');
  });

  it('names a link by its two ends and its linking word', () => {
    expect(edgeAriaLabel('Acqua', 'Pioggia', ' diventa ')).toBe('Collegamento da «Acqua» a «Pioggia»: diventa');
  });

  it('a link without linking word has no colon', () => {
    expect(edgeAriaLabel('Acqua', 'Pioggia')).toBe('Collegamento da «Acqua» a «Pioggia»');
    expect(edgeAriaLabel('Acqua', 'Pioggia', '   ')).toBe('Collegamento da «Acqua» a «Pioggia»');
  });

  it('the ends of a link are read like concepts', () => {
    expect(edgeAriaLabel('Il\nsole', '')).toBe('Collegamento da «Il sole» a «Concetto senza nome»');
  });

  it('says in Italian where a concept was moved', () => {
    const say = MAP_ARIA_LABELS['node.a11yDescription.ariaLiveMessage']!;
    expect(say({ direction: 'up', x: 0, y: 0 })).toBe('Concetto spostato in su.');
    expect(say({ direction: 'right', x: 0, y: 0 })).toBe('Concetto spostato a destra.');
    expect(say({ direction: 'diagonal', x: 0, y: 0 })).toBe('Concetto spostato diagonal.');
  });
});
