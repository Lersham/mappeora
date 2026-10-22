import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { forgetBookPage, loadBookPage, saveBookPage } from './bookPage';

describe('bookPage', () => {
  beforeEach(() => localStorage.clear());
  afterEach(() => vi.restoreAllMocks());

  it('remembers the page and the words already taken, per map', () => {
    saveBookPage('m1', { text: 'Il fiume scorre', used: [0, 2] });
    saveBookPage('m2', { text: 'Il vulcano', used: [] });
    expect(loadBookPage('m1')).toEqual({ text: 'Il fiume scorre', used: [0, 2] });
    expect(loadBookPage('m2')).toEqual({ text: 'Il vulcano', used: [] });
  });

  it('a map with no page read has none', () => {
    expect(loadBookPage('nuova')).toBeNull();
  });

  it('saving again replaces the page', () => {
    saveBookPage('m1', { text: 'pagina 1', used: [0] });
    saveBookPage('m1', { text: 'pagina 2', used: [] });
    expect(loadBookPage('m1')).toEqual({ text: 'pagina 2', used: [] });
  });

  it('forgets the page of one map only', () => {
    saveBookPage('m1', { text: 'a', used: [] });
    saveBookPage('m2', { text: 'b', used: [] });
    forgetBookPage('m1');
    expect(loadBookPage('m1')).toBeNull();
    expect(loadBookPage('m2')).not.toBeNull();
    expect(() => forgetBookPage('mai-salvata')).not.toThrow();
  });

  it('ignores what is not a page', () => {
    const key = 'mappeora-dal-libro:m1';
    for (const junk of ['{non è json', 'null', '42', '"testo"', '{"text":"a"}', '{"used":[]}', '{"text":3,"used":[]}', '{"text":"a","used":{}}']) {
      localStorage.setItem(key, junk);
      expect(loadBookPage('m1'), junk).toBeNull();
    }
  });

  it('keeps working when the storage is blocked or full', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('SecurityError');
    });
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('QuotaExceededError');
    });
    vi.spyOn(Storage.prototype, 'removeItem').mockImplementation(() => {
      throw new Error('SecurityError');
    });
    expect(() => saveBookPage('m1', { text: 'a', used: [] })).not.toThrow();
    expect(loadBookPage('m1')).toBeNull();
    expect(() => forgetBookPage('m1')).not.toThrow();
  });
});
