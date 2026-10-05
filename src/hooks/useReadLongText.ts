import { useCallback, useEffect, useRef, useState } from 'react';
import { speech } from '../services/speech';
import { useSettings } from '../store/settingsStore';
import { sentences } from '../lib/ocrText';
import { ownsSpeech, reportSpeakError, stopAllSpeech, takeSpeechTurn } from './speechTurn';

/**
 * Reads a long text aloud sentence by sentence, exposing the character
 * range of the word being spoken so it can be highlighted.
 */
export function useReadLongText() {
  const [reading, setReading] = useState(false);
  const [word, setWord] = useState<{ start: number; end: number } | null>(null);
  /** This reader's latest turn: another one means a newer read or a stop. */
  const run = useRef(0);

  const stop = useCallback(async () => {
    run.current = 0;
    setReading(false);
    setWord(null);
    await stopAllSpeech();
  }, []);

  const read = useCallback(async (text: string) => {
    const myTurn = takeSpeechTurn();
    run.current = myTurn;
    const { speechRate, voiceId, highlightWords } = useSettings.getState();
    setReading(true);
    try {
      for (const chunk of sentences(text)) {
        if (!ownsSpeech(myTurn)) break;
        setWord(null);
        await speech().speak(chunk.text, {
          rate: speechRate,
          voiceId,
          onWord: highlightWords
            ? (s, e) => ownsSpeech(myTurn) && setWord({ start: chunk.start + s, end: chunk.start + e })
            : undefined,
        });
      }
    } catch (e) {
      if (ownsSpeech(myTurn)) reportSpeakError(e);
    } finally {
      // Done, or the map reader or the microphone took the voice.
      if (run.current === myTurn) {
        setReading(false);
        setWord(null);
      }
    }
  }, []);

  // Stop talking when the screen closes.
  useEffect(
    () => () => {
      if (ownsSpeech(run.current)) void stopAllSpeech();
    },
    [],
  );

  return { reading, word, read, stop };
}
