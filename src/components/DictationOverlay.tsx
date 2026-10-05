import { DICTATION_ERRORS, type DictationError } from '../hooks/useDictation';
import { VOICE_COMMAND_HINTS } from '../lib/voiceCommands';
import { useModal } from './Dialog';

interface Props {
  listening: boolean;
  partial: string;
  error: DictationError | null;
  onStop(): void;
  onClose(): void;
}

export function DictationOverlay(props: Props) {
  if (!props.listening && !props.error) return null;
  // A new card when listening turns into an error: focus goes to its «Ok».
  return <DictationCard key={props.listening ? 'listening' : 'error'} {...props} />;
}

function DictationCard({ listening, partial, error, onStop, onClose }: Props) {
  // Esc and Back stop listening (keeping what was said), or close the message.
  const { ref, onKeyDown, tabIndex } = useModal(listening ? onStop : onClose);
  return (
    <div className="overlay" role="dialog" aria-modal="true" aria-label="Dettatura" ref={ref} onKeyDown={onKeyDown} tabIndex={tabIndex}>
      <div className="overlay-card dictation">
        {listening ? (
          <>
            <div className="mic-pulse" aria-hidden>
              🎤
            </div>
            <p className="dictation-hint">Ti ascolto… parla pure!</p>
            <p className="dictation-text" aria-live="polite">
              {partial || '…'}
            </p>
            <p className="dictation-commands">
              Puoi anche dire: {VOICE_COMMAND_HINTS.map((h) => `«${h}»`).join(', ')}
            </p>
            <button type="button" className="big-button primary" onClick={onStop} autoFocus>
              <span className="big-button-icon" aria-hidden>
                ✅
              </span>
              <span className="big-button-label">Fatto</span>
            </button>
          </>
        ) : (
          <>
            <p className="dictation-hint" role="alert">
              {error && DICTATION_ERRORS[error]}
            </p>
            <button type="button" className="big-button" onClick={onClose} autoFocus>
              <span className="big-button-label">Ok</span>
            </button>
          </>
        )}
      </div>
    </div>
  );
}
