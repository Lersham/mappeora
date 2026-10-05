export interface Voice {
  /** Stable identifier: the voiceURI. */
  id: string;
  name: string;
  lang: string;
}

export interface SpeakOptions {
  lang?: string;
  /** 0.5 = slow, 1 = normal, 1.5 = fast. */
  rate?: number;
  voiceId?: string;
  /** Called when a word starts being spoken (char offsets in `text`). */
  onWord?: (start: number, end: number) => void;
}

export interface ListenOptions {
  lang?: string;
  /** Called with the partial transcript while the child is still talking. */
  onPartial?: (text: string) => void;
}

export interface SpeechService {
  readonly ttsSupported: boolean;
  readonly sttSupported: boolean;
  getVoices(lang?: string): Promise<Voice[]>;
  /** Resolves when speech ends (or is stopped). */
  speak(text: string, options?: SpeakOptions): Promise<void>;
  stopSpeaking(): Promise<void>;
  /** Resolves with the final transcript ('' if nothing was heard). */
  listen(options?: ListenOptions): Promise<string>;
  stopListening(): Promise<void>;
  /** Android only: opens the screen that downloads the missing voices. */
  installVoice?(): Promise<void>;
}

/** Speaking failed; `missingVoice` when the device has no voice for the language. */
export class SpeakError extends Error {
  name = 'SpeakError';
  constructor(
    message: string,
    readonly missingVoice: boolean,
  ) {
    super(message);
  }
}

export const DEFAULT_LANG = 'it-IT';
