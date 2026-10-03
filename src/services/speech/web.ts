import { DEFAULT_LANG, type ListenOptions, type SpeakOptions, type SpeechService, type Voice } from './types';

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

/** Voices load asynchronously in Chrome: wait for `voiceschanged` once. */
function loadVoices(): Promise<SpeechSynthesisVoice[]> {
  const synth = window.speechSynthesis;
  const voices = synth.getVoices();
  if (voices.length > 0) return Promise.resolve(voices);
  return new Promise((resolve) => {
    const done = () => resolve(synth.getVoices());
    synth.addEventListener('voiceschanged', done, { once: true });
    setTimeout(done, 1500);
  });
}

export class WebSpeechService implements SpeechService {
  readonly ttsSupported = typeof window !== 'undefined' && 'speechSynthesis' in window;
  readonly sttSupported = typeof window !== 'undefined' && recognitionCtor() !== undefined;
  private recognition: Recognition | null = null;

  async getVoices(lang = DEFAULT_LANG): Promise<Voice[]> {
    if (!this.ttsSupported) return [];
    const prefix = lang.slice(0, 2);
    return (await loadVoices())
      .filter((v) => v.lang.replace('_', '-').startsWith(prefix))
      .map((v) => ({ id: v.voiceURI, name: v.name, lang: v.lang }));
  }

  async speak(text: string, options: SpeakOptions = {}): Promise<void> {
    if (!this.ttsSupported) return;
    const synth = window.speechSynthesis;
    synth.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = options.lang ?? DEFAULT_LANG;
    utterance.rate = options.rate ?? 1;
    if (options.voiceId) {
      const voice = (await loadVoices()).find((v) => v.voiceURI === options.voiceId);
      if (voice) utterance.voice = voice;
    }
    return new Promise((resolve) => {
      utterance.onboundary = (e) => {
        if (e.name !== 'word' || !options.onWord) return;
        // Some engines omit charLength: fall back to the next whitespace.
        const end = e.charLength ? e.charIndex + e.charLength : nextWordEnd(text, e.charIndex);
        options.onWord(e.charIndex, end);
      };
      utterance.onend = () => resolve();
      utterance.onerror = () => resolve();
      synth.speak(utterance);
    });
  }

  async stopSpeaking(): Promise<void> {
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
        this.recognition = null;
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
