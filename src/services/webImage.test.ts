import { describe, expect, it } from 'vitest';
import { PasteError, googleImagesUrl, pastedToDataUrl } from './webImage';

describe('webImage', () => {
  it('opens Google Images with SafeSearch on the concept', () => {
    const url = new URL(googleImagesUrl(' Il ciclo dell’acqua '));
    expect(url.hostname).toBe('www.google.com');
    expect(url.searchParams.get('q')).toBe('Il ciclo dell’acqua');
    expect(url.searchParams.get('safe')).toBe('active');
    expect(url.searchParams.get('tbm')).toBe('isch');
  });

  it('explains what to do when the clipboard has no picture', async () => {
    await expect(pastedToDataUrl('ciao')).rejects.toBeInstanceOf(PasteError);
    await expect(pastedToDataUrl(new Blob(['x'], { type: 'text/plain' }))).rejects.toBeInstanceOf(PasteError);
  });
});
