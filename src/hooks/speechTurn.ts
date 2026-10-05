import { create } from 'zustand';
import { speech } from '../services/speech';
import { SpeakError } from '../services/speech/types';
import { useReading } from '../store/readingStore';

/**
 * The app has a single voice: whoever starts speaking or listening takes
 * the turn, and every older reading loop stops at its next sentence.
 */
let turn = 0;

export function takeSpeechTurn(): number {
  useReading.getState().set({ active: false, nodeId: null, word: null });
  return ++turn;
}

export function ownsSpeech(myTurn: number): boolean {
  return myTurn === turn;
}

/** Stops map reading, the photo reader, «Prova la voce»: everything. */
export async function stopAllSpeech(): Promise<void> {
  takeSpeechTurn();
  await speech().stopSpeaking();
}

interface SpeechProblem {
  message: string;
  /** Android can open the screen that downloads the missing voice. */
  canInstall: boolean;
}

export const useSpeechProblem = create<{ problem: SpeechProblem | null }>()(() => ({ problem: null }));

/** Reading aloud failed: tell the child why instead of going silent. */
export function reportSpeakError(e: unknown) {
  const missingVoice = e instanceof SpeakError && e.missingVoice;
  useSpeechProblem.setState({
    problem: missingVoice
      ? {
          message: 'Manca la voce italiana sul telefono: installala nelle impostazioni della sintesi vocale.',
          canInstall: speech().installVoice !== undefined,
        }
      : { message: 'Non riesco a leggere ad alta voce. Riprova, o scegli un’altra voce nelle impostazioni.', canInstall: false },
  });
}
