export type VoiceCommand =
  | { type: 'add'; label: string }
  | { type: 'read' }
  | { type: 'tidy' }
  | { type: 'undo' }
  | { type: 'redo' };

/** Shown in the dictation overlay. */
export const VOICE_COMMAND_HINTS = ['leggi la mappa', 'riordina', 'annulla', 'nuovo concetto …'];

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
  const exact = EXACT[text.toLowerCase()];
  if (exact) return { type: exact } as VoiceCommand;
  const prefixed = ADD_PREFIX.exec(text);
  return { type: 'add', label: capitalize(prefixed ? prefixed[1] : text) };
}

function capitalize(text: string): string {
  return text.charAt(0).toLocaleUpperCase('it-IT') + text.slice(1);
}
