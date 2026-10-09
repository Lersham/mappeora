import { DEFAULT_LANG, preferredVoice, type ListenOptions, type SpeakOptions, type SpeechService, type Voice } from './types';

// The Web Speech recognition API is still prefixed in Chrome/Safari and
// missing from TypeScript's DOM lib, so we describe the bits we use.
interface RecognitionResultEvent {
  resultIndex: number;
  results: ArrayLike<{ isFinal: boolean; 0: { transcript: string } }>;
}
interface Recognition {
  lang: string;
  interimResults: boolean;
  continuous: boolean;
  onresult: ((e: RecognitionResultEvent) => void) | null;
  onerror: ((e: { error: string }) => void) | null;
  onend: (() => void) | null;
  start(): void;
  stop(): void;
}
type RecognitionCtor = new () => Recognition;

function recognitionCtor(): RecognitionCtor | undefined {
  const w = window as unknown as { SpeechRecognition?: RecognitionCtor; webkitSpeechRecognition?: RecognitionCtor };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition;
}

/** A browser with no voices at all is only waited for once. */
let waitedForVoices = false;

/** Voices load asynchronously in Chrome: wait for `voiceschanged` once. */
function loadVoices(): Promise<SpeechSynthesisVoice[]> {
  const synth = window.speechSynthesis;
  const voices = synth.getVoices();
  if (voices.length > 0 || waitedForVoices) return Promise.resolve(voices);
  return new Promise((resolve) => {
    const done = () => {
      waitedForVoices = true;
      resolve(synth.getVoices());
    };
    synth.addEventListener('voiceschanged', done, { once: true });
    setTimeout(done, 1500);
  });
}

export class WebSpeechService implements SpeechService {
  readonly ttsSupported = typeof window !== 'undefined' && 'speechSynthesis' in window;
  readonly sttSupported = typeof window !== 'undefined' && recognitionCtor() !== undefined;
  private recognition: Recognition | null = null;
  /** Bumped by every speak and stop: a speak still waiting for the voices is dropped. */
  private generation = 0;

  async getVoices(lang = DEFAULT_LANG): Promise<Voice[]> {
    if (!this.ttsSupported) return [];
    const prefix = lang.slice(0, 2);
    return (await loadVoices())
      .filter((v) => v.lang.replace('_', '-').startsWith(prefix))
      .map((v) => ({ id: v.voiceURI, name: v.name, lang: v.lang, localService: v.localService }));
  }

  async speak(text: string, options: SpeakOptions = {}): Promise<void> {
    if (!this.ttsSupported) return;
    const synth = window.speechSynthesis;
    synth.cancel();
    const mine = ++this.generation;
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = options.lang ?? DEFAULT_LANG;
    utterance.rate = options.rate ?? 1;
    const voices = await loadVoices();
    if (mine !== this.generation) return;
    const chosen = options.voiceId ? voices.find((v) => v.voiceURI === options.voiceId) : undefined;
    // With no voice chosen, the most natural one there is («Google italiano»).
    const preferred = chosen ? undefined : preferredVoice(voices, utterance.lang, navigator.onLine);
    const voice = chosen ?? preferred;
    if (voice) utterance.voice = voice;
    return new Promise((resolve) => {
      // Some voices never say which word they are on (Chrome's online
      // «Google» voices among them): the highlight then follows an estimate
      // of the time each word takes, until the voice reports a real one.
      let reported = false;
      let guess: ReturnType<typeof setTimeout> | undefined;
      const words = [...text.matchAll(/\S+/g)];
      const estimate = (i: number) => {
        if (reported || i >= words.length || mine !== this.generation || !options.onWord) return;
        const [word] = words[i];
        const at = words[i].index ?? 0;
        options.onWord(at, at + word.length);
        guess = setTimeout(() => estimate(i + 1), wordMs(word) / (options.rate ?? 1));
      };
      const stopGuessing = () => clearTimeout(guess);
      utterance.onstart = () => estimate(0);
      utterance.onboundary = (e) => {
        if (e.name !== 'word' || !options.onWord) return;
        reported = true;
        stopGuessing();
        // Some engines omit charLength: fall back to the next whitespace.
        const end = e.charLength ? e.charIndex + e.charLength : nextWordEnd(text, e.charIndex);
        options.onWord(e.charIndex, end);
      };
      utterance.onend = () => {
        stopGuessing();
        resolve();
      };
      utterance.onerror = (e) => {
        stopGuessing();
        // Google's voices speak from the internet: when it is not there,
        // the browser's own voice says it instead.
        if (preferred && !preferred.localService && e.error !== 'interrupted' && e.error !== 'canceled' && mine === this.generation) {
          utterance.voice = null;
          utterance.onerror = () => resolve();
          synth.speak(utterance);
        } else resolve();
      };
      synth.speak(utterance);
    });
  }

  async stopSpeaking(): Promise<void> {
    this.generation++;
    if (this.ttsSupported) window.speechSynthesis.cancel();
  }

  listen(options: ListenOptions = {}): Promise<string> {
    const Ctor = recognitionCtor();
    if (!Ctor) return Promise.reject(new Error('stt-unsupported'));
    this.recognition?.stop();
    const recognition = new Ctor();
    this.recognition = recognition;
    recognition.lang = options.lang ?? DEFAULT_LANG;
    recognition.interimResults = true;
    recognition.continuous = false;

    let finalText = '';
    return new Promise((resolve, reject) => {
      recognition.onresult = (e) => {
        let interim = '';
        for (let i = e.resultIndex; i < e.results.length; i++) {
          const r = e.results[i];
          if (r.isFinal) finalText += r[0].transcript;
          else interim += r[0].transcript;
        }
        options.onPartial?.((finalText + interim).trim());
      };
      recognition.onerror = (e) => {
        if (e.error === 'no-speech' || e.error === 'aborted') return;
        reject(new Error(e.error));
      };
      recognition.onend = () => {
        // An older session ends late, after a new one has started.
        if (this.recognition === recognition) this.recognition = null;
        resolve(finalText.trim());
      };
      recognition.start();
    });
  }

  async stopListening(): Promise<void> {
    this.recognition?.stop();
  }
}

export function nextWordEnd(text: string, start: number): number {
  const match = /\s/.exec(text.slice(start));
  return match ? start + match.index : text.length;
}

/**
 * About how long a word takes to say at normal speed: Italian runs at
 * roughly twelve letters a second, with a breath after punctuation.
 */
export function wordMs(word: string): number {
  return 120 + word.length * 70 + (/[.,;:!?]$/.test(word) ? 250 : 0);
}
