import { describe, expect, it } from 'vitest';
import { toFileUri } from './fileUri';

describe('toFileUri', () => {
  it('adds the file:// scheme to plain Android paths', () => {
    expect(toFileUri('/data/user/0/it.mappami.app/cache/IMG_1.jpg')).toBe(
      'file:///data/user/0/it.mappami.app/cache/IMG_1.jpg',
    );
  });

  it('encodes spaces', () => {
    expect(toFileUri('/storage/Foto scuola/p 1.jpg')).toBe('file:///storage/Foto%20scuola/p%201.jpg');
  });

  it('leaves URIs with a scheme untouched', () => {
    expect(toFileUri('file:///a.jpg')).toBe('file:///a.jpg');
    expect(toFileUri('content://media/external/images/1')).toBe('content://media/external/images/1');
  });
});
