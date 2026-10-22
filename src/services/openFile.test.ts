import { afterEach, describe, expect, it, vi } from 'vitest';
import { MAX_FILE_BYTES, pickMapFile } from './openFile';
import { MapFileError } from '../lib/mapFile';

afterEach(() => vi.restoreAllMocks());

/** Runs pickMapFile with a picker that answers at once with this file (or none). */
function pick(file?: File) {
  const input = document.createElement('input');
  Object.defineProperty(input, 'files', { value: file ? [file] : [] });
  input.click = () => input.dispatchEvent(new Event('change'));
  vi.spyOn(document, 'createElement').mockReturnValueOnce(input);
  return pickMapFile();
}

describe('pickMapFile', () => {
  it('returns the text of the file', async () => {
    const file = new File(['{"a":1}'], 'mappa.mappami');
    await expect(pick(file)).resolves.toBe('{"a":1}');
  });

  it('returns null when nothing is picked', async () => {
    await expect(pick()).resolves.toBeNull();
  });

  it('refuses a file over the limit without reading it', async () => {
    const file = new File(['x'], 'enorme.mappami');
    Object.defineProperty(file, 'size', { value: MAX_FILE_BYTES + 1 });
    const text = vi.spyOn(file, 'text');
    const error = await pick(file).catch((e: unknown) => e);
    expect(error).toBeInstanceOf(MapFileError);
    expect(text).not.toHaveBeenCalled();
  });

  it('reads a file right at the limit', async () => {
    const file = new File(['{}'], 'grande.mappami');
    Object.defineProperty(file, 'size', { value: MAX_FILE_BYTES });
    await expect(pick(file)).resolves.toBe('{}');
  });
});
