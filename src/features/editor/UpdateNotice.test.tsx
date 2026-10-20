import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { UpdateNotice } from './UpdateNotice';
import { useUpdateReady } from '../../services/pwaUpdate';

const apply = vi.hoisted(() => vi.fn(async () => true));
vi.mock('../../services/pwaUpdate', async (original) => ({
  ...(await original<typeof import('../../services/pwaUpdate')>()),
  applyUpdate: apply,
}));

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let host: HTMLDivElement;
let root: Root;

const button = (name: string) => [...host.querySelectorAll('button')].find((b) => b.textContent === name);

beforeEach(async () => {
  apply.mockClear();
  apply.mockResolvedValue(true);
  useUpdateReady.setState({ ready: false, later: false });
  host = document.createElement('div');
  document.body.append(host);
  root = createRoot(host);
  await act(async () => root.render(<UpdateNotice />));
});

afterEach(async () => {
  await act(async () => root.unmount());
  host.remove();
});

describe('UpdateNotice', () => {
  it('non dice niente finché non c’è una versione nuova', () => {
    expect(host.textContent).toBe('');
  });

  it('con una versione nuova offre «Aggiorna» e «Dopo»', async () => {
    await act(async () => useUpdateReady.setState({ ready: true }));
    expect(host.querySelector('[role="status"]')?.textContent).toBe('È uscita una nuova versione di MappAmi.');
    await act(async () => button('Aggiorna')!.click());
    expect(apply).toHaveBeenCalledTimes(1);
    // While the map is saved and the page reloads, a second tap does nothing.
    expect(button('Aggiorna')!.disabled).toBe(true);
  });

  it('«Dopo» lo nasconde fino al prossimo avvio', async () => {
    await act(async () => useUpdateReady.setState({ ready: true }));
    await act(async () => button('Dopo')!.click());
    expect(host.textContent).toBe('');
    expect(useUpdateReady.getState()).toEqual({ ready: true, later: true });
  });

  it('se la mappa non si salva, «Aggiorna» torna utilizzabile', async () => {
    apply.mockResolvedValue(false);
    await act(async () => useUpdateReady.setState({ ready: true }));
    await act(async () => button('Aggiorna')!.click());
    expect(button('Aggiorna')!.disabled).toBe(false);
  });
});
