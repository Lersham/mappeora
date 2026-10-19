import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// The module keeps this session's errors in memory: each test starts from a fresh copy.
async function load() {
  vi.resetModules();
  return import('./errorLog');
}

beforeEach(() => localStorage.clear());
afterEach(() => vi.restoreAllMocks());

describe('logError', () => {
  it('stores the time, message, version, platform and where it was caught', async () => {
    const { logError, readErrorLog } = await load();
    logError(new TypeError('boom'), 'react');
    const [entry, ...rest] = readErrorLog();
    expect(rest).toEqual([]);
    expect(entry.message).toBe('TypeError: boom');
    expect(entry.source).toBe('react');
    expect(entry.platform).toBe('web');
    expect(entry.version).toBe(__APP_VERSION__);
    expect(new Date(entry.time).toISOString()).toBe(entry.time);
  });

  it('keeps the last 10 errors, oldest first', async () => {
    const { logError, readErrorLog } = await load();
    for (let i = 0; i < 13; i++) logError(new Error(`e${i}`), 'window');
    const log = readErrorLog();
    expect(log).toHaveLength(10);
    expect(log.map((e) => e.message)).toEqual(Array.from({ length: 10 }, (_, i) => `e${i + 3}`));
    expect(JSON.parse(localStorage.getItem('mappeora-errors')!)).toHaveLength(10);
  });

  it('cuts the message to 200 characters and the stack to 5 frames', async () => {
    const { logError, readErrorLog } = await load();
    const error = new Error('x'.repeat(500));
    error.stack = ['Error: ' + 'x'.repeat(500), ...Array.from({ length: 12 }, (_, i) => `    at f${i} (https://example.org/${'a'.repeat(400)}.js:1:1)`)].join('\n');
    logError(error, 'window');
    const [entry] = readErrorLog();
    expect(entry.message).toHaveLength(200);
    expect(entry.stack).toHaveLength(5);
    expect(entry.stack[0].startsWith('at f0 (')).toBe(true);
    expect(entry.stack.every((frame) => frame.length <= 200)).toBe(true);
  });

  it('keeps every frame of a stack that does not repeat the message (Firefox, Safari)', async () => {
    const { logError, readErrorLog } = await load();
    const error = new Error('oops');
    error.stack = 'first@https://example.org/a.js:1:1\nsecond@https://example.org/a.js:2:2';
    logError(error, 'window');
    expect(readErrorLog()[0].stack).toEqual(['first@https://example.org/a.js:1:1', 'second@https://example.org/a.js:2:2']);
  });

  it('describes what is not an Error without storing objects', async () => {
    const { logError, readErrorLog } = await load();
    logError('just a text', 'promise');
    logError({ title: 'La mia mappa segreta' }, 'promise');
    logError(undefined, 'promise');
    const log = readErrorLog();
    expect(log.map((e) => e.message)).toEqual(['just a text', 'Not an Error (object)', 'Not an Error (undefined)']);
    expect(JSON.stringify(log)).not.toContain('segreta');
  });

  it('leaves out pictures', async () => {
    const { logError, readErrorLog } = await load();
    logError(new Error('Image failed: data:image/jpeg;base64,/9j/4AAQSkZJRgABAQ=='), 'window');
    const text = JSON.stringify(readErrorLog());
    expect(text).not.toContain('/9j/');
  });

  it('leaves out the text around a JSON error, in each form the engine writes it', async () => {
    const { logError, readErrorLog, errorReport } = await load();
    // Made by the engine itself: how it quotes the text differs (short, cut, or from the middle).
    const texts = [
      'x',
      'Il mio diario segreto: oggi ho litigato con Luca',
      '[1,2,3,4,5,6,7,8,9,10, il diario segreto di Anna e di tutta la classe',
    ];
    for (const text of texts) {
      try {
        JSON.parse(text);
      } catch (e) {
        logError(e, 'promise');
      }
    }
    const log = JSON.stringify(readErrorLog());
    const report = errorReport();
    for (const secret of ['diario', 'segreto', 'Luca', 'Anna', 'classe']) {
      expect(log).not.toContain(secret);
      expect(localStorage.getItem('mappeora-errors')).not.toContain(secret);
      expect(report).not.toContain(secret);
    }
  });

  it('also leaves out the text of the forms other engines write', async () => {
    const { logError, readErrorLog } = await load();
    logError(new SyntaxError('Unexpected token \'I\', "Il mio dia"... is not valid JSON'), 'window');
    logError(new SyntaxError('Unexpected token \'m\', ..."7,8,9,10, mio diario"... is not valid JSON'), 'window');
    logError(new SyntaxError('Unexpected token \'a\', "a map titl" is not valid JSON'), 'window');
    const log = readErrorLog();
    expect(log.map((e) => e.message)).toEqual([
      'SyntaxError: Unexpected token \'I\', "…" is not valid JSON',
      'SyntaxError: Unexpected token \'m\', ..."…" is not valid JSON',
      'SyntaxError: Unexpected token \'a\', "…" is not valid JSON',
    ]);
  });

  it('never throws when the storage is blocked, and still knows this session\'s errors', async () => {
    const { logError, readErrorLog, errorReport } = await load();
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new DOMException('blocked', 'SecurityError');
    });
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new DOMException('blocked', 'SecurityError');
    });
    expect(() => logError(new Error('while blocked'), 'react')).not.toThrow();
    expect(() => readErrorLog()).not.toThrow();
    expect(readErrorLog().map((e) => e.message)).toEqual(['while blocked']);
    expect(errorReport()).toContain('while blocked');
  });

  it('never throws when the storage is full', async () => {
    const { logError } = await load();
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new DOMException('full', 'QuotaExceededError');
    });
    expect(() => logError(new Error('x'), 'window')).not.toThrow();
  });
});

describe('readErrorLog', () => {
  it('is empty with nothing stored, or with something that is not a log', async () => {
    const { readErrorLog } = await load();
    expect(readErrorLog()).toEqual([]);
    localStorage.setItem('mappeora-errors', '{not json');
    expect(readErrorLog()).toEqual([]);
    localStorage.setItem('mappeora-errors', '{"a":1}');
    expect(readErrorLog()).toEqual([]);
  });

  it('drops the entries that are not well-formed and cuts the long ones', async () => {
    const { readErrorLog } = await load();
    const ok = { time: '2026-01-01T00:00:00.000Z', message: 'm'.repeat(300), stack: ['a', 'b', 'c', 'd', 'e', 'f'], version: '1', platform: 'ios', source: 'window' };
    localStorage.setItem('mappeora-errors', JSON.stringify([null, 'x', { time: 1 }, ok]));
    const log = readErrorLog();
    expect(log).toHaveLength(1);
    expect(log[0].message).toHaveLength(200);
    expect(log[0].stack).toHaveLength(5);
    expect(log[0].platform).toBe('ios');
  });
});

describe('errorReport', () => {
  it('says there is nothing to report when the log is empty', async () => {
    const { errorReport } = await load();
    const report = errorReport();
    expect(report).toContain(`Versione: ${__APP_VERSION__}`);
    expect(report).toContain('Sistema: web');
    expect(report).toContain(`Browser: ${navigator.userAgent}`);
    expect(report).toContain('Nessun errore registrato.');
  });

  it('lists the errors with their frames, as plain text', async () => {
    const { errorReport, logError } = await load();
    const error = new RangeError('too far');
    error.stack = 'RangeError: too far\n    at here (https://example.org/a.js:1:2)';
    logError(error, 'react');
    const report = errorReport();
    expect(report).toContain('1. ');
    expect(report).toContain('(react, versione');
    expect(report).toContain('RangeError: too far');
    expect(report).toContain('at here (https://example.org/a.js:1:2)');
    expect(report).not.toContain('Nessun errore');
  });
});
