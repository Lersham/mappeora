import { test as base, expect, type Page } from '@playwright/test';

/**
 * Shared setup for every test:
 * - the network outside the app is mocked (ARASAAC, Fluent Emoji on
 *   jsDelivr, Google), so tests are fast, offline and repeatable;
 * - speech synthesis and recognition are simulated: what the app says is
 *   collected in `window.__spoken`, what the child "says" is set with
 *   `say(page, text)` before pressing the microphone;
 * - any JavaScript error or console error fails the test.
 */

export const PNG_1PX = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
  'base64',
);
const SVG = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 10"><circle cx="5" cy="5" r="4" fill="#4a90d9"/></svg>';

type Pictogram = { _id: number; sex?: boolean; violence?: boolean; keywords: { keyword: string }[] };
const pic = (id: number, keyword: string, extra: Partial<Pictogram> = {}): Pictogram => ({ _id: id, keywords: [{ keyword }], ...extra });

/** ARASAAC answers, by path after /pictograms/it/. Anything else: 404. */
const ARASAAC: Record<string, Pictogram[]> = {
  'bestsearch/acqua': [pic(2248, 'acqua')],
  'search/acqua': [pic(2248, 'acqua'), pic(9001, 'battere i piedi in acqua'), pic(2249, 'acqua minerale')],
  'bestsearch/piante': [pic(3000, 'pianta')],
  'search/piante': [pic(3001, 'piante'), pic(3002, 'piante', { sex: true })],
};

const SPEECH_STUB = () => {
  const w = window as unknown as Record<string, unknown>;
  const spoken: string[] = [];
  w.__spoken = spoken;
  w.__nextTranscript = '';
  type Utterance = SpeechSynthesisUtterance & { __stopped?: boolean };
  let current: Utterance | null = null;
  const synth = {
    speaking: false,
    pending: false,
    paused: false,
    onvoiceschanged: null,
    getVoices: () => [{ voiceURI: 'it-test', name: 'Italiano (test)', lang: 'it-IT', default: true, localService: true }],
    speak(u: Utterance) {
      spoken.push(u.text);
      current = u;
      const words = [...u.text.matchAll(/\S+/g)];
      let i = 0;
      const step = () => {
        if (u.__stopped) return;
        if (i < words.length) {
          const m = words[i++];
          u.onboundary?.({ name: 'word', charIndex: m.index, charLength: m[0].length } as SpeechSynthesisEvent);
          setTimeout(step, (w.__wordMs as number | undefined) ?? 20);
        } else {
          current = null;
          u.onend?.({} as SpeechSynthesisEvent);
        }
      };
      setTimeout(step, 0);
    },
    cancel() {
      const u = current;
      current = null;
      if (u) {
        u.__stopped = true;
        u.onend?.({} as SpeechSynthesisEvent);
      }
    },
    pause() {},
    resume() {},
    addEventListener() {},
    removeEventListener() {},
  };
  Object.defineProperty(window, 'speechSynthesis', { value: synth, configurable: true });

  class FakeRecognition {
    onresult: ((e: unknown) => void) | null = null;
    onerror: ((e: unknown) => void) | null = null;
    onend: (() => void) | null = null;
    lang = 'it-IT';
    interimResults = true;
    continuous = false;
    start() {
      setTimeout(() => {
        const text = w.__nextTranscript as string;
        if (text) this.onresult?.({ resultIndex: 0, results: [Object.assign([{ transcript: text }], { isFinal: true })] });
        this.onend?.();
      }, 150);
    }
    stop() {
      this.onend?.();
    }
  }
  w.SpeechRecognition = FakeRecognition;
  w.webkitSpeechRecognition = FakeRecognition;
};

export const test = base.extend<{ consoleErrors: string[] }>({
  context: async ({ context }, use) => {
    await context.addInitScript(SPEECH_STUB);
    await context.route(/^https?:\/\/(?!localhost[:/])/, async (route) => {
      const url = new URL(route.request().url());
      if (url.hostname === 'api.arasaac.org') {
        const key = decodeURIComponent(url.pathname.split('/it/')[1] ?? '');
        const body = ARASAAC[key];
        return body
          ? route.fulfill({ json: body, headers: { 'access-control-allow-origin': '*' } })
          : route.fulfill({ status: 404, json: [], headers: { 'access-control-allow-origin': '*' } });
      }
      if (url.hostname === 'static.arasaac.org' || (url.hostname === 'cdn.jsdelivr.net' && url.pathname.endsWith('.png'))) {
        return route.fulfill({ body: PNG_1PX, contentType: 'image/png', headers: { 'access-control-allow-origin': '*' } });
      }
      if (url.hostname === 'cdn.jsdelivr.net' && url.pathname.endsWith('.svg')) {
        return route.fulfill({ body: SVG, contentType: 'image/svg+xml', headers: { 'access-control-allow-origin': '*' } });
      }
      if (url.hostname === 'www.google.com') {
        return route.fulfill({ body: '<title>Google Immagini (finto)</title>', contentType: 'text/html' });
      }
      return route.abort();
    });
    await use(context);
  },

  consoleErrors: [
    async ({ page }, use) => {
      const errors: string[] = [];
      page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`));
      page.on('console', (m) => {
        // Requests we abort on purpose (e.g. the OCR engine) are not app bugs.
        if (m.type() === 'error' && !/Failed to load resource|net::ERR_/.test(m.text())) errors.push(m.text());
      });
      await use(errors);
      expect(errors, 'errori JavaScript o in console').toEqual([]);
    },
    { auto: true },
  ],
});

export { expect };

/** Next thing the child "says" into the microphone. */
export function say(page: Page, text: string) {
  return page.evaluate((t) => ((window as unknown as { __nextTranscript: string }).__nextTranscript = t), text);
}

/** Slows the simulated voice down, to see the highlighted word. */
export function slowVoice(page: Page, msPerWord = 400) {
  return page.evaluate((ms) => ((window as unknown as { __wordMs: number }).__wordMs = ms), msPerWord);
}

/** Everything the app has read aloud so far. */
export function spoken(page: Page): Promise<string[]> {
  return page.evaluate(() => [...(window as unknown as { __spoken: string[] }).__spoken]);
}
