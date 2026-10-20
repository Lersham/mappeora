import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { applyUpdate, checkForUpdate, rememberRegistration, reloadIfSafe, takeReopen, updateReady, useUpdateReady } from './pwaUpdate';
import { useMapStore } from '../store/mapStore';

const flush = vi.hoisted(() => vi.fn(async () => true));
vi.mock('./autosave', () => ({ flushAutosave: flush }));

const reload = vi.fn();
let online = true;

/** A service worker registration whose update() finds `found` (or fails). */
function fakeRegistration(found: 'none' | 'new' | 'error') {
  const r = { installing: null as unknown, waiting: null, update: vi.fn() };
  r.update.mockImplementation(async () => {
    if (found === 'error') throw new Error('network');
    if (found === 'new') r.installing = {};
    return r;
  });
  rememberRegistration(r as unknown as ServiceWorkerRegistration);
  return r;
}

beforeEach(() => {
  reload.mockClear();
  flush.mockClear();
  flush.mockResolvedValue(true);
  online = true;
  sessionStorage.clear();
  useUpdateReady.setState({ ready: false, later: false });
  useMapStore.setState({ map: null });
  vi.stubGlobal('window', { location: { reload } });
  vi.stubGlobal('document', { querySelector: () => null });
  vi.stubGlobal('navigator', { get onLine() { return online; } });
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe('pwaUpdate', () => {
  it('only marks the update ready: it never reloads by itself', () => {
    updateReady();
    expect(useUpdateReady.getState().ready).toBe(true);
    expect(reload).not.toHaveBeenCalled();
  });

  it('reloads when hidden on the list, once', () => {
    updateReady();
    reloadIfSafe();
    reloadIfSafe();
    expect(reload).toHaveBeenCalledTimes(1);
  });

  it('does nothing without an update, in a map, or with a dialog open', () => {
    reloadIfSafe();
    updateReady();
    useMapStore.setState({ map: { id: 'a' } as never });
    reloadIfSafe();
    useMapStore.setState({ map: null });
    vi.stubGlobal('document', { querySelector: () => ({}) });
    reloadIfSafe();
    expect(reload).not.toHaveBeenCalled();
    expect(useUpdateReady.getState().ready).toBe(true);
  });
});

describe('checkForUpdate', () => {
  it('dice «ultima versione» quando il server non ha niente di nuovo', async () => {
    const r = fakeRegistration('none');
    await expect(checkForUpdate()).resolves.toBe('latest');
    expect(r.update).toHaveBeenCalledTimes(1);
  });

  it('aspetta la versione nuova che si sta scaricando', async () => {
    fakeRegistration('new');
    const result = checkForUpdate();
    await Promise.resolve();
    await Promise.resolve();
    updateReady();
    await expect(result).resolves.toBe('ready');
  });

  it('dopo un po’ smette di aspettare e dice che sta scaricando', async () => {
    vi.useFakeTimers();
    fakeRegistration('new');
    const result = checkForUpdate(1000);
    await vi.advanceTimersByTimeAsync(1000);
    await expect(result).resolves.toBe('downloading');
  });

  it('senza internet non chiede niente al server', async () => {
    const r = fakeRegistration('none');
    online = false;
    await expect(checkForUpdate()).resolves.toBe('offline');
    expect(r.update).not.toHaveBeenCalled();
  });

  it('se la richiesta fallisce dice di riprovare più tardi', async () => {
    fakeRegistration('error');
    await expect(checkForUpdate()).resolves.toBe('unavailable');
  });

  it('se la versione nuova è già pronta non chiede niente', async () => {
    const r = fakeRegistration('none');
    updateReady();
    await expect(checkForUpdate()).resolves.toBe('ready');
    expect(r.update).not.toHaveBeenCalled();
  });
});

describe('applyUpdate', () => {
  it('salva, ricorda la mappa aperta e carica la versione nuova', async () => {
    updateReady();
    useMapStore.setState({ map: { id: 'mappa-1' } as never });
    await expect(applyUpdate()).resolves.toBe(true);
    expect(flush).toHaveBeenCalled();
    expect(reload).toHaveBeenCalledTimes(1);
    expect(takeReopen()).toBe('mappa-1');
    // Only once: a later reload starts on the list.
    expect(takeReopen()).toBeNull();
  });

  it('dalla lista non riapre nessuna mappa', async () => {
    await applyUpdate();
    expect(reload).toHaveBeenCalledTimes(1);
    expect(takeReopen()).toBeNull();
  });

  it('se non riesce a salvare resta dov’è', async () => {
    flush.mockResolvedValue(false);
    updateReady();
    useMapStore.setState({ map: { id: 'mappa-1' } as never });
    await expect(applyUpdate()).resolves.toBe(false);
    expect(reload).not.toHaveBeenCalled();
    expect(takeReopen()).toBeNull();
    expect(useUpdateReady.getState().ready).toBe(true);
  });
});
