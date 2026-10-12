import { Fragment, useEffect, useMemo, useRef, useState } from 'react';
import { BigButton } from '../../components/BigButton';
import { pickPhoto, type PhotoSource } from '../../services/photo';
import { ocr, OcrDownloadError, PhotoDecodeError } from '../../services/ocr';
import { cleanOcrText, conceptGroups, tokenize } from '../../lib/ocrText';
import { loadBookPage, saveBookPage } from '../../lib/bookPage';
import { useReadLongText } from '../../hooks/useReadLongText';
import { useModal } from '../../components/Dialog';
import { Listenable } from '../../components/OptionCard';
import { Icon } from '../../components/Icon';

const INTRO = 'Fotografa una pagina: leggerò il testo per te e potrai scegliere le parole importanti.';
/** How late the click of a tap can arrive and still be recognised as that tap's. */
const TAP_CLICK_MS = 1500;
/** While highlighting, this close (px) to the top or bottom of the text it scrolls. */
const EDGE = 32;
const PICK_HINT =
  'Tocca le parole importanti, oppure passaci sopra il dito come un evidenziatore: diventeranno concetti della mappa. Sotto vedi i concetti: con la catena ne unisci due, con le forbici ne dividi uno in parole.';
const USED_HINT = 'È la pagina dell’ultima volta: le parole sottolineate a puntini sono già nella mappa.';

type Step =
  | { kind: 'pick' }
  | { kind: 'reading'; progress: number | null; photo: string }
  | { kind: 'text' }
  | { kind: 'error'; message: string; detail?: string };

interface Props {
  /** The map: its last page is remembered for next time. */
  mapId: string;
  /** Adds the chosen concepts to the map. */
  onAdd(concepts: string[]): void;
  onClose(): void;
}

/**
 * "Dal libro": photo of a page → text (OCR on the device) → read it aloud
 * → tap the important words, or drag across them like a highlighter → they
 * become concepts of the map.
 */
export function PhotoTextDialog({ mapId, onAdd, onClose }: Props) {
  // The last page read for this map comes back as it was left.
  const [remembered] = useState(() => loadBookPage(mapId));
  const [step, setStep] = useState<Step>(remembered ? { kind: 'text' } : { kind: 'pick' });
  const [text, setText] = useState(remembered?.text ?? '');
  /** Words already added to the map from this page. */
  const [used, setUsed] = useState<ReadonlySet<number>>(() => new Set(remembered?.used));
  /** The child's choice for the gap after a word: true joins, false splits. */
  const [joined, setJoined] = useState<ReadonlyMap<number, boolean>>(new Map());
  const [editing, setEditing] = useState(false);
  /** The text when «Correggi» was pressed: chosen words survive if it did not change. */
  const textBeforeEdit = useRef('');
  const [selected, setSelected] = useState<ReadonlySet<number>>(new Set());
  const reader = useReadLongText();
  // No closing on a tap outside: the text read from the photo would be lost.
  const { ref, onKeyDown, tabIndex } = useModal(onClose);

  const tokens = useMemo(() => tokenize(text), [text]);
  const groups = useMemo(() => conceptGroups(text, tokens, selected, joined), [text, tokens, selected, joined]);
  const concepts = groups.map((g) => g.label);
  /** Which concept each chosen word belongs to, to show where one ends. */
  const groupOf = useMemo(() => {
    const of = new Map<number, number>();
    groups.forEach((g, i) => {
      for (let w = g.first; w <= g.last; w++) of.set(w, i);
    });
    return of;
  }, [groups]);
  const setGap = (word: number, join: boolean) => setJoined((prev) => new Map(prev).set(word, join));

  useEffect(() => {
    if (text && !editing) saveBookPage(mapId, { text, used: [...used] });
  }, [mapId, text, used, editing]);

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
      // Only dots and dashes: nothing to choose from.
      if (!clean || !tokenize(clean).some((t) => t.word >= 0)) {
        setStep({ kind: 'error', message: 'Non ho trovato parole nella foto. Prova con più luce e la pagina dritta.' });
        return;
      }
      setText(clean);
      setSelected(new Set());
      setUsed(new Set());
      setJoined(new Map());
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
  // A tap is handled on pointerdown: the click that follows must not undo
  // it, even when a busy phone delivers that click late.
  const tapped = useRef<{ word: number; at: number } | null>(null);
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
      if (e.type === 'pointercancel') {
        if (drag.current) setSelected(drag.current.before);
        tapped.current = null; // no click will follow
      }
      drag.current = null;
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
        <h2 className="dialog-title">Dal libro</h2>

        {step.kind === 'pick' && (
          <>
            <Listenable text={INTRO}>
              <p>{INTRO}</p>
            </Listenable>
            <div className="photo-sources">
              <BigButton icon="camera" label="Scatta una foto" variant="primary" onClick={() => void takePhoto('camera')} />
              <BigButton icon="gallery" label="Scegli una foto" onClick={() => void takePhoto('gallery')} />
            </div>
            <p className="muted small">
              <Icon name="lock" className="inline-icon" /> La foto resta sul tuo dispositivo: non viene inviata a nessuno.</p>
            {text && (
              <div className="photo-sources">
                <BigButton icon="undo" label="Torna al testo" onClick={() => setStep({ kind: 'text' })} />
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
            <BigButton icon="stop" label="Annulla" onClick={cancelReading} />
          </div>
        )}

        {step.kind === 'error' && (
          <>
            <p className="field-error" role="alert">{step.message}</p>
            {step.detail && <p className="muted small">Dettagli tecnici: {step.detail}</p>}
            <div className="photo-sources">
              <BigButton icon="camera" label="Riprova" variant="primary" onClick={() => setStep({ kind: 'pick' })} />
            </div>
          </>
        )}

        {step.kind === 'text' && (
          <>
            <div className="ocr-actions">
              {reader.reading ? (
                <BigButton icon="stop" label="Stop" onClick={() => void reader.stop()} />
              ) : (
                <BigButton icon="speak" label="Leggi" onClick={() => void reader.read(text)} disabled={editing} />
              )}
              <BigButton
                icon={editing ? 'check' : 'edit'}
                label={editing ? 'Fatto' : 'Correggi'}
                onClick={() => {
                  void reader.stop();
                  // Word positions changed: the chosen words no longer match.
                  if (editing && text !== textBeforeEdit.current) {
                    setSelected(new Set());
                    setUsed(new Set());
                    setJoined(new Map());
                  }
                  textBeforeEdit.current = text;
                  setEditing(!editing);
                }}
              />
              <BigButton
                icon="camera"
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
                  <p className="muted small">{PICK_HINT}</p>
                </Listenable>
                {used.size > 0 && <p className="muted small">{USED_HINT}</p>}
                <div
                  className="ocr-text ocr-pick"
                  onPointerMove={(e) => {
                    if (!drag.current) return;
                    // Near the top or bottom edge the text scrolls under the finger.
                    const box = e.currentTarget.getBoundingClientRect();
                    if (e.clientY < box.top + EDGE) e.currentTarget.scrollTop -= EDGE / 2;
                    else if (e.clientY > box.bottom - EDGE) e.currentTarget.scrollTop += EDGE / 2;
                    const el = document.elementFromPoint(e.clientX, e.clientY)?.closest<HTMLElement>('[data-word]');
                    if (el) paint(Number(el.dataset.word));
                  }}
                >
                  {tokens.map((t, i) => {
                    const spoken = reader.word && t.start < reader.word.end && t.end > reader.word.start;
                    if (t.word < 0) return <span key={i}>{t.text}</span>;
                    const group = groupOf.get(t.word);
                    const starts = group !== undefined && groups[group].first === t.word;
                    return (
                      <button
                        key={i}
                        type="button"
                        className={`ocr-word${selected.has(t.word) ? ' is-selected' : ''}${group !== undefined && group % 2 ? ' is-other' : ''}${starts && groupOf.get(t.word - 1) !== undefined ? ' is-start' : ''}${used.has(t.word) ? ' is-used' : ''}${spoken ? ' is-spoken' : ''}`}
                        aria-pressed={selected.has(t.word)}
                        data-word={t.word}
                        onPointerDown={(e) => {
                          if (e.button !== 0) return;
                          tapped.current = { word: t.word, at: performance.now() };
                          drag.current = { anchor: t.word, mark: !selected.has(t.word), before: selected };
                          paint(t.word);
                        }}
                        onClick={() => {
                          // The click of a tap already handled on pointerdown.
                          const tap = tapped.current;
                          tapped.current = null;
                          if (tap && tap.word === t.word && performance.now() - tap.at < TAP_CLICK_MS) return;
                          // Keyboard and screen readers: Enter or Space toggles.
                          toggle(t.word);
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
                  groups.map((g, i) => (
                    <Fragment key={g.first}>
                      {i > 0 && groups[i - 1].last + 1 === g.first && (
                        <button
                          type="button"
                          className="chip-tool"
                          aria-label={`Unisci «${groups[i - 1].label}» e «${g.label}»`}
                          title="Unisci"
                          onClick={() => setGap(groups[i - 1].last, true)}
                        >
                          <Icon name="join" />
                        </button>
                      )}
                      <span className={`chip static${i % 2 ? ' is-other' : ''}`}>
                        {g.label}
                        {g.first < g.last && (
                          <button
                            type="button"
                            className="chip-tool"
                            aria-label={`Dividi «${g.label}» in parole`}
                            title="Dividi"
                            onClick={() =>
                              setJoined((prev) => {
                                const next = new Map(prev);
                                for (let w = g.first; w < g.last; w++) next.set(w, false);
                                return next;
                              })
                            }
                          >
                            <Icon name="scissors" />
                          </button>
                        )}
                      </span>
                    </Fragment>
                  ))
                )}
              </div>
            )}
          </>
        )}

        <div className="dialog-actions">
          <BigButton icon="close" label="Chiudi" onClick={onClose} />
          {step.kind === 'text' && (
            <BigButton
              icon="plus"
              label={concepts.length === 1 ? 'Aggiungi 1 concetto' : `Aggiungi ${concepts.length} concetti`}
              variant="primary"
              disabled={editing || concepts.length === 0}
              onClick={() => {
                const now = new Set(used);
                for (const g of groups) for (let w = g.first; w <= g.last; w++) now.add(w);
                saveBookPage(mapId, { text, used: [...now] });
                onAdd(concepts);
              }}
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
