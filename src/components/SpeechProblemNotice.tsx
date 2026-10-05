import { speech } from '../services/speech';
import { useSpeechProblem } from '../hooks/speechTurn';

/** Why the app could not read aloud: shown over everything, dialogs too. */
export function SpeechProblemNotice() {
  const problem = useSpeechProblem((s) => s.problem);
  if (!problem) return null;
  const close = () => useSpeechProblem.setState({ problem: null });
  return (
    <div className="editor-notice speech-notice" role="alert">
      <span>{problem.message}</span>
      {problem.canInstall && (
        <button
          type="button"
          className="choice"
          onClick={() => {
            close();
            void speech().installVoice?.();
          }}
        >
          Installa la voce
        </button>
      )}
      <button type="button" className="editor-notice-close" aria-label="Chiudi il messaggio" onClick={close}>
        ✖️
      </button>
    </div>
  );
}
