import { useCallback, useEffect, useRef, useState } from 'react';
import { speech } from '../services/speech';
import { stopAllSpeech } from './speechTurn';

export type DictationError = 'stt-unsupported' | 'not-allowed' | 'network' | 'no-microphone' | 'service' | 'other';

/** Error codes of the Web Speech API and of the Android plugin. */
const ERROR_CODES: Record<string, DictationError> = {
  'stt-unsupported': 'stt-unsupported',
  'not-allowed': 'not-allowed',
  INSUFFICIENT_PERMISSIONS: 'not-allowed',
  network: 'network',
  NETWORK: 'network',
  NETWORK_TIMEOUT: 'network',
  'audio-capture': 'no-microphone',
  AUDIO: 'no-microphone',
  'service-not-allowed': 'service',
  'language-not-supported': 'service',
  SERVER: 'service',
  SERVER_DISCONNECTED: 'service',
};

export function useDictation() {
  const [listening, setListening] = useState(false);
  const [partial, setPartial] = useState('');
  const [error, setError] = useState<DictationError | null>(null);
  const live = useRef(false);

  // A dialog closed while listening: switch the microphone off.
  useEffect(
    () => () => {
      if (live.current) void speech().stopListening();
    },
    [],
  );

  const start = useCallback(async (onPartial?: (text: string) => void): Promise<string> => {
    setError(null);
    setPartial('');
    setListening(true);
    live.current = true;
    try {
      // The microphone would hear the app reading aloud.
      await stopAllSpeech();
      return await speech().listen({
        onPartial: (text) => {
          setPartial(text);
          onPartial?.(text);
        },
      });
    } catch (e) {
      const msg = e instanceof Error ? e.message : '';
      setError(ERROR_CODES[msg] ?? 'other');
      return '';
    } finally {
      live.current = false;
      setListening(false);
    }
  }, []);

  const stop = useCallback(() => speech().stopListening(), []);
  const clearError = useCallback(() => setError(null), []);

  return { listening, partial, error, start, stop, clearError, supported: speech().sttSupported };
}

export const DICTATION_ERRORS: Record<DictationError, string> = {
  'stt-unsupported': 'Questo browser non sa ascoltare la voce. Prova con Chrome, Edge o con l’app.',
  'not-allowed': 'Per dettare, permetti a Mappeora di usare il microfono nelle impostazioni del telefono o del browser.',
  network: 'Per dettare serve internet. Controlla la connessione e riprova.',
  'no-microphone': 'Non trovo il microfono, oppure lo sta usando un’altra app.',
  service: 'La dettatura adesso non è disponibile. Riprova più tardi, o scrivi con la tastiera.',
  other: 'Non ho capito bene. Riprova!',
};
