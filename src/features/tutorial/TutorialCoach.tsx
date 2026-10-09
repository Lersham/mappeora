import { useEffect, useState } from 'react';
import { BigButton } from '../../components/BigButton';
import { useMapStore } from '../../store/mapStore';
import { useReading } from '../../store/readingStore';
import { useReadAloud } from '../../hooks/useReadAloud';
import { TUTORIAL_STEPS, type TutorialProgress } from './steps';
import { Icon } from '../../components/Icon';

interface Props {
  index: number;
  onNext(): void;
  onClose(): void;
}

/**
 * «Impara facendo»: one step at a time, below the map. The child does the
 * step for real, on a map of their own; the card notices it and lets them go on.
 */
export function TutorialCoach({ index, onNext, onClose }: Props) {
  const step = TUTORIAL_STEPS[index];
  const last = index === TUTORIAL_STEPS.length - 1;
  const map = useMapStore((s) => s.map);
  const { readText } = useReadAloud();
  const [start] = useState<TutorialProgress | null>(() => {
    const now = useMapStore.getState().map;
    return now && { map: now, read: false };
  });
  // Reading aloud can start and end between two renders: catch it as it happens.
  const [read, setRead] = useState(false);
  useEffect(() => useReading.subscribe((s) => s.active && setRead(true)), []);
  // Once done, a step stays done (even after «Annulla»).
  const [done, setDone] = useState(false);
  useEffect(() => {
    if (!done && map && start && step.done?.({ map, read }, start)) setDone(true);
  }, [map, read]);

  return (
    <section className={`tutorial${done ? ' is-done' : ''}`} aria-label="Tutorial">
      <p className="tutorial-count">
        Passo {index + 1} di {TUTORIAL_STEPS.length}
      </p>
      <h2 className="tutorial-title">{step.title}</h2>
      <p className="tutorial-text">{step.text}</p>
      <p className="tutorial-status" role="status">
        {done && (
          <>
            <Icon name="check" className="inline-icon" /> Ben fatto! Premi «Avanti».
          </>
        )}
      </p>
      <div className="tutorial-actions">
        <BigButton icon="speak" label="Ascolta" onClick={() => void readText(`${step.title}. ${step.text}`)} />
        {last ? (
          <BigButton icon="check" label="Fine" variant="primary" onClick={onClose} />
        ) : (
          <>
            <BigButton icon="close" label="Chiudi" onClick={onClose} />
            {done ? (
              <BigButton icon="forward" label="Avanti" variant="primary" onClick={onNext} />
            ) : (
              <BigButton icon="skip" label="Salta" onClick={onNext} />
            )}
          </>
        )}
      </div>
    </section>
  );
}
