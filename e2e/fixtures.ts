import { test as base, expect, type Page } from '@playwright/test';

/**
 * Shared setup for every test:
 * - the network outside the app is mocked (Fluent Emoji on
 *   jsDelivr, Google), so tests are fast, offline and repeatable;
 * - speech synthesis and recognition are simulated: what the app says is
 *   collected in `window.__spoken`, what the child "says" is set with
 *   `say(page, text)` before pressing the microphone;
 * - the welcome counts as already seen (see welcome.spec.ts);
 * - any JavaScript error or console error fails the test.
 */

export const PNG_1PX = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
  'base64',
);
const SVG = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 10"><circle cx="5" cy="5" r="4" fill="#4a90d9"/></svg>';

const SPEECH_STUB = () => {
  const w = window as unknown as Record<string, unknown>;
  const spoken: string[] = [];
  w.__spoken = spoken;
  w.__nextTranscript = '';
  type Utterance = SpeechSynthesisUtterance & { __stopped?: boolean };
  let current: Utterance | null = null;
  // `__voicesLate`: like Chrome on first load, there are no voices until a
  // `voiceschanged` event a moment later.
  const voiceListeners = new Set<() => void>();
  const voices = [{ voiceURI: 'it-test', name: 'Italiano (test)', lang: 'it-IT', default: true, localService: true }];
  const synth = {
    speaking: false,
    pending: false,
    paused: false,
    onvoiceschanged: null,
    getVoices() {
      if (!w.__voicesLate) return voices;
      if (w.__voicesLate === true) {
        w.__voicesLate = 'loading';
        setTimeout(() => {
          w.__voicesLate = false;
          voiceListeners.forEach((l) => l());
        }, 300);
      }
      return [];
    },
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
    addEventListener(type: string, listener: () => void, options?: { once?: boolean }) {
      if (type !== 'voiceschanged') return;
      const wrapped = options?.once
        ? () => {
            voiceListeners.delete(wrapped);
            listener();
          }
        : listener;
      voiceListeners.add(wrapped);
    },
    removeEventListener(type: string, listener: () => void) {
      voiceListeners.delete(listener);
    },
  };
  Object.defineProperty(window, 'speechSynthesis', { value: synth, configurable: true });

  // `__holdMic`: the microphone keeps listening until stop(), like a child
  // still talking. `__micError`: the next session fails with that code.
  w.__micsOpen = 0;
  class FakeRecognition {
    onresult: ((e: unknown) => void) | null = null;
    onerror: ((e: unknown) => void) | null = null;
    onend: (() => void) | null = null;
    lang = 'it-IT';
    interimResults = true;
    continuous = false;
    private open = false;
    private end(final: boolean) {
      if (!this.open) return;
      this.open = false;
      (w.__micsOpen as number)--;
      const text = w.__nextTranscript as string;
      if (final && text) this.onresult?.({ resultIndex: 0, results: [Object.assign([{ transcript: text }], { isFinal: true })] });
      this.onend?.();
    }
    start() {
      this.open = true;
      (w.__micsOpen as number)++;
      const error = w.__micError as string | undefined;
      if (error) {
        w.__micError = undefined;
        setTimeout(() => {
          this.onerror?.({ error });
          this.end(false);
        }, 50);
        return;
      }
      if (w.__holdMic) {
        const text = w.__nextTranscript as string;
        setTimeout(() => this.open && this.onresult?.({ resultIndex: 0, results: [Object.assign([{ transcript: text }], { isFinal: false })] }), 50);
        return;
      }
      setTimeout(() => this.end(true), 150);
    }
    stop() {
      // The engine ends a moment later, as in Chrome.
      setTimeout(() => this.end(true), 30);
    }
  }
  w.SpeechRecognition = FakeRecognition;
  w.webkitSpeechRecognition = FakeRecognition;
};

export const test = base.extend<{ consoleErrors: string[] }>({
  context: async ({ context }, use) => {
    await context.addInitScript(SPEECH_STUB);
    // The welcome is tested on its own (welcome.spec.ts): elsewhere it is already seen.
    await context.addInitScript(() => {
      if (!sessionStorage.getItem('e2e-fresh')) localStorage.setItem('mappeora-welcome', 'visto');
    });
    await context.route(/^https?:\/\/(?!localhost[:/])/, async (route) => {
      const url = new URL(route.request().url());
      if (url.hostname === 'cdn.jsdelivr.net' && url.pathname.endsWith('.png')) {
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

/** The microphone keeps listening until it is stopped. */
export function holdMic(page: Page) {
  return page.evaluate(() => ((window as unknown as { __holdMic: boolean }).__holdMic = true));
}

/** The next dictation fails with this Web Speech error code. */
export function micError(page: Page, code: string) {
  return page.evaluate((c) => ((window as unknown as { __micError: string }).__micError = c), code);
}

/** Microphone sessions still running. */
export function micsOpen(page: Page): Promise<number> {
  return page.evaluate(() => (window as unknown as { __micsOpen: number }).__micsOpen);
}

/** The voices arrive late, after a `voiceschanged` event, as in Chrome. */
export function lateVoices(page: Page) {
  return page.evaluate(() => ((window as unknown as { __voicesLate: boolean }).__voicesLate = true));
}

/** Slows the simulated voice down, to see the highlighted word. */
export function slowVoice(page: Page, msPerWord = 400) {
  return page.evaluate((ms) => ((window as unknown as { __wordMs: number }).__wordMs = ms), msPerWord);
}

/** Everything the app has read aloud so far. */
export function spoken(page: Page): Promise<string[]> {
  return page.evaluate(() => [...(window as unknown as { __spoken: string[] }).__spoken]);
}

/** Like a first launch on a new device: the welcome is not seen yet. */
export async function freshInstall(page: Page) {
  await page.goto('/');
  await page.evaluate(() => {
    sessionStorage.setItem('e2e-fresh', '1');
    localStorage.removeItem('mappeora-welcome');
  });
  await page.reload();
}
