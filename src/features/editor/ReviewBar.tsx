import { BigButton } from '../../components/BigButton';
import { useReview } from '../../store/reviewStore';

interface Props {
  onRepeat(): void;
  onOverview(): void;
  onExit(): void;
  /** Ripetimi: «Ho finito». */
  onFinish(): void;
}

export function ReviewBar({ onRepeat, onOverview, onExit, onFinish }: Props) {
  const { index, steps, mode, revealed, next, prev, reveal, heard, done, retry } = useReview();
  if (mode === 'ripetimi') {
    return (
      <nav className="toolbar review-bar" aria-label="Ripetimi">
        <BigButton icon="map" label="Tutta" onClick={onOverview} />
        <span className="review-progress" aria-live="polite" aria-label="Concetti spiegati">
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
  const last = index === steps.length - 1;
  const quiz = mode === 'quiz';
  return (
    <nav className="toolbar review-bar" aria-label={mode === 'interrogazione' ? 'Interrogazione' : 'Ripasso'}>
      <BigButton icon="back" label="Indietro" onClick={prev} disabled={index === 0} />
      <span className="review-progress" aria-live="polite">
        {index + 1} / {steps.length}
      </span>
      {quiz && !revealed ? (
        <BigButton icon="eye" label="Scopri" variant="primary" onClick={reveal} />
      ) : (
        <BigButton icon="speak" label={mode === 'interrogazione' ? 'Leggi' : 'Ripeti'} onClick={onRepeat} />
      )}
      {mode === 'interrogazione' && <BigButton icon="map" label="Tutta" onClick={onOverview} />}
      {last && (!quiz || revealed) ? (
        <BigButton icon="party" label="Finito!" variant="primary" onClick={onExit} />
      ) : (
        <BigButton icon="forward" label="Avanti" variant={quiz && !revealed ? 'default' : 'primary'} onClick={next} disabled={last} />
      )}
    </nav>
  );
}
