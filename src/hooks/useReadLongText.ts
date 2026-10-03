import { useCallback, useEffect, useRef, useState } from 'react';
import { speech } from '../services/speech';
import { useSettings } from '../store/settingsStore';
import { sentences } from '../lib/ocrText';

/**
 * Reads a long text aloud sentence by sentence, exposing the character
 * range of the word being spoken so it can be highlighted.
 */
export function useReadLongText() {
  const [reading, setReading] = useState(false);
  const [word, setWord] = useState<{ start: number; end: number } | null>(null);
  const run = useRef(0);

  const stop = useCallback(async () => {
    run.current++;
    setReading(false);
    setWord(null);
    await speech().stopSpeaking();
  }, []);

  const read = useCallback(async (text: string) => {
    const myRun = ++run.current;
    const { speechRate, voiceId, highlightWords } = useSettings.getState();
    setReading(true);
    for (const chunk of sentences(text)) {
      if (myRun !== run.current) return;
      setWord(null);
      await speech().speak(chunk.text, {
        rate: speechRate,
        voiceId,
        onWord: highlightWords
          ? (s, e) => myRun === run.current && setWord({ start: chunk.start + s, end: chunk.start + e })
          : undefined,
      });
    }
    if (myRun === run.current) {
      setReading(false);
      setWord(null);
    }
  }, []);

  // Stop talking when the screen closes.
  useEffect(() => () => void stop(), [stop]);

  return { reading, word, read, stop };
}
