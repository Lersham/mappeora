import { platform } from './platform';

/**
 * The last errors of this device, kept only here (nothing is sent anywhere):
 * when something breaks, the child can copy them into a message to whoever
 * is helping. Never a map, a title or any text the child wrote.
 */
const KEY = 'mappeora-errors';
const MAX_ERRORS = 10;
const MAX_MESSAGE = 200;
const MAX_FRAMES = 5;
const MAX_FRAME = 200;

export interface ErrorEntry {
  /** ISO date and time. */
  time: string;
  message: string;
  /** The first lines of the stack. */
  stack: string[];
  version: string;
  platform: 'web' | 'android' | 'ios';
  /** Where it was caught: 'window', 'promise', 'react'… */
  source: string;
}

/** Errors of this session, for when the storage cannot be written or read. */
let session: ErrorEntry[] = [];

/** Takes out what could carry a map: pictures and the start of a text that failed to parse. */
function scrub(text: string): string {
  // Long enough for any message; short enough that the patterns below stay quick.
  return text
    .slice(0, 1000)
    .replace(/data:[^\s"')]*/g, 'data:…')
    // V8 quotes the start of the text, with "..." after the quote when it cut it, and before it when the error is mid-text.
    .replace(/"[^]*"(?:\.\.\.)? is not valid JSON/, '"…" is not valid JSON')
    .replace(/\s+/g, ' ')
    .trim();
}

function describe(error: unknown): { message: string; stack: string[] } {
  const e = error as { name?: unknown; message?: unknown; stack?: unknown } | null;
  if (typeof e !== 'object' || e === null || typeof e.message !== 'string') {
    // Something thrown that is not an Error: only a string says anything useful.
    return { message: scrub(typeof error === 'string' ? error : `Not an Error (${typeof error})`).slice(0, MAX_MESSAGE), stack: [] };
  }
  const name = typeof e.name === 'string' && e.name ? e.name : 'Error';
  const header = e.message ? `${name}: ${e.message}` : name;
  let stack = typeof e.stack === 'string' ? e.stack : '';
  // Chrome starts the stack with the message again; Firefox and Safari do not.
  if (stack.startsWith(header)) stack = stack.slice(header.length);
  return {
    message: scrub(name === 'Error' ? e.message || name : header).slice(0, MAX_MESSAGE),
    stack: stack
      .split('\n')
      .map((line) => line.trim())
      .filter(Boolean)
      .slice(0, MAX_FRAMES)
      .map((frame) => scrub(frame).slice(0, MAX_FRAME)),
  };
}

/** What is stored may be old or edited by hand: only well-formed entries come out. */
function clean(raw: unknown): ErrorEntry | undefined {
  if (typeof raw !== 'object' || raw === null) return undefined;
  const e = raw as Record<string, unknown>;
  if (typeof e.time !== 'string' || typeof e.message !== 'string' || !Array.isArray(e.stack)) return undefined;
  const text = (v: unknown, max: number) => (typeof v === 'string' ? v.slice(0, max) : '');
  return {
    time: e.time.slice(0, 40),
    message: e.message.slice(0, MAX_MESSAGE),
    stack: e.stack.filter((f): f is string => typeof f === 'string').slice(0, MAX_FRAMES).map((f) => f.slice(0, MAX_FRAME)),
    version: text(e.version, 60),
    platform: e.platform === 'android' || e.platform === 'ios' ? e.platform : 'web',
    source: text(e.source, 30) || 'app',
  };
}

/** null when the storage cannot be read (blocked, or full of something else). */
function stored(): ErrorEntry[] | null {
  try {
    const list: unknown = JSON.parse(localStorage.getItem(KEY) ?? '[]');
    return Array.isArray(list) ? list.flatMap((raw) => clean(raw) ?? []).slice(-MAX_ERRORS) : [];
  } catch {
    return null;
  }
}

const currentPlatform = (): ErrorEntry['platform'] => {
  try {
    return platform();
  } catch {
    return 'web';
  }
};

/** Adds an error to the log (the last 10 are kept). Never throws: it runs while something else is already broken. */
export function logError(error: unknown, source: string): void {
  try {
    const entry: ErrorEntry = {
      time: new Date().toISOString(),
      ...describe(error),
      version: __APP_VERSION__,
      platform: currentPlatform(),
      source: source.slice(0, 30),
    };
    session = [...session, entry].slice(-MAX_ERRORS);
    const log = [...(stored() ?? []), entry].slice(-MAX_ERRORS);
    localStorage.setItem(KEY, JSON.stringify(log));
  } catch {
    // Storage blocked or full: the log is a help, never a reason to fail.
  }
}

/** The errors kept, oldest first. */
export function readErrorLog(): ErrorEntry[] {
  const saved = stored() ?? [];
  // What could not be written is still known for this session.
  const missing = session.filter((e) => !saved.some((s) => s.time === e.time && s.message === e.message));
  return [...saved, ...missing].sort((a, b) => (a.time < b.time ? -1 : a.time > b.time ? 1 : 0)).slice(-MAX_ERRORS);
}

/** Plain text to paste into a message: version, device and the errors (no maps). */
export function errorReport(): string {
  const log = readErrorLog();
  const lines = [
    'MappAmi: dettagli per chi ti aiuta',
    'Qui dentro non ci sono le tue mappe né i loro titoli.',
    '',
    `Versione: ${__APP_VERSION__}`,
    `Sistema: ${currentPlatform()}`,
    `Browser: ${navigator.userAgent}`,
    '',
  ];
  if (log.length === 0) lines.push('Nessun errore registrato.');
  log.forEach((e, i) => {
    lines.push(`${i + 1}. ${e.time} (${e.source}, versione ${e.version}, ${e.platform})`, `   ${e.message}`);
    e.stack.forEach((frame) => lines.push(`   ${frame}`));
  });
  return lines.join('\n');
}
