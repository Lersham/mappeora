import { describe, expect, it } from 'vitest';
import { preferredVoice } from './types';

const local = { name: 'Alice', lang: 'it-IT', localService: true };
const google = { name: 'Google italiano', lang: 'it-IT', localService: false };
const googleUs = { name: 'Google US English', lang: 'en-US', localService: false };

describe('preferredVoice', () => {
  it('picks Google’s Italian voice', () => {
    expect(preferredVoice([googleUs, local, google])).toBe(google);
    expect(preferredVoice([{ ...google, lang: 'it_IT' }])?.name).toBe('Google italiano');
  });

  it('has nothing to pick without it', () => {
    expect(preferredVoice([local, googleUs])).toBeUndefined();
    expect(preferredVoice([])).toBeUndefined();
  });

  it('skips an online voice when the device is offline', () => {
    expect(preferredVoice([local, google], 'it-IT', false)).toBeUndefined();
    expect(preferredVoice([{ ...google, localService: true }], 'it-IT', false)?.name).toBe('Google italiano');
  });
});
