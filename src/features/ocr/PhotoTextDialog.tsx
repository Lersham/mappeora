import { useEffect, useMemo, useRef, useState } from 'react';
import { BigButton } from '../../components/BigButton';
import { pickPhoto, type PhotoSource } from '../../services/photo';
import { ocr, OcrDownloadError, PhotoDecodeError } from '../../services/ocr';
import { cleanOcrText, selectionToConcepts, tokenize } from '../../lib/ocrText';
import { useReadLongText } from '../../hooks/useReadLongText';
import { useModal } from '../../components/Dialog';
import { Listenable } from '../../components/OptionCard';

const INTRO = 'Fotografa una pagina: leggerò il testo per te e potrai scegliere le parole importanti.';
const PICK_HINT = 'Tocca le parole importanti, oppure passaci sopra il dito come un evidenziatore: diventeranno concetti della mappa.';

type Step =
  | { kind: 'pick' }
  | { kind: 'reading'; progress: number | null; photo: string }
  | { kind: 'text' }
  | { kind: 'error'; message: string; detail?: string };

interface Props {
  /** Adds the chosen concepts to the map. */
  onAdd(concepts: string[]): void;
  onClose(): void;
}

/**
 * "Dal libro": photo of a page → text (OCR on the device) → read it aloud
 * → tap the important words, or drag across them like a highlighter → they
 * become concepts of the map.
 */
export function PhotoTextDialog({ onAdd, onClose }: Props) {
  const [step, setStep] = useState<Step>({ kind: 'pick' });
  const [text, setText] = useState('');
  const [editing, setEditing] = useState(false);
  /** The text when «Correggi» was pressed: chosen words survive if it did not change. */
  const textBeforeEdit = useRef('');
  const [selected, setSelected] = useState<ReadonlySet<number>>(new Set());
  const reader = useReadLongText();
  // No closing on a tap outside: the text read from the photo would be lost.
  const { ref, onKeyDown, tabIndex } = useModal(onClose);

  const tokens = useMemo(() => tokenize(text), [text]);
  const concepts = useMemo(() => selectionToConcepts(text, tokens, selected), [text, tokens, selected]);

  // The page being read: «Annulla», closing, or another photo cancel it.
  const job = useRef<AbortController | null>(null);
  useEffect(() => () => job.current?.abort(), []);

  const takePhoto = async (source: PhotoSource) => {
    void reader.stop();
    let photo;
    try {
      photo = await pickPhoto(source);
    } catch (e) {
      setStep({
        kind: 'error',
        message: source === 'camera'
          ? 'Non riesco ad aprire la fotocamera. Prova con «Scegli una foto».'
          : 'Non riesco ad aprire le foto. Riprova!',
        detail: errorDetail(e),
      });
      return;
    }
    if (!photo) return;
    job.current?.abort();
    const current = new AbortController();
    job.current = current;
    setStep({ kind: 'reading', progress: null, photo: photo.webPath });
    try {
      const raw = await ocr().recognize(
        photo,
        (p) => {
          if (job.current === current) setStep((s) => (s.kind === 'reading' ? { ...s, progress: p } : s));
        },
        current.signal,
      );
      if (job.current !== current) return;
      job.current = null;
      const clean = cleanOcrText(raw);
      if (!clean) {
        setStep({ kind: 'error', message: 'Non ho trovato parole nella foto. Prova con più luce e la pagina dritta.' });
        return;
      }
      setText(clean);
      setSelected(new Set());
      setEditing(false);
      setStep({ kind: 'text' });
    } catch (e) {
      if (job.current !== current) return; // cancelled: nothing to say
      job.current = null;
      setStep({
        kind: 'error',
        message:
          e instanceof OcrDownloadError || !navigator.onLine
            ? 'La prima volta serve internet per scaricare il lettore di testo. Controlla la connessione: a volte la rete della scuola blocca il download.'
            : e instanceof PhotoDecodeError
              ? 'Questa foto non si apre. Prova con un’altra foto, o con una foto JPG o PNG.'
              : 'Non sono riuscito a leggere la foto. Riprova!',
        // Shown small, so an adult can report what went wrong.
        detail: errorDetail(e),
      });
    }
  };

  const cancelReading = () => {
    job.current?.abort();
    job.current = null;
    setStep(text ? { kind: 'text' } : { kind: 'pick' });
  };

  const toggle = (word: number) =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(word)) next.delete(word);
      else next.add(word);
      return next;
    });

  // The highlighter: a finger (or the mouse) dragged across the words marks
  // all of them, as on the book; starting on a marked word unmarks instead.
  const drag = useRef<{ anchor: number; mark: boolean; before: ReadonlySet<number> } | null>(null);
  // A tap is handled on pointerdown: the click that follows must not undo it.
  const fromPointer = useRef(false);
  const paint = (to: number) => {
    const d = drag.current;
    if (!d) return;
    const [from, end] = d.anchor < to ? [d.anchor, to] : [to, d.anchor];
    const next = new Set(d.before);
    for (let w = from; w <= end; w++) {
      if (d.mark) next.add(w);
      else next.delete(w);
    }
    setSelected(next);
  };
  useEffect(() => {
    const end = (e: PointerEvent) => {
      // The browser took the gesture to scroll the text: it was not a highlight.
      if (e.type === 'pointercancel' && drag.current) setSelected(drag.current.before);
      drag.current = null;
      setTimeout(() => void (fromPointer.current = false));
    };
    window.addEventListener('pointerup', end);
    window.addEventListener('pointercancel', end);
    return () => {
      window.removeEventListener('pointerup', end);
      window.removeEventListener('pointercancel', end);
    };
  }, []);

  return (
    <div className="overlay" role="dialog" aria-modal="true" aria-label="Dal libro" ref={ref} onKeyDown={onKeyDown} tabIndex={tabIndex}>
      <div className="overlay-card photo-text">
        <h2 className="dialog-title">📷 Dal libro</h2>

        {step.kind === 'pick' && (
          <>
            <Listenable text={INTRO}>
              <p>{INTRO}</p>
            </Listenable>
            <div className="photo-sources">
              <BigButton icon="📷" label="Scatta una foto" variant="primary" onClick={() => void takePhoto('camera')} />
              <BigButton icon="🖼️" label="Scegli una foto" onClick={() => void takePhoto('gallery')} />
            </div>
            <p className="muted small">🔒 La foto resta sul tuo dispositivo: non viene inviata a nessuno.</p>
            {text && (
              <div className="photo-sources">
                <BigButton icon="↩️" label="Torna al testo" onClick={() => setStep({ kind: 'text' })} />
              </div>
            )}
          </>
        )}

        {step.kind === 'reading' && (
          <div className="ocr-progress" aria-live="polite">
            <img src={step.photo} alt="" className="ocr-thumb" />
            <p>Sto leggendo la pagina…</p>
            <div className="progress-bar" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={step.progress === null ? undefined : Math.round(step.progress * 100)}>
              <div className={`progress-fill${step.progress === null ? ' indeterminate' : ''}`} style={step.progress === null ? undefined : { width: `${Math.round(step.progress * 100)}%` }} />
            </div>
            <BigButton icon="⏹️" label="Annulla" onClick={cancelReading} />
          </div>
        )}

        {step.kind === 'error' && (
          <>
            <p className="field-error" role="alert">{step.message}</p>
            {step.detail && <p className="muted small">Dettagli tecnici: {step.detail}</p>}
            <div className="photo-sources">
              <BigButton icon="📷" label="Riprova" variant="primary" onClick={() => setStep({ kind: 'pick' })} />
            </div>
          </>
        )}

        {step.kind === 'text' && (
          <>
            <div className="ocr-actions">
              {reader.reading ? (
                <BigButton icon="⏹️" label="Stop" onClick={() => void reader.stop()} />
              ) : (
                <BigButton icon="🔊" label="Leggi" onClick={() => void reader.read(text)} disabled={editing} />
              )}
              <BigButton
                icon={editing ? '✅' : '✏️'}
                label={editing ? 'Fatto' : 'Correggi'}
                onClick={() => {
                  void reader.stop();
                  // Word positions changed: the chosen words no longer match.
                  if (editing && text !== textBeforeEdit.current) setSelected(new Set());
                  textBeforeEdit.current = text;
                  setEditing(!editing);
                }}
              />
              <BigButton
                icon="📷"
                label="Altra foto"
                onClick={() => {
                  void reader.stop();
                  setStep({ kind: 'pick' });
                }}
              />
            </div>

            {editing ? (
              <textarea className="ocr-text ocr-editor" value={text} aria-label="Testo letto dalla foto" onChange={(e) => setText(e.target.value)} />
            ) : (
              <>
                <Listenable text={PICK_HINT} label="Ascolta come fare">
                  <p className="muted small">👆 {PICK_HINT}</p>
                </Listenable>
                <div
                  className="ocr-text ocr-pick"
                  onPointerMove={(e) => {
                    if (!drag.current) return;
                    const el = document.elementFromPoint(e.clientX, e.clientY)?.closest<HTMLElement>('[data-word]');
                    if (el) paint(Number(el.dataset.word));
                  }}
                >
                  {tokens.map((t, i) => {
                    const spoken = reader.word && t.start < reader.word.end && t.end > reader.word.start;
                    if (t.word < 0) return <span key={i}>{t.text}</span>;
                    return (
                      <button
                        key={i}
                        type="button"
                        className={`ocr-word${selected.has(t.word) ? ' is-selected' : ''}${spoken ? ' is-spoken' : ''}`}
                        aria-pressed={selected.has(t.word)}
                        data-word={t.word}
                        onPointerDown={(e) => {
                          if (e.button !== 0) return;
                          fromPointer.current = true;
                          drag.current = { anchor: t.word, mark: !selected.has(t.word), before: selected };
                          paint(t.word);
                        }}
                        onClick={() => {
                          // Keyboard and screen readers: Enter or Space toggles.
                          if (!fromPointer.current) toggle(t.word);
                          fromPointer.current = false;
                        }}
                      >
                        {t.text}
                      </button>
                    );
                  })}
                </div>
              </>
            )}

            {!editing && (
              <div className="concept-preview" aria-live="polite">
                {concepts.length === 0 ? (
                  <span className="muted small">Nessun concetto scelto.</span>
                ) : (
                  concepts.map((c) => (
                    <span key={c} className="chip static">
                      {c}
                    </span>
                  ))
                )}
              </div>
            )}
          </>
        )}

        <div className="dialog-actions">
          <BigButton icon="✖️" label="Chiudi" onClick={onClose} />
          {step.kind === 'text' && (
            <BigButton
              icon="➕"
              label={concepts.length === 1 ? 'Aggiungi 1 concetto' : `Aggiungi ${concepts.length} concetti`}
              variant="primary"
              disabled={editing || concepts.length === 0}
              onClick={() => onAdd(concepts)}
            />
          )}
        </div>
      </div>
    </div>
  );
}

function errorDetail(e: unknown): string {
  if (e instanceof Error) return e.message;
  const code = (e as { code?: string } | null)?.code;
  return code ? `${code} ${String((e as { message?: string }).message ?? '')}`.trim() : String(e);
}
