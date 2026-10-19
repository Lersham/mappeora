import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { ErrorBoundary } from './ErrorBoundary';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let host: HTMLDivElement;
let root: Root;
let broken = true;

function Child() {
  if (broken) throw new Error('crash in the child');
  return <p>Tutto bene</p>;
}

async function show(onReset?: () => void | Promise<void>) {
  await act(async () => root.render(<ErrorBoundary onReset={onReset}><Child /></ErrorBoundary>));
}

const buttons = () => [...host.querySelectorAll('button')].map((b) => b.textContent);
const button = (name: string) => [...host.querySelectorAll('button')].find((b) => b.textContent === name)!;

beforeEach(() => {
  localStorage.clear();
  broken = true;
  host = document.createElement('div');
  document.body.append(host);
  root = createRoot(host);
  // React reports the caught error here: expected, and checked below.
  vi.spyOn(console, 'error').mockImplementation(() => {});
});

afterEach(async () => {
  await act(async () => root.unmount());
  host.remove();
  vi.restoreAllMocks();
  Reflect.deleteProperty(navigator, 'clipboard');
});

describe('ErrorBoundary', () => {
  it('shows the message as the only alert, with the three buttons', async () => {
    await show(() => {});
    const alerts = host.querySelectorAll('[role="alert"]');
    expect(alerts).toHaveLength(1);
    expect(alerts[0].tagName).toBe('P');
    expect(alerts[0].textContent).toContain('Le mappe salvate sono al sicuro');
    expect(host.querySelector('h1')?.textContent).toBe('Qualcosa è andato storto');
    expect(buttons()).toEqual(['Torna alle mappe', 'Riavvia l’app', 'Copia i dettagli per chi ti aiuta']);
  });

  it('without a way back (the outer one) offers only the restart and the details', async () => {
    await show();
    expect(buttons()).toEqual(['Riavvia l’app', 'Copia i dettagli per chi ti aiuta']);
    expect(host.querySelector('[role="alert"]')?.textContent).toContain('Riavvia l’app');
  });

  it('keeps the error in the console and in the local log, without map content', async () => {
    await show(() => {});
    expect(console.error).toHaveBeenCalledWith(expect.objectContaining({ message: 'crash in the child' }));
    const log = JSON.parse(localStorage.getItem('mappeora-errors')!);
    expect(log).toHaveLength(1);
    expect(log[0]).toMatchObject({ message: 'crash in the child', source: 'react', platform: 'web' });
  });

  it('«Torna alle mappe» runs onReset and then shows the app again', async () => {
    const onReset = vi.fn();
    await show(onReset);
    broken = false;
    await act(async () => button('Torna alle mappe').click());
    expect(onReset).toHaveBeenCalledOnce();
    expect(host.textContent).toBe('Tutto bene');
  });

  it('copies the details to the clipboard and says so politely', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true });
    await show(() => {});
    const status = host.querySelector('[role="status"]')!;
    expect(status.textContent).toBe('');
    await act(async () => button('Copia i dettagli per chi ti aiuta').click());
    expect(writeText).toHaveBeenCalledOnce();
    expect(writeText.mock.calls[0][0]).toContain('crash in the child');
    expect(writeText.mock.calls[0][0]).toContain(`Versione: ${__APP_VERSION__}`);
    expect(host.querySelector('[role="status"]')?.textContent).toBe('Copiato: incollalo in un messaggio a chi ti aiuta.');
    expect(host.querySelector('textarea')).toBeNull();
  });

  it('shows the details to select by hand when the clipboard is not available', async () => {
    // No navigator.clipboard at all, as on a page that is not secure.
    await show(() => {});
    await act(async () => button('Copia i dettagli per chi ti aiuta').click());
    const box = host.querySelector('textarea')!;
    expect(box.readOnly).toBe(true);
    expect(box.value).toContain('crash in the child');
    expect(host.querySelector('[role="status"]')?.textContent).toContain('Seleziona il testo qui sotto e copialo.');
    expect(host.querySelector('[role="status"]')?.textContent).not.toContain('Copiato');
  });

  it('also falls back when the clipboard refuses', async () => {
    const writeText = vi.fn().mockRejectedValue(new DOMException('no', 'NotAllowedError'));
    Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true });
    await show(() => {});
    await act(async () => button('Copia i dettagli per chi ti aiuta').click());
    expect(host.querySelector('textarea')).not.toBeNull();
  });
});
