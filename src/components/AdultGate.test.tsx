import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { AdultGate, adultQuestion } from './AdultGate';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let host: HTMLDivElement;
let root: Root;

beforeEach(() => {
  host = document.createElement('div');
  document.body.append(host);
  root = createRoot(host);
});
afterEach(() => {
  act(() => root.unmount());
  host.remove();
});

const field = () => host.querySelector('input')!;
const button = (name: string) => [...host.querySelectorAll('button')].find((b) => b.textContent?.includes(name))!;
/** The two numbers of the question on screen. */
const asked = () => host.querySelector('label span')!.textContent!.match(/(\d+) × (\d+)/)!.slice(1).map(Number);

async function type(value: string) {
  const input = field();
  // React listens to the native setter, not to `value =`.
  Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(input, value);
  await act(async () => void input.dispatchEvent(new Event('input', { bubbles: true })));
}

describe('adultQuestion', () => {
  it('always a two-digit number times a one-digit one, not 1 or 2', () => {
    for (const r of [0, 0.5, 0.999999]) {
      const { a, b } = adultQuestion(() => r);
      expect(a).toBeGreaterThanOrEqual(12);
      expect(a).toBeLessThanOrEqual(98);
      expect(b).toBeGreaterThanOrEqual(3);
      expect(b).toBeLessThanOrEqual(9);
    }
  });
});

describe('AdultGate', () => {
  it('lets through only the right answer; a wrong one gets a new question', async () => {
    const onPass = vi.fn();
    await act(async () => root.render(<AdultGate what="aprire Google Immagini" onPass={onPass} onClose={() => {}} />));
    expect(host.textContent).toContain('Per aprire Google Immagini serve il permesso di un adulto');
    const [a, b] = asked();
    await type(String(a * b + 1));
    await act(async () => button('Continua').click());
    expect(onPass).not.toHaveBeenCalled();
    expect(host.querySelector('[role="alert"]')?.textContent).toContain('Non è giusto');
    expect(field().value).toBe('');
    const [c, d] = asked();
    await type(String(c * d));
    await act(async () => button('Continua').click());
    expect(onPass).toHaveBeenCalledOnce();
  });

  it('«Annulla» closes it without going anywhere', async () => {
    const onPass = vi.fn();
    const onClose = vi.fn();
    await act(async () => root.render(<AdultGate what="uscire" onPass={onPass} onClose={onClose} />));
    await act(async () => button('Annulla').click());
    expect(onClose).toHaveBeenCalled();
    expect(onPass).not.toHaveBeenCalled();
  });
});
