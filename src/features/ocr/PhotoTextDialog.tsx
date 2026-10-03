import { useMemo, useState } from 'react';
import { BigButton } from '../../components/BigButton';
import { pickPhoto, type PhotoSource } from '../../services/photo';
import { ocr } from '../../services/ocr';
import { cleanOcrText, selectionToConcepts, tokenize } from '../../lib/ocrText';
import { useReadLongText } from '../../hooks/useReadLongText';

type Step =
  | { kind: 'pick' }
  | { kind: 'reading'; progress: number | null; photo: string }
  | { kind: 'text' }
  | { kind: 'error'; message: string };

interface Props {
  /** Adds the chosen concepts to the map. */
  onAdd(concepts: string[]): void;
  onClose(): void;
}

/**
 * "Dal libro": photo of a page → text (OCR on the device) → read it aloud
 * → tap the important words → they become concepts of the map.
 */
export function PhotoTextDialog({ onAdd, onClose }: Props) {
  const [step, setStep] = useState<Step>({ kind: 'pick' });
  const [text, setText] = useState('');
  const [editing, setEditing] = useState(false);
  const [selected, setSelected] = useState<ReadonlySet<number>>(new Set());
  const reader = useReadLongText();

  const tokens = useMemo(() => tokenize(text), [text]);
  const concepts = useMemo(() => selectionToConcepts(text, tokens, selected), [text, tokens, selected]);

  const takePhoto = async (source: PhotoSource) => {
    const photo = await pickPhoto(source);
    if (!photo) return;
    setStep({ kind: 'reading', progress: null, photo: photo.webPath });
    try {
      const raw = await ocr().recognize(photo, (p) =>
        setStep((s) => (s.kind === 'reading' ? { ...s, progress: p } : s)),
      );
      const clean = cleanOcrText(raw);
      if (!clean) {
        setStep({ kind: 'error', message: 'Non ho trovato parole nella foto. Prova con più luce e la pagina dritta.' });
        return;
      }
      setText(clean);
      setSelected(new Set());
      setEditing(false);
      setStep({ kind: 'text' });
    } catch {
      setStep({
        kind: 'error',
        message: navigator.onLine
          ? 'Non sono riuscito a leggere la foto. Riprova!'
          : 'La prima volta serve internet per scaricare il lettore di testo.',
      });
    }
  };

  const toggle = (word: number) =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(word)) next.delete(word);
      else next.add(word);
      return next;
    });

  return (
    <div className="overlay" role="dialog" aria-modal="true" aria-label="Dal libro">
      <div className="overlay-card photo-text">
        <h2 className="dialog-title">📷 Dal libro</h2>

        {step.kind === 'pick' && (
          <>
            <p>Fotografa una pagina: leggerò il testo per te e potrai scegliere le parole importanti.</p>
            <div className="photo-sources">
              <BigButton icon="📷" label="Scatta una foto" variant="primary" onClick={() => void takePhoto('camera')} />
              <BigButton icon="🖼️" label="Scegli una foto" onClick={() => void takePhoto('gallery')} />
            </div>
            <p className="muted small">🔒 La foto resta sul tuo dispositivo: non viene inviata a nessuno.</p>
          </>
        )}

        {step.kind === 'reading' && (
          <div className="ocr-progress" aria-live="polite">
            <img src={step.photo} alt="" className="ocr-thumb" />
            <p>Sto leggendo la pagina…</p>
            <div className="progress-bar" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={step.progress === null ? undefined : Math.round(step.progress * 100)}>
              <div className={`progress-fill${step.progress === null ? ' indeterminate' : ''}`} style={step.progress === null ? undefined : { width: `${Math.round(step.progress * 100)}%` }} />
            </div>
          </div>
        )}

        {step.kind === 'error' && (
          <>
            <p className="field-error" role="alert">{step.message}</p>
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
                  if (editing) setSelected(new Set()); // word positions changed
                  setEditing(!editing);
                }}
              />
              <BigButton icon="📷" label="Altra foto" onClick={() => setStep({ kind: 'pick' })} />
            </div>

            {editing ? (
              <textarea className="ocr-text ocr-editor" value={text} aria-label="Testo letto dalla foto" onChange={(e) => setText(e.target.value)} />
            ) : (
              <>
                <p className="muted small">👆 Tocca le parole importanti: diventeranno concetti della mappa.</p>
                <div className="ocr-text">
                  {tokens.map((t, i) => {
                    const spoken = reader.word && t.start < reader.word.end && t.end > reader.word.start;
                    if (t.word < 0) return <span key={i}>{t.text}</span>;
                    return (
                      <button
                        key={i}
                        type="button"
                        className={`ocr-word${selected.has(t.word) ? ' is-selected' : ''}${spoken ? ' is-spoken' : ''}`}
                        aria-pressed={selected.has(t.word)}
                        onClick={() => toggle(t.word)}
                      >
                        {t.text}
                      </button>
                    );
                  })}
                </div>
              </>
            )}

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
          </>
        )}

        <div className="dialog-actions">
          <BigButton icon="✖️" label="Chiudi" onClick={onClose} />
          {step.kind === 'text' && (
            <BigButton
              icon="➕"
              label={concepts.length === 1 ? 'Aggiungi 1 concetto' : `Aggiungi ${concepts.length} concetti`}
              variant="primary"
              disabled={concepts.length === 0}
              onClick={() => onAdd(concepts)}
            />
          )}
        </div>
      </div>
    </div>
  );
}
