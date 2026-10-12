import { beforeEach, describe, expect, it, vi } from 'vitest';
import { reloadIfSafe, updateReady, useUpdateReady } from './pwaUpdate';
import { useMapStore } from '../store/mapStore';

const reload = vi.fn();

beforeEach(() => {
  reload.mockClear();
  useUpdateReady.setState({ ready: false });
  useMapStore.setState({ map: null });
  vi.stubGlobal('window', { location: { reload } });
  vi.stubGlobal('document', { querySelector: () => null });
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
