import { describe, expect, it } from 'vitest';
import { autoLayout } from './layout';

describe('autoLayout', () => {
  it('places children below their parent', async () => {
    const pos = await autoLayout(
      [
        { id: 'a', label: 'a', position: { x: 0, y: 0 } },
        { id: 'b', label: 'b', position: { x: 0, y: 0 } },
        { id: 'c', label: 'c', position: { x: 0, y: 0 } },
      ],
      [
        { id: 'ab', source: 'a', target: 'b' },
        { id: 'ac', source: 'a', target: 'c' },
      ],
    );
    expect(pos.b.y).toBeGreaterThan(pos.a.y);
    expect(pos.c.y).toBeGreaterThan(pos.a.y);
    expect(pos.b.x).not.toBe(pos.c.x);
  });

  it('makes room for long linking words', async () => {
    const nodes = ['a', 'b'].map((id) => ({ id, label: id, position: { x: 0, y: 0 } }));
    const plain = await autoLayout(nodes, [{ id: 'ab', source: 'a', target: 'b' }]);
    const worded = await autoLayout(nodes, [{ id: 'ab', source: 'a', target: 'b', label: 'è la causa principale di' }]);
    expect(worded.b.y - worded.a.y).toBeGreaterThan(plain.b.y - plain.a.y);
  });
});
