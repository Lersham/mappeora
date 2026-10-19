import { useEffect, useMemo, useRef, useState } from 'react';
import { BigButton } from '../../components/BigButton';
import { Icon } from '../../components/Icon';
import { useReadLongText } from '../../hooks/useReadLongText';
import { collapseInfo } from '../../lib/collapse';
import { mapToText, speakable, type TextStyle } from '../../lib/mapText';
import { isNative } from '../../services/platform';
import { copyText, saveText } from '../../services/shareText';
import { useMapStore } from '../../store/mapStore';

const STYLES: { value: TextStyle; label: string; hint: string }[] = [
  { value: 'scaletta', label: 'Scaletta', hint: 'I concetti a elenco, uno sotto l’altro.' },
  { value: 'frasi', label: 'Frasi', hint: 'Con le parole di collegamento: «L’acqua è formata da idrogeno».' },
];

/**
 * «Testo» of «Salva e manda»: the map as words to paste in a search, a
 * document or a message. It is all done here (the editor never hears of it):
 * rendered as part of the dialog, so the buttons stay at the bottom of its card.
 */
export function TextExport({ onClose }: { onClose(): void }) {
  const map = useMapStore((s) => s.map);
  const [style, setStyle] = useState<TextStyle>('scaletta');
  const [status, setStatus] = useState('');
  const [failed, setFailed] = useState(false);
  const [saving, setSaving] = useState(false);
  const preview = useRef<HTMLTextAreaElement>(null);
  const row = useRef<HTMLDivElement>(null);
  const reader = useReadLongText();
  const text = useMemo(() => (map ? mapToText(map, style) : ''), [map, style]);
  const closedParts = useMemo(() => (map ? collapseInfo(map).hidden.size > 0 : false), [map]);
  // The kinds above fill the card: the text must not appear out of sight, under the buttons.
  useEffect(() => row.current?.scrollIntoView({ block: 'nearest' }), []);
  if (!map) return null;

  const pick = (next: TextStyle) => {
    if (reader.reading) void reader.stop();
    setStyle(next);
    setStatus('');
    setFailed(false);
  };

  /** Last resort when the browser refuses to copy: the child copies it by hand. */
  const selectAll = () => {
    const el = preview.current;
    if (!el) return;
    el.focus();
    el.select();
    el.setSelectionRange(0, el.value.length); // iPhone ignores select() on a field it cannot edit
  };

  const copy = async () => {
    setFailed(false);
    if (await copyText(text)) return setStatus('Copiato!');
    selectAll();
    setStatus('Non sono riuscito a copiare. Ho evidenziato il testo: copialo tu.');
  };

  const save = async () => {
    setSaving(true);
    setStatus('');
    setFailed(false);
    try {
      await saveText(text, map.title, style);
      if (!isNative()) setStatus('Salvato nei Download.');
    } catch (e) {
      // A share sheet the child closed is not an error.
      if (!(e instanceof Error && /cancel/i.test(e.message))) setFailed(true);
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <fieldset>
        <legend>Come la vuoi?</legend>
        <div className="choice-row">
          {STYLES.map((s) => (
            <button key={s.value} type="button" className="choice" aria-pressed={style === s.value} onClick={() => pick(s.value)}>
              {s.label}
            </button>
          ))}
        </div>
        <p className="muted">{STYLES.find((s) => s.value === style)?.hint}</p>
      </fieldset>

      <div className="listenable text-preview-row" ref={row}>
        <div>
          <textarea ref={preview} className="ocr-text text-preview" readOnly spellCheck={false} lang="it" aria-label="Testo della mappa" value={text} />
        </div>
        <button
          type="button"
          className="icon-button"
          aria-label={reader.reading ? 'Stop' : 'Ascolta'}
          onClick={() => (reader.reading ? void reader.stop() : void reader.read(speakable(text, style)))}
        >
          <Icon name={reader.reading ? 'stop' : 'speak'} />
        </button>
      </div>

      {closedParts && <p className="muted">Le parti chiuse della mappa qui non ci sono. Aprile, se le vuoi nel testo.</p>}
      <p className="muted export-where">
        {isNative()
          ? '«Copia» la mette negli appunti, pronta da incollare. «Condividi» la manda in chat o per email.'
          : '«Copia» la mette negli appunti, pronta da incollare. «Salva .txt» la mette nei Download del dispositivo.'}
      </p>
      <p className="text-status" role="status">
        {status}
      </p>
      {failed && (
        <p className="field-error" role="alert">
          Non sono riuscito a salvare il testo. Riprova.
        </p>
      )}

      <div className="dialog-actions">
        <BigButton icon="close" label="Chiudi" onClick={onClose} />
        <BigButton icon="paste" label="Copia" onClick={() => void copy()} />
        <BigButton
          icon={isNative() ? 'share' : 'save'}
          label={saving ? 'Preparo…' : isNative() ? 'Condividi' : 'Salva .txt'}
          variant="primary"
          disabled={saving}
          onClick={() => void save()}
        />
      </div>
    </>
  );
}
