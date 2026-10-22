import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { isChunkLoadError, loadInBackground, RELOAD_GAP_MS, takeReload } from './preloadError';

beforeEach(() => sessionStorage.clear());
afterEach(() => vi.restoreAllMocks());

describe('takeReload', () => {
  it('allows the first reload and notes the time', () => {
    expect(takeReload(1_000_000)).toBe(true);
    expect(sessionStorage.getItem('mappeora-reloaded')).toBe('1000000');
  });

  it('does not reload again right after a reload, but does once a while has passed', () => {
    expect(takeReload(1_000_000)).toBe(true);
    expect(takeReload(1_000_000 + 10_000)).toBe(false);
    expect(takeReload(1_000_000 + RELOAD_GAP_MS - 1)).toBe(false);
    // An app left open for days recovers again, with no start in between.
    expect(takeReload(1_000_000 + RELOAD_GAP_MS)).toBe(true);
    expect(takeReload(1_000_000 + RELOAD_GAP_MS + 5_000)).toBe(false);
  });

  it('does not count refused attempts: the wait runs from the last reload', () => {
    expect(takeReload(5_000_000)).toBe(true);
    expect(takeReload(5_000_000 + 50_000)).toBe(false);
    expect(takeReload(5_000_000 + 61_000)).toBe(true);
  });

  it('takes an old flag, a damaged one or one from the future as long ago', () => {
    sessionStorage.setItem('mappeora-reloaded', '1');
    expect(takeReload(5_000_000)).toBe(true);
    sessionStorage.setItem('mappeora-reloaded', 'abc');
    expect(takeReload(5_000_000)).toBe(true);
    sessionStorage.setItem('mappeora-reloaded', String(9_000_000));
    expect(takeReload(5_000_000)).toBe(true);
  });

  it('does not reload when offline: the new version could not be loaded either', () => {
    vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(false);
    expect(takeReload()).toBe(false);
    expect(sessionStorage.getItem('mappeora-reloaded')).toBeNull();
  });

  it('does not reload when the storage is blocked', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new DOMException('blocked', 'SecurityError');
    });
    expect(takeReload()).toBe(false);
  });
});

describe('loadInBackground', () => {
  it('holds back the reload while the load runs, also when it fails, and not after', async () => {
    let fail!: (e: Error) => void;
    const pending = loadInBackground(() => new Promise<void>((_, reject) => (fail = reject)));
    // The failure event of the browser comes while the load has not settled yet.
    expect(takeReload()).toBe(false);
    fail(new Error('Failed to fetch dynamically imported module'));
    await expect(pending).rejects.toThrow('dynamically imported');
    expect(takeReload()).toBe(true);
  });

  it('returns what the load returns', async () => {
    await expect(loadInBackground(async () => 42)).resolves.toBe(42);
  });
});

describe('isChunkLoadError', () => {
  it('knows how Chrome, Firefox and Safari word a part that did not load', () => {
    expect(isChunkLoadError(new TypeError('Failed to fetch dynamically imported module: https://x/a.js'))).toBe(true);
    expect(isChunkLoadError(new TypeError('error loading dynamically imported module: https://x/a.js'))).toBe(true);
    expect(isChunkLoadError(new TypeError('Importing a module script failed.'))).toBe(true);
    expect(isChunkLoadError(new Error('Loading chunk 12 failed.'))).toBe(true);
    expect(isChunkLoadError(new Error('Unable to preload CSS for /assets/MapEditor-abc.css'))).toBe(true);
  });

  it('is not fooled by other errors', () => {
    expect(isChunkLoadError(new Error('Cannot read properties of undefined'))).toBe(false);
    expect(isChunkLoadError(null)).toBe(false);
  });
});
