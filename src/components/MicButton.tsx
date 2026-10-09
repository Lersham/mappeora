import { useDictation, DICTATION_ERRORS } from '../hooks/useDictation';
import { Icon } from './Icon';

interface Props {
  /** Receives the live transcript while the child is speaking, then the final one. */
  onText(text: string): void;
  /** Called when a new dictation starts (not when it is stopped). */
  onStart?(): void;
  label?: string;
}

/** Small inline microphone for text fields: talk instead of typing. */
export function MicButton({ onText, onStart, label = 'Detta' }: Props) {
  const d = useDictation();
  if (!d.supported) return null;
  return (
    <>
      <button
        type="button"
        className={`mic-button${d.listening ? ' is-listening' : ''}`}
        aria-label={d.listening ? 'Smetti di ascoltare' : label}
        onClick={async () => {
          if (d.listening) return void d.stop();
          onStart?.();
          const text = await d.start(onText);
          if (text) onText(text);
        }}
      >
        <Icon name={d.listening ? 'stop' : 'mic'} />
      </button>
      {d.error && <span className="field-error" role="alert">{DICTATION_ERRORS[d.error]}</span>}
    </>
  );
}
