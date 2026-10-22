export type VoiceCommand =
  | { type: 'add'; label: string }
  | { type: 'read' }
  | { type: 'tidy' }
  | { type: 'undo' }
  | { type: 'redo' };

/** Shown in the dictation overlay. */
export const VOICE_COMMAND_HINTS = ['leggi la mappa', 'riordina', 'annulla', 'rifai', 'nuovo concetto …'];

const EXACT: Record<string, Exclude<VoiceCommand['type'], 'add'>> = {
  leggi: 'read',
  'leggi la mappa': 'read',
  'leggi tutto': 'read',
  riordina: 'tidy',
  'riordina la mappa': 'tidy',
  'metti in ordine': 'tidy',
  annulla: 'undo',
  rifai: 'redo',
};

const ADD_PREFIX = /^(?:nuovo concetto|aggiungi|scrivi)\s+(.+)$/i;

/**
 * Turns a dictated sentence into an action. Commands must be the *whole*
 * sentence, so "annulla il viaggio" is still a concept, not an undo.
 * Anything else becomes a new concept with that text.
 */
export function parseVoiceCommand(transcript: string): VoiceCommand | null {
  const text = transcript.trim().replace(/[.!?,;:]+$/, '').trim();
  if (!text) return null;
  const key = text.toLowerCase();
  const exact = Object.hasOwn(EXACT, key) ? EXACT[key] : undefined;
  if (exact) return { type: exact } as VoiceCommand;
  const prefixed = ADD_PREFIX.exec(text);
  return { type: 'add', label: capitalize(prefixed ? prefixed[1] : text) };
}

function capitalize(text: string): string {
  return text.charAt(0).toLocaleUpperCase('it-IT') + text.slice(1);
}

/** Indovina: what the child can say once the concept is shown. Shown in the dictation card. */
export const QUIZ_VOICE_HINTS = ['lo sapevo', 'non lo sapevo'];

export type QuizAnswer = 'knew' | 'missed';

// Whole sentences only, matched as written: «sapevo» sits inside «non sapevo»,
// so a looser match (a word, a prefix) would turn a «no» into a «sì».
const QUIZ_ANSWERS: Record<string, QuizAnswer> = {
  'lo sapevo': 'knew',
  sapevo: 'knew',
  'non lo sapevo': 'missed',
  'non sapevo': 'missed',
};

/**
 * «Lo sapevo» / «non lo sapevo» said aloud after a concept is shown. Kept apart
 * from parseVoiceCommand: in the editor those words are just a concept.
 */
export function parseQuizAnswer(transcript: string): QuizAnswer | null {
  const key = transcript
    .toLowerCase()
    .replace(/[.!?,;:]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  return Object.hasOwn(QUIZ_ANSWERS, key) ? QUIZ_ANSWERS[key] : null;
}
