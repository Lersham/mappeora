import { useEffect, useState } from 'react';
import { mentionedConcepts } from '../lib/spokenMatch';
import { speech } from '../services/speech';
import { useReview } from '../store/reviewStore';
import { dictationError, type DictationError } from './useDictation';
import { stopAllSpeech } from './speechTurn';

/** The last few words heard, for the caption: enough to see the app is listening. */
const tail = (text: string) => text.split(/\s+/).slice(-8).join(' ');

/**
 * «Ripetimi»: while the child explains the map, the microphone stays on and
 * every concept named lights up. Recognition stops at each pause, so it is
 * started again until «Ho finito», an error, or the end of the review.
 */
export function useRipetimi(on: boolean) {
  const [said, setSaid] = useState('');
  const [error, setError] = useState<DictationError | null>(null);

  useEffect(() => {
    if (!on) return;
    let stopped = false;
    setError(null);
    const heard = (text: string) => {
      if (stopped || !text) return;
      setSaid(tail(text));
      const { steps, hear } = useReview.getState();
      hear(mentionedConcepts(text, steps));
    };
    void (async () => {
      // The microphone would hear the app reading aloud.
      await stopAllSpeech();
      while (!stopped) {
        try {
          heard(await speech().listen({ onPartial: heard }));
        } catch (e) {
          if (!stopped) setError(dictationError(e));
          return;
        }
        // A breath between sessions: a recogniser that ends at once must not spin.
        await new Promise((r) => setTimeout(r, 300));
      }
    })();
    return () => {
      stopped = true;
      void speech().stopListening();
    };
  }, [on]);

  return { said, error, clearSaid: () => setSaid('') };
}
