import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { spostaHintDue, spostaHintShown, spostaHintText, spostaUsed } from './spostaHint';

beforeEach(() => localStorage.clear());
afterEach(() => vi.restoreAllMocks());

describe('spostaHint', () => {
  it('is shown three times at most on a device', () => {
    for (let i = 0; i < 3; i++) {
      expect(spostaHintDue()).toBe(true);
      spostaHintShown();
    }
    expect(spostaHintDue()).toBe(false);
  });

  it('is not shown again once «Sposta» was used', () => {
    spostaUsed();
    expect(spostaHintDue()).toBe(false);
  });

  it('stays quiet when the storage cannot be read, and does not break when it cannot be written', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('blocked');
    });
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('blocked');
    });
    expect(spostaHintDue()).toBe(false);
    expect(() => spostaHintShown()).not.toThrow();
    expect(() => spostaUsed()).not.toThrow();
  });

  it('says where «Sposta» is', () => {
    expect(spostaHintText(true)).toContain('«Altro»');
    expect(spostaHintText(false)).not.toContain('«Altro»');
    expect(spostaHintText(false)).toContain('«Sposta»');
  });
});
