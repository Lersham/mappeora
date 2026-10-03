import { BigButton } from '../../components/BigButton';
import { useReview } from '../../store/reviewStore';

export function ReviewBar({ onRepeat, onExit }: { onRepeat(): void; onExit(): void }) {
  const { index, steps, quiz, revealed, next, prev, reveal } = useReview();
  const last = index === steps.length - 1;
  return (
    <nav className="toolbar review-bar" aria-label="Ripasso">
      <BigButton icon="⬅️" label="Indietro" onClick={prev} disabled={index === 0} />
      <span className="review-progress" aria-live="polite">
        {index + 1} / {steps.length}
      </span>
      {quiz && !revealed ? (
        <BigButton icon="👀" label="Scopri" variant="primary" onClick={reveal} />
      ) : (
        <BigButton icon="🔊" label="Ripeti" onClick={onRepeat} />
      )}
      {last && (!quiz || revealed) ? (
        <BigButton icon="🎉" label="Finito!" variant="primary" onClick={onExit} />
      ) : (
        <BigButton icon="➡️" label="Avanti" variant={quiz && !revealed ? 'default' : 'primary'} onClick={next} disabled={last} />
      )}
    </nav>
  );
}
