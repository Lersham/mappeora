import { TextToSpeech } from '@capacitor-community/text-to-speech';
import { SpeechRecognition } from '@capgo/capacitor-speech-recognition';
import type { PluginListenerHandle } from '@capacitor/core';
import { DEFAULT_LANG, type ListenOptions, type SpeakOptions, type SpeechService, type Voice } from './types';

/**
 * Android/iOS implementation. WebViews do not support the Web Speech
 * recognition API, so both directions go through native plugins
 * (Google speech services on Android, Apple Speech framework on iOS).
 */
export class NativeSpeechService implements SpeechService {
  readonly ttsSupported = true;
  readonly sttSupported = true;
  private lastPartial = '';
  private finishListening: (() => void) | null = null;

  async getVoices(lang = DEFAULT_LANG): Promise<Voice[]> {
    const { voices } = await TextToSpeech.getSupportedVoices();
    const prefix = lang.slice(0, 2);
    // The plugin selects voices by index into the *unfiltered* list.
    return voices
      .map((v, index) => ({ id: String(index), name: v.name, lang: v.lang }))
      .filter((v) => v.lang.replace('_', '-').startsWith(prefix));
  }

  async speak(text: string, options: SpeakOptions = {}): Promise<void> {
    let handle: PluginListenerHandle | undefined;
    if (options.onWord) {
      const onWord = options.onWord;
      handle = await TextToSpeech.addListener('onRangeStart', ({ start, end }) => onWord(start, end));
    }
    try {
      await TextToSpeech.speak({
        text,
        lang: options.lang ?? DEFAULT_LANG,
        rate: options.rate ?? 1,
        voice: options.voiceId !== undefined ? Number(options.voiceId) : undefined,
        // Lets speech play even with the iOS silent switch on.
        category: 'playback',
      });
    } finally {
      await handle?.remove();
    }
  }

  async stopSpeaking(): Promise<void> {
    await TextToSpeech.stop();
  }

  async listen(options: ListenOptions = {}): Promise<string> {
    const language = options.lang ?? DEFAULT_LANG;
    const { available } = await SpeechRecognition.available();
    if (!available) throw new Error('stt-unsupported');
    const perm = await SpeechRecognition.checkPermissions();
    if (perm.speechRecognition !== 'granted') {
      const req = await SpeechRecognition.requestPermissions();
      if (req.speechRecognition !== 'granted') throw new Error('not-allowed');
    }
    // Users are often minors: keep their voice on the device whenever the
    // OS can recognise Italian offline, and only fall back to the cloud
    // recogniser (Google / Apple) otherwise.
    const onDevice = (await SpeechRecognition.isOnDeviceRecognitionAvailable({ language })).available;

    this.lastPartial = '';
    let failure: string | null = null;
    // With partialResults on, start() resolves immediately; the session ends
    // with a 'stopped' listening state. stopListening() also resolves it,
    // in case the event never arrives.
    let done!: () => void;
    const finished = new Promise<void>((resolve) => (done = resolve));
    this.finishListening = done;
    const handles = await Promise.all([
      SpeechRecognition.addListener('partialResults', (e) => {
        this.lastPartial = e.accumulatedText ?? e.matches?.[0] ?? this.lastPartial;
        options.onPartial?.(this.lastPartial);
      }),
      SpeechRecognition.addListener('error', (e) => {
        failure = e.code;
      }),
      SpeechRecognition.addListener('listeningState', (e) => {
        if (e.state === 'stopped' || e.status === 'stopped') done();
      }),
    ]);
    try {
      await SpeechRecognition.start({
        language,
        partialResults: true,
        popup: false,
        maxResults: 1,
        addPunctuation: true,
        useOnDeviceRecognition: onDevice,
      });
      await finished;
      if (!this.lastPartial && failure) throw new Error(failure);
      return this.lastPartial.trim();
    } finally {
      this.finishListening = null;
      await Promise.all(handles.map((h) => h.remove()));
    }
  }

  async stopListening(): Promise<void> {
    await SpeechRecognition.stop();
    this.finishListening?.();
  }
}
