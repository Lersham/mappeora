import { BigButton } from '../../components/BigButton';
import { useReview } from '../../store/reviewStore';
import { QuizBar } from './QuizBar';

interface Props {
  onRepeat(): void;
  onOverview(): void;
  onExit(): void;
  /** Ripetimi: «Ho finito». */
  onFinish(): void;
}

export function ReviewBar({ onRepeat, onOverview, onExit, onFinish }: Props) {
  const { index, steps, mode, next, prev, heard, done, retry } = useReview();
  if (mode === 'ripetimi') {
    return (
      <nav className="toolbar review-bar" aria-label="Ripetimi">
        <BigButton icon="map" label="Tutta" onClick={onOverview} />
        <span className="review-progress" aria-live="polite">
          <span className="sr-only">Concetti spiegati: </span>
          {Object.keys(heard).length} / {steps.length}
        </span>
        {done ? (
          <>
            <BigButton icon="mic" label="Continua" onClick={retry} />
            <BigButton icon="party" label="Fine" variant="primary" onClick={onExit} />
          </>
        ) : (
          <BigButton icon="check" label="Ho finito" variant="primary" onClick={onFinish} />
        )}
      </nav>
    );
  }
  if (mode === 'quiz') return <QuizBar onRepeat={onRepeat} onOverview={onOverview} onExit={onExit} />;
  const last = index === steps.length - 1;
  return (
    <nav className="toolbar review-bar" aria-label={mode === 'interrogazione' ? 'Interrogazione' : 'Ripasso'}>
      <BigButton icon="back" label="Indietro" onClick={prev} disabled={index === 0} />
      <span className="review-progress" aria-live="polite">
        {index + 1} / {steps.length}
      </span>
      <BigButton icon="speak" label={mode === 'interrogazione' ? 'Leggi' : 'Ripeti'} onClick={onRepeat} />
      {mode === 'interrogazione' && <BigButton icon="map" label="Tutta" onClick={onOverview} />}
      {last ? (
        <BigButton icon="party" label="Finito!" variant="primary" onClick={onExit} />
      ) : (
        <BigButton icon="forward" label="Avanti" variant="primary" onClick={next} />
      )}
    </nav>
  );
}
