import { useDictation, DICTATION_ERRORS } from '../hooks/useDictation';

interface Props {
  /** Receives the live transcript while the child is speaking, then the final one. */
  onText(text: string): void;
  label?: string;
}

/** Small inline microphone for text fields: talk instead of typing. */
export function MicButton({ onText, label = 'Detta' }: Props) {
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
          const text = await d.start(onText);
          if (text) onText(text);
        }}
      >
        {d.listening ? '⏹️' : '🎤'}
      </button>
      {d.error && <span className="field-error" role="alert">{DICTATION_ERRORS[d.error]}</span>}
    </>
  );
}
