import { useEffect, useRef, useState } from 'react';
import { Dialog } from '../../components/Dialog';
import { MicButton } from '../../components/MicButton';
import { BigButton } from '../../components/BigButton';
import { Listenable } from '../../components/OptionCard';
import { SpokenError } from '../../components/SpokenError';
import {
  ILLUSTRATIONS_CREDIT,
  illustrationThumbUrl,
  illustrationUrl,
  illustrationsFor,
  searchIllustrations,
  type Illustration,
} from '../../services/illustrations';
import { toIllustrationDataUrl } from '../../services/embed';
import { COLOR_NAMES, DEFAULT_COLOR, MORE_COLORS, NODE_COLORS, TEXT_COLOR, TEXT_COLORS, TEXT_COLOR_NAMES } from '../../lib/palette';
import { labelWords } from '../../lib/wordColors';
import { useMapStore } from '../../store/mapStore';
import { photoToDataUrl, pickPhoto, type PhotoSource } from '../../services/photo';
import { PasteError, fromPasteEvent, openGoogleImages, pastedToDataUrl, readClipboardImage } from '../../services/webImage';
import type { MapNode, NodeShape } from '../../types/map';

const GOOGLE_STEPS = [
  'Premi «Cerca su Google»: si apre Google Immagini con il filtro per ragazzi.',
  'Tieni premuta l’immagine che ti piace e scegli «Copia immagine».',
  'Torna qui: l’immagine arriva da sola. Se non arriva, premi «Incolla immagine».',
];

/** Back from Google, the clipboard is tried for about two seconds. */
const CLIPBOARD_RETRIES = 5;
const CLIPBOARD_RETRY_MS = 400;

/** Shown when the search finds nothing: common subjects at school. */
const SUGGESTED = [
  '💧', '🔥', '🌍', '☀️', '🌙', '⭐', '🌱', '🌳', '🌸', '🍎',
  '🐶', '🐟', '🐦', '🦋', '🐞', '🧠', '❤️', '🫁', '🦴', '👀',
  '🧑', '👥', '🏠', '🏰', '⛪', '🏛️', '🗺️', '⛰️', '🌊', '🏙️',
  '⚔️', '👑', '📜', '📅', '⏳', '🔢', '➕', '📏', '🔬', '⚡',
  '🚗', '🚂', '✈️', '⛵', '🎵', '🎨', '📚', '✏️', '💡', '❓',
];

const SHAPES: { value: NodeShape; label: string }[] = [
  { value: 'rettangolo', label: 'Rettangolo' },
  { value: 'ellisse', label: 'Ovale' },
  { value: 'nuvola', label: 'Nuvola' },
];

type Tab = 'illustrazioni' | 'foto';

const TABS: { value: Tab; label: string }[] = [
  { value: 'illustrazioni', label: 'Illustrazioni' },
  { value: 'foto', label: 'Foto e Google' },
];

export function NodeStyleDialog({ node, onClose }: { node: MapNode; onClose(): void }) {
  const updateNode = useMapStore((s) => s.updateNode);
  const [tab, setTab] = useState<Tab>('illustrazioni');
  const [name, setName] = useState(node.label);
  const [query, setQuery] = useState(node.label);
  const [illustrations, setIllustrations] = useState<Illustration[] | null>(null);
  const [suggested, setSuggested] = useState<Illustration[]>([]);
  const [busy, setBusy] = useState(false);
  const [photoError, setPhotoError] = useState<string | null>(null);
  const [showPasteBox, setShowPasteBox] = useState(false);
  /** Back from Google without a picture: «Incolla immagine» stands out. */
  const [pasteHint, setPasteHint] = useState(false);
  /** Google is open: when the child comes back, the copied picture comes with them. */
  const awayAtGoogle = useRef(false);
  /** The illustration being downloaded: dropped when the dialog closes. */
  const pending = useRef<AbortController | null>(null);
  /** Closed while a photo was being read: it no longer belongs anywhere. */
  const closed = useRef(false);
  useEffect(() => {
    closed.current = false;
    return () => {
      closed.current = true;
      pending.current?.abort();
      pending.current = null;
    };
  }, []);

  // Illustrations are searched on the device: no delay needed.
  useEffect(() => {
    if (tab !== 'illustrazioni') return;
    let current = true;
    void searchIllustrations(query).then((r) => current && setIllustrations(r));
    return () => {
      current = false;
    };
  }, [query, tab]);
  useEffect(() => void illustrationsFor(SUGGESTED).then(setSuggested), []);

  const choose = (image: MapNode['image']) => {
    // onClose would close whatever is open now, another window.
    if (closed.current) return;
    pending.current?.abort();
    pending.current = null;
    updateNode(node.id, { image });
    close();
  };

  /**
   * Saves the picture inside the map, so it shows offline and in shared
   * files. Without internet the concept gets the same subject as a symbol.
   */
  const chooseIllustration = async (i: Illustration) => {
    const download = new AbortController();
    pending.current = download;
    setBusy(true);
    const src = await toIllustrationDataUrl(illustrationUrl(i.path), download.signal);
    // Closed, or «Togli immagine», while waiting: nothing more to do.
    if (pending.current !== download) return;
    choose(src ? { kind: 'illustrazione', ref: i.path, src } : { kind: 'emoji', ref: i.glyph });
  };

  const addPhoto = async (source: PhotoSource) => {
    let photo;
    try {
      photo = await pickPhoto(source);
    } catch {
      setPhotoError(
        source === 'camera'
          ? 'Non riesco ad aprire la fotocamera. Prova con «Dalla galleria».'
          : 'Non riesco ad aprire le foto. Riprova!',
      );
      return;
    }
    if (!photo) return;
    setPhotoError(null);
    setBusy(true);
    try {
      choose({ kind: 'foto', ref: await photoToDataUrl(photo.webPath) });
    } catch {
      setBusy(false);
      setPhotoError('Non riesco a usare questa foto. Prova con un’altra.');
    } finally {
      if (photo.webPath.startsWith('blob:')) URL.revokeObjectURL(photo.webPath);
    }
  };

  const usePasted = async (pasted: Blob | string) => {
    setBusy(true);
    setPhotoError(null);
    try {
      choose({ kind: 'foto', ref: await pastedToDataUrl(pasted) });
    } catch (e) {
      setBusy(false);
      setPhotoError(e instanceof PasteError ? e.message : 'Non riesco a usare questa immagine. Prova con un’altra.');
    }
  };

  const pasteFromClipboard = async () => {
    const pasted = await readClipboardImage();
    // Not allowed here (e.g. inside the Android app): paste by hand instead.
    if (pasted === null) return setShowPasteBox(true);
    await usePasted(pasted);
  };

  const searchGoogle = () => {
    awayAtGoogle.current = true;
    setPasteHint(false);
    openGoogleImages(query);
  };

  // Back from Google (the app or tab shows again): the picture just copied
  // goes in by itself, where the browser lets the app read the clipboard.
  // Only a picture: text there may be anything copied before.
  useEffect(() => {
    if (tab !== 'foto') return;
    let retry: number | undefined;
    let reading = false;
    const back = async (tries = 0) => {
      if (!awayAtGoogle.current || reading || document.visibilityState !== 'visible') return;
      window.clearTimeout(retry);
      reading = true;
      const pasted = await readClipboardImage();
      reading = false;
      if (!awayAtGoogle.current) return;
      // Not allowed yet: phones show the page before they give it the focus,
      // and only a page with the focus can read the clipboard.
      if (pasted === null && tries < CLIPBOARD_RETRIES) {
        retry = window.setTimeout(() => void back(tries + 1), CLIPBOARD_RETRY_MS);
        return;
      }
      awayAtGoogle.current = false;
      if (pasted instanceof Blob || (typeof pasted === 'string' && /^data:image\//i.test(pasted.trim()))) void usePasted(pasted);
      else setPasteHint(true);
    };
    const onBack = () => void back();
    window.addEventListener('focus', onBack);
    document.addEventListener('visibilitychange', onBack);
    return () => {
      // Another tab: a later return to the app is not a return from Google.
      awayAtGoogle.current = false;
      window.clearTimeout(retry);
      window.removeEventListener('focus', onBack);
      document.removeEventListener('visibilitychange', onBack);
    };
  }, [tab]);

  // Ctrl+V / Cmd+V anywhere while the "Foto e Google" tab is open.
  useEffect(() => {
    if (tab !== 'foto') return;
    const onPaste = (e: ClipboardEvent) => {
      if (e.target instanceof HTMLInputElement) return; // the search field
      const pasted = fromPasteEvent(e);
      if (!pasted) return;
      e.preventDefault();
      void usePasted(pasted);
    };
    document.addEventListener('paste', onPaste);
    return () => document.removeEventListener('paste', onPaste);
  }, [tab]);

  const searchRow = (
    <div className="search-row">
      <input
        type="search"
        className="text-field"
        value={query}
        placeholder="Cerca un'immagine…"
        aria-label="Cerca un'immagine"
        onChange={(e) => setQuery(e.target.value)}
      />
      <MicButton onText={setQuery} label="Cerca con la voce" />
    </div>
  );

  const shownIllustrations = illustrations && illustrations.length > 0 ? illustrations : suggested;

  /** The new name goes into the map when the field is left (one undo step, not one per letter). */
  const saveName = (next = name) => {
    const label = next.trim();
    if (!label || label === node.label) return;
    updateNode(node.id, { label });
    // The search still had the old name: it follows the new one.
    if (query === node.label) setQuery(label);
  };
  const close = () => {
    saveName();
    onClose();
  };

  return (
    <Dialog title="Nome, colore e immagine" onClose={close} className="style-dialog">
      <fieldset>
        <legend>Nome</legend>
        <div className="search-row">
          <input
            className="text-field"
            value={name}
            aria-label="Nome del concetto"
            enterKeyHint="done"
            onChange={(e) => setName(e.target.value)}
            onBlur={() => saveName()}
            onKeyDown={(e) => {
              if (e.key === 'Enter') saveName();
            }}
          />
          <MicButton
            onText={(t) => {
              setName(t);
              saveName(t);
            }}
            label="Detta il nome"
          />
        </div>
      </fieldset>

      <fieldset>
        <legend>Colore</legend>
        <div className="choice-row">
          {[...NODE_COLORS, ...MORE_COLORS, DEFAULT_COLOR].map((c) => (
            <button
              key={c}
              type="button"
              className="color-swatch"
              style={{ background: c }}
              aria-label={`Colore ${COLOR_NAMES[c] ?? c}`}
              title={COLOR_NAMES[c]}
              aria-pressed={node.color === c}
              onClick={() => updateNode(node.id, { color: c })}
            />
          ))}
        </div>
      </fieldset>

      <WordColors node={node} />

      <fieldset>
        <legend>Forma</legend>
        <div className="choice-row">
          {SHAPES.map((s) => (
            <button key={s.value} type="button" className="choice" aria-pressed={(node.shape ?? 'rettangolo') === s.value} onClick={() => updateNode(node.id, { shape: s.value })}>
              {s.label}
            </button>
          ))}
        </div>
      </fieldset>

      {node.width && (
        <fieldset>
          <legend>Larghezza</legend>
          <div className="choice-row">
            <button type="button" className="choice" onClick={() => updateNode(node.id, { width: undefined })}>
              Automatica
            </button>
          </div>
        </fieldset>
      )}

      <h3 className="photo-web-title">Immagine</h3>
      <div className="choice-row" role="group" aria-label="Scegli da dove">
        {TABS.map((t) => (
          <button key={t.value} type="button" className="choice" aria-pressed={tab === t.value} onClick={() => setTab(t.value)}>
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'illustrazioni' && (
        <>
          {searchRow}
          {illustrations && illustrations.length === 0 && (
            <p className="muted">{query.trim() ? 'Nessuna illustrazione per questa parola. Eccone alcune:' : 'Scrivi o detta una parola, oppure scegli:'}</p>
          )}
          {busy && (
            <p className="muted" role="status">
              Preparo l’immagine…
            </p>
          )}
          <div className="picto-grid" aria-busy={busy}>
            {shownIllustrations.map((i) => (
              <IllustrationTile key={i.path} illustration={i} disabled={busy} onChoose={() => void chooseIllustration(i)} />
            ))}
          </div>
          <p className="credit">{ILLUSTRATIONS_CREDIT}</p>
        </>
      )}

      {tab === 'foto' && (
        <>
          <div className="photo-sources">
            <BigButton icon="camera" label="Scatta una foto" disabled={busy} onClick={() => void addPhoto('camera')} />
            <BigButton icon="gallery" label="Dalla galleria" disabled={busy} onClick={() => void addPhoto('gallery')} />
          </div>
          <p className="muted small">Una figura del libro, un esperimento, un disegno fatto da te.</p>

          <h3 className="photo-web-title">Da Google Immagini</h3>
          {searchRow}
          <div className="photo-sources">
            <BigButton icon="search" label="Cerca su Google" disabled={busy || !query.trim()} onClick={searchGoogle} />
            <BigButton
              icon="paste"
              label="Incolla immagine"
              variant={pasteHint ? 'primary' : 'default'}
              disabled={busy}
              onClick={() => void pasteFromClipboard()}
            />
          </div>
          {pasteHint && (
            <SpokenError className="muted small" role="status">
              Hai copiato un’immagine? Premi «Incolla immagine».
            </SpokenError>
          )}
          <Listenable text={GOOGLE_STEPS.join(' ')} label="Ascolta come fare">
            <ol className="photo-web-steps muted small">
              {GOOGLE_STEPS.map((step) => (
                <li key={step}>{step}</li>
              ))}
            </ol>
          </Listenable>
          {showPasteBox && (
            <textarea
              className="text-field paste-box"
              rows={2}
              aria-label="Riquadro dove incollare l’immagine"
              placeholder="Tieni premuto qui e scegli «Incolla»"
              autoFocus
              value=""
              onChange={() => {}}
              onPaste={(e) => {
                const pasted = fromPasteEvent(e);
                e.preventDefault();
                e.stopPropagation();
                if (pasted) void usePasted(pasted);
                else setPhotoError('Negli appunti non c’è un’immagine.');
              }}
            />
          )}
          {photoError && <SpokenError>{photoError}</SpokenError>}
          <p className="credit">Le immagini trovate su Google appartengono ai loro autori: usale solo per studiare.</p>
        </>
      )}

      <div className="dialog-actions">
        {node.image && <BigButton icon="image-off" label="Togli immagine" onClick={() => choose(undefined)} />}
        <BigButton icon="check" label="Fatto" variant="primary" onClick={close} />
      </div>
    </Dialog>
  );
}

/**
 * One word (or a few) of the name in its own colour: «governo» in red.
 * The words are picked first, then the colour; «Nero» gives them back the
 * usual one.
 */
function WordColors({ node }: { node: MapNode }) {
  const updateNode = useMapStore((s) => s.updateNode);
  const words = labelWords(node.label);
  // The words picked belong to one name: a new name starts again.
  const [picked, setPicked] = useState<{ label: string; at: number[] }>({ label: node.label, at: [] });
  const at = picked.label === node.label ? picked.at : [];
  // A one-word name: that is the word to colour.
  const chosen = words.length === 1 ? [0] : at;
  const colors = node.wordColors ?? {};
  const toggle = (i: number) => setPicked({ label: node.label, at: at.includes(i) ? at.filter((j) => j !== i) : [...at, i] });
  const paint = (color: string) => {
    const next = { ...colors };
    for (const i of chosen) {
      if (color === TEXT_COLOR) delete next[i];
      else next[i] = color;
    }
    updateNode(node.id, { wordColors: Object.keys(next).length > 0 ? next : undefined });
  };
  if (words.length === 0) return null;
  return (
    <fieldset>
      <legend>Colore delle parole</legend>
      {words.length > 1 && (
        <>
          <p className="muted small">Tocca una o più parole, poi un colore.</p>
          <div className="choice-row word-picks" role="group" aria-label="Parole del nome">
            {words.map((w, i) => (
              <button
                key={`${i}-${w.text}`}
                type="button"
                className="choice word-pick"
                style={{ background: node.color ?? DEFAULT_COLOR, color: colors[i] ?? TEXT_COLOR }}
                aria-pressed={at.includes(i)}
                onClick={() => toggle(i)}
              >
                {w.text}
              </button>
            ))}
          </div>
        </>
      )}
      <div className="choice-row">
        {[...TEXT_COLORS, TEXT_COLOR].map((c) => (
          <button
            key={c}
            type="button"
            className="color-swatch"
            style={{ background: c }}
            aria-label={`Colore della parola: ${TEXT_COLOR_NAMES[c]}`}
            title={TEXT_COLOR_NAMES[c]}
            disabled={chosen.length === 0}
            aria-pressed={chosen.length > 0 && chosen.every((i) => (colors[i] ?? TEXT_COLOR) === c)}
            onClick={() => paint(c)}
          />
        ))}
      </div>
    </fieldset>
  );
}

/** Offline the preview cannot load: the tile then shows the same subject as a symbol. */
function IllustrationTile({ illustration: i, disabled, onChoose }: { illustration: Illustration; disabled: boolean; onChoose(): void }) {
  const [failed, setFailed] = useState(false);
  return (
    <button type="button" className="picto-tile illustration-tile" aria-label={i.name} title={i.name} disabled={disabled} onClick={onChoose}>
      {failed ? (
        <span className="illustration-glyph" aria-hidden>
          {i.glyph}
        </span>
      ) : (
        <img src={illustrationThumbUrl(i.path)} alt="" loading="lazy" crossOrigin="anonymous" onError={() => setFailed(true)} />
      )}
    </button>
  );
}
