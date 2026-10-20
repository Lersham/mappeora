import { useEffect, useRef, useState } from 'react';
import { BigButton } from '../../components/BigButton';
import { DictationOverlay } from '../../components/DictationOverlay';
import { useDictation } from '../../hooks/useDictation';
import { useReadAloud } from '../../hooks/useReadAloud';
import type { ReadingStep } from '../../lib/readingOrder';
import { parseQuizAnswer, QUIZ_VOICE_HINTS } from '../../lib/voiceCommands';
import { useMapStore } from '../../store/mapStore';
import { quizSummary, useReview } from '../../store/reviewStore';
import { spokenLabel } from './a11yLabels';

interface Props {
  onRepeat(): void;
  onOverview(): void;
  onExit(): void;
}

const UNCLEAR = 'Non ho capito. Prova a dire «lo sapevo» o «non lo sapevo», oppure tocca un pulsante.';

/**
 * «Indovina»: «Scopri», then the child says whether they knew the concept.
 * The answers live only as long as the review: nothing is saved.
 */
export function QuizBar({ onRepeat, onOverview, onExit }: Props) {
  const { index, steps, revealed, done, known, missed, prev, next, reveal, answer, finish, retryMissed } = useReview();
  const nodes = useMapStore((s) => s.map?.nodes);
  const dictation = useDictation();
  const { readText } = useReadAloud();
  const [unclear, setUnclear] = useState(false);
  const main = useRef<HTMLElement>(null);
  const answers = useRef<HTMLDivElement>(null);

  const last = index === steps.length - 1;
  const graded = Object.keys(known).length + Object.keys(missed).length > 0;
  const hasMissed = Object.keys(missed).length > 0;
  // The concept's name, not the whole proposition that is read aloud; a concept without one is called as everywhere else.
  const nameOf = (step: ReadingStep) => spokenLabel(nodes?.find((n) => n.id === step.nodeId)?.label ?? '');
  const summary = done ? quizSummary({ steps, known, missed }, nameOf) : '';

  useEffect(() => setUnclear(false), [index, revealed, done]);

  // At the end the whole map is shown (the concepts to look at again ringed)
  // and the summary is read aloud, as at the end of Ripetimi.
  useEffect(() => {
    if (!done) return;
    onOverview();
    void readText(summary);
  }, [done]);

  // The button that was pressed goes away with the answer: the keyboard
  // goes on from the next «Scopri» (or the end), not from the top of the page.
  const refocus = useRef(false);
  useEffect(() => {
    if (!refocus.current) return;
    refocus.current = false;
    main.current?.querySelector<HTMLElement>('.quiz-focus')?.focus();
  }, [index, done]);
  const goOn = (action: () => void) => {
    refocus.current = true;
    action();
  };
  const grade = (knew: boolean) => goOn(() => answer(knew));

  // «Scopri» turns into «Ripeti» under the finger, and the answers appear
  // before it in the page: without a cue, Tab would skip them and a screen
  // reader would say nothing. Focus goes to the group (not to a button, so a
  // second Enter cannot answer by mistake) only when «Scopri» was used from
  // the bar or a clicker, never when going back with «Indietro».
  const before = useRef({ index, revealed });
  useEffect(() => {
    const was = before.current;
    before.current = { index, revealed };
    if (!revealed || was.revealed || was.index !== index || done) return;
    const at = document.activeElement;
    if (at && at !== document.body && !main.current?.contains(at)) return;
    answers.current?.focus();
  }, [index, revealed, done]);

  const answerByVoice = async () => {
    setUnclear(false);
    const at = useReview.getState().index;
    const said = await dictation.start();
    const s = useReview.getState();
    // Something else happened meanwhile (the review was left, another concept).
    if (!said || !s.active || s.mode !== 'quiz' || s.done || !s.revealed || s.index !== at) return;
    const heard = parseQuizAnswer(said);
    if (heard) grade(heard === 'knew');
    else setUnclear(true);
  };

  const text = done ? summary : unclear ? UNCLEAR : '';
  return (
    <>
      {/* Always there, so a screen reader announces what changes in it. */}
      {/* The summary can be longer than the room: it scrolls, so the keyboard must reach it. */}
      <p
        className={text ? `present-caption quiz-text${done ? ' quiz-summary' : ''}` : 'sr-only'}
        aria-live="polite"
        {...(done ? { tabIndex: 0, role: 'region', 'aria-label': 'Riepilogo' } : {})}
      >
        {text}
      </p>
      {revealed && !done && (
        <div ref={answers} tabIndex={-1} className="toolbar review-bar quiz-answers" role="group" aria-label="Come è andata?">
          <BigButton icon="reset" label="Non lo sapevo" onClick={() => grade(false)} />
          {dictation.supported && <BigButton icon="mic" label="A voce" className="quiz-voice" onClick={() => void answerByVoice()} disabled={dictation.listening} />}
          <BigButton icon="check" label="Lo sapevo" onClick={() => grade(true)} />
        </div>
      )}
      <nav ref={main} className="toolbar review-bar" aria-label="Ripasso">
        <BigButton icon="back" label="Indietro" onClick={prev} disabled={index === 0 && !done} />
        {done ? (
          <>
            {hasMissed && <BigButton icon="brain" label="Ripassa solo questi" variant="primary" className="quiz-focus quiz-again" onClick={() => goOn(retryMissed)} />}
            <BigButton icon="party" label="Fine" variant={hasMissed ? 'default' : 'primary'} className={hasMissed ? '' : 'quiz-focus'} onClick={onExit} />
          </>
        ) : (
          <>
            <span className="review-progress" aria-live="polite">
              {index + 1} / {steps.length}
            </span>
            {revealed ? (
              <BigButton icon="speak" label="Ripeti" onClick={onRepeat} />
            ) : (
              <BigButton icon="eye" label="Scopri" variant="primary" className="quiz-focus" onClick={reveal} />
            )}
            {last && revealed ? (
              // Without having answered anything there is no summary to show.
              <BigButton icon="party" label="Finito!" onClick={graded ? () => goOn(finish) : onExit} />
            ) : (
              <BigButton icon="forward" label="Avanti" onClick={next} disabled={last} />
            )}
          </>
        )}
      </nav>
      <DictationOverlay
        listening={dictation.listening}
        partial={dictation.partial}
        error={dictation.error}
        hints={QUIZ_VOICE_HINTS}
        onStop={() => void dictation.stop()}
        onClose={dictation.clearError}
      />
    </>
  );
}
