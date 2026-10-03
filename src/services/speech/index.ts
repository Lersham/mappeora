import { isNative } from '../platform';
import type { SpeechService } from './types';
import { WebSpeechService } from './web';
import { NativeSpeechService } from './native';

export type { SpeechService, Voice, SpeakOptions, ListenOptions } from './types';

let instance: SpeechService | undefined;

export function speech(): SpeechService {
  instance ??= isNative() ? new NativeSpeechService() : new WebSpeechService();
  return instance;
}
