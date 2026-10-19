import { useEffect, useMemo, useRef, useState } from 'react';
import { BigButton } from '../../components/BigButton';
import { Icon } from '../../components/Icon';
import { useReadLongText } from '../../hooks/useReadLongText';
import { collapseInfo } from '../../lib/collapse';
import { hasCrossLinks, mapToText, speakable, type TextStyle } from '../../lib/mapText';
import { isNative } from '../../services/platform';
import { copyText, saveText } from '../../services/shareText';
import { useMapStore } from '../../store/mapStore';

const STYLES: { value: TextStyle; label: string; hint: string }[] = [
  { value: 'scaletta', label: 'Scaletta', hint: 'I concetti a elenco, uno sotto l’altro.' },
  { value: 'frasi', label: 'Frasi', hint: 'Con le parole di collegamento: «L’acqua è formata da idrogeno».' },
];

/** What the buttons just did, told under the text (a failure is an alert, the rest a polite status). */
interface Notice {
  text: string;
  failed?: boolean;
}

/**
 * «Testo» of «Salva e manda»: the map as words to paste in a search, a
 * document or a message. It is all done here (the editor never hears of it):
 * rendered as part of the dialog, so the buttons stay at the bottom of its card.
 */
export function TextExport({ onClose }: { onClose(): void }) {
  const map = useMapStore((s) => s.map);
  const [style, setStyle] = useState<TextStyle>('scaletta');
  const [notice, setNotice] = useState<Notice | null>(null);
  const [saving, setSaving] = useState(false);
  const preview = useRef<HTMLTextAreaElement>(null);
  const row = useRef<HTMLDivElement>(null);
  const feedback = useRef<HTMLDivElement>(null);
  const reader = useReadLongText();
  const text = useMemo(() => (map ? mapToText(map, style) : ''), [map, style]);
  const closedParts = useMemo(() => (map ? collapseInfo(map).hidden.size > 0 : false), [map]);
  const crossLinks = useMemo(() => (map ? hasCrossLinks(map) : false), [map]);
  // The kinds above fill the card: the text must not appear out of sight, under the buttons.
  useEffect(() => row.current?.scrollIntoView({ block: 'nearest' }), []);
  // A message under the buttons would only be heard: bring it into the window each time (also the same one twice).
  useEffect(() => {
    if (notice) feedback.current?.scrollIntoView({ block: 'nearest' });
  }, [notice]);
  if (!map) return null;

  const pick = (next: TextStyle) => {
    if (reader.reading) void reader.stop();
    setStyle(next);
    setNotice(null);
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
    if (await copyText(text)) return setNotice({ text: 'Copiato!' });
    selectAll();
    setNotice({ text: 'Non sono riuscito a copiare. Ho evidenziato il testo: copialo tu.' });
  };

  const save = async () => {
    setSaving(true);
    setNotice(null);
    try {
      await saveText(text, map.title, style);
      if (!isNative()) setNotice({ text: 'Salvato nei Download.' });
    } catch (e) {
      // A share sheet the child closed is not an error.
      if (!(e instanceof Error && /cancel/i.test(e.message))) setNotice({ text: 'Non sono riuscito a salvare il testo. Riprova.', failed: true });
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

      <div className="listenable" ref={row}>
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

      {/* Right under the text: further down it would be behind the buttons at the bottom of the card. */}
      <div ref={feedback}>
        <p className="text-status" role="status">
          {notice && !notice.failed ? notice.text : ''}
        </p>
        {notice?.failed && (
          <p className="field-error" role="alert">
            {notice.text}
          </p>
        )}
      </div>

      {closedParts && <p className="muted">Le parti chiuse della mappa qui non ci sono. Aprile, se le vuoi nel testo.</p>}
      {crossLinks && style === 'scaletta' && <p className="muted">Alcuni collegamenti tra i concetti si vedono solo in «Frasi».</p>}
      <p className="muted export-where">
        {isNative()
          ? '«Copia» la mette negli appunti, pronta da incollare. «Condividi» la manda in chat o per email.'
          : '«Copia» la mette negli appunti, pronta da incollare. «Salva .txt» la mette nei Download del dispositivo.'}
      </p>

      <div className="dialog-actions">
        <BigButton icon="close" label="Chiudi" onClick={onClose} />
        <BigButton icon="copy" label="Copia" onClick={() => void copy()} />
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
