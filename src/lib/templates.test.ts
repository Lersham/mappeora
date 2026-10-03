import { describe, expect, it } from 'vitest';
import { TEMPLATES, buildTemplate } from './templates';
import { readingOrder } from './readingOrder';

describe('templates', () => {
  it.each(TEMPLATES.map((t) => t.id))('%s builds a valid, fully readable map', (id) => {
    const { nodes, edges } = buildTemplate(id, 'Il Risorgimento');
    const ids = new Set(nodes.map((n) => n.id));
    expect(ids.size).toBe(nodes.length);
    for (const e of edges) {
      expect(ids.has(e.source)).toBe(true);
      expect(ids.has(e.target)).toBe(true);
    }
    expect(nodes.some((n) => n.label === 'Il Risorgimento')).toBe(true);
    expect(readingOrder({ nodes, edges })).toHaveLength(nodes.length);
  });
});
