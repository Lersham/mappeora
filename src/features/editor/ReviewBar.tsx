import { BigButton } from '../../components/BigButton';
import { useReview } from '../../store/reviewStore';

interface Props {
  onRepeat(): void;
  onOverview(): void;
  onExit(): void;
}

export function ReviewBar({ onRepeat, onOverview, onExit }: Props) {
  const { index, steps, mode, revealed, next, prev, reveal } = useReview();
  const last = index === steps.length - 1;
  const quiz = mode === 'quiz';
  return (
    <nav className="toolbar review-bar" aria-label={mode === 'interrogazione' ? 'Interrogazione' : 'Ripasso'}>
      <BigButton icon="⬅️" label="Indietro" onClick={prev} disabled={index === 0} />
      <span className="review-progress" aria-live="polite">
        {index + 1} / {steps.length}
      </span>
      {quiz && !revealed ? (
        <BigButton icon="👀" label="Scopri" variant="primary" onClick={reveal} />
      ) : (
        <BigButton icon="🔊" label={mode === 'interrogazione' ? 'Leggi' : 'Ripeti'} onClick={onRepeat} />
      )}
      {mode === 'interrogazione' && <BigButton icon="🗺️" label="Tutta" onClick={onOverview} />}
      {last && (!quiz || revealed) ? (
        <BigButton icon="🎉" label="Finito!" variant="primary" onClick={onExit} />
      ) : (
        <BigButton icon="➡️" label="Avanti" variant={quiz && !revealed ? 'default' : 'primary'} onClick={next} disabled={last} />
      )}
    </nav>
  );
}
