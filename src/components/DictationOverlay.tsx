import { DICTATION_ERRORS, type DictationError } from '../hooks/useDictation';
import { VOICE_COMMAND_HINTS } from '../lib/voiceCommands';

interface Props {
  listening: boolean;
  partial: string;
  error: DictationError | null;
  onStop(): void;
  onClose(): void;
}

export function DictationOverlay({ listening, partial, error, onStop, onClose }: Props) {
  if (!listening && !error) return null;
  return (
    <div className="overlay" role="dialog" aria-modal="true" aria-live="polite">
      <div className="overlay-card dictation">
        {listening ? (
          <>
            <div className="mic-pulse" aria-hidden>
              🎤
            </div>
            <p className="dictation-hint">Ti ascolto… parla pure!</p>
            <p className="dictation-text">{partial || '…'}</p>
            <p className="dictation-commands">
              Puoi anche dire: {VOICE_COMMAND_HINTS.map((h) => `«${h}»`).join(', ')}
            </p>
            <button type="button" className="big-button primary" onClick={onStop}>
              <span className="big-button-icon" aria-hidden>
                ✅
              </span>
              <span className="big-button-label">Fatto</span>
            </button>
          </>
        ) : (
          <>
            <p className="dictation-hint">{error && DICTATION_ERRORS[error]}</p>
            <button type="button" className="big-button" onClick={onClose}>
              <span className="big-button-label">Ok</span>
            </button>
          </>
        )}
      </div>
    </div>
  );
}
