import { useCallback, useState } from 'react';
import { speech } from '../services/speech';

export type DictationError = 'stt-unsupported' | 'not-allowed' | 'other';

export function useDictation() {
  const [listening, setListening] = useState(false);
  const [partial, setPartial] = useState('');
  const [error, setError] = useState<DictationError | null>(null);

  const start = useCallback(async (): Promise<string> => {
    setError(null);
    setPartial('');
    setListening(true);
    try {
      await speech().stopSpeaking();
      return await speech().listen({ onPartial: setPartial });
    } catch (e) {
      const msg = e instanceof Error ? e.message : '';
      setError(msg === 'stt-unsupported' ? 'stt-unsupported' : msg === 'not-allowed' ? 'not-allowed' : 'other');
      return '';
    } finally {
      setListening(false);
    }
  }, []);

  const stop = useCallback(() => speech().stopListening(), []);
  const clearError = useCallback(() => setError(null), []);

  return { listening, partial, error, start, stop, clearError, supported: speech().sttSupported };
}

export const DICTATION_ERRORS: Record<DictationError, string> = {
  'stt-unsupported': 'Questo browser non sa ascoltare la voce. Prova con Chrome, Edge o con l’app.',
  'not-allowed': 'Serve il permesso per usare il microfono.',
  other: 'Non ho capito bene. Riprova!',
};
