import { useEffect, useState } from 'react';
import { Dialog } from '../../components/Dialog';
import { MicButton } from '../../components/MicButton';
import { BigButton } from '../../components/BigButton';
import { ARASAAC_CREDIT, pictogramUrl, searchPictograms, type Pictogram } from '../../services/pictograms';
import {
  ILLUSTRATIONS_CREDIT,
  illustrationThumbUrl,
  illustrationUrl,
  illustrationsFor,
  searchIllustrations,
  type Illustration,
} from '../../services/illustrations';
import { toDataUrl } from '../../services/embed';
import { NODE_COLORS } from '../../lib/palette';
import { useMapStore } from '../../store/mapStore';
import { photoToDataUrl, pickPhoto, type PhotoSource } from '../../services/photo';
import { PasteError, fromPasteEvent, openGoogleImages, pastedToDataUrl, readClipboardImage } from '../../services/webImage';
import type { MapNode, NodeShape } from '../../types/map';

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

type Tab = 'illustrazioni' | 'simboli' | 'foto';

const TABS: { value: Tab; label: string }[] = [
  { value: 'illustrazioni', label: '✨ Illustrazioni' },
  { value: 'simboli', label: '🧩 Simboli CAA' },
  { value: 'foto', label: '📷 Foto e Google' },
];

/** Children who use ARASAAC symbols at school keep finding them first. */
const initialTab = (node: MapNode): Tab => (node.image?.kind === 'arasaac' ? 'simboli' : 'illustrazioni');

export function NodeStyleDialog({ node, onClose }: { node: MapNode; onClose(): void }) {
  const updateNode = useMapStore((s) => s.updateNode);
  const [tab, setTab] = useState<Tab>(() => initialTab(node));
  const [query, setQuery] = useState(node.label);
  const [symbols, setSymbols] = useState<Pictogram[] | null>(null);
  const [illustrations, setIllustrations] = useState<Illustration[] | null>(null);
  const [suggested, setSuggested] = useState<Illustration[]>([]);
  const [offline, setOffline] = useState(false);
  const [busy, setBusy] = useState(false);
  const [photoError, setPhotoError] = useState<string | null>(null);
  const [showPasteBox, setShowPasteBox] = useState(false);

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

  // ARASAAC: debounced web search; aborts the previous one while typing.
  useEffect(() => {
    if (tab !== 'simboli') return;
    const ctrl = new AbortController();
    const timer = setTimeout(() => {
      searchPictograms(query, ctrl.signal)
        .then((r) => {
          setSymbols(r);
          setOffline(false);
        })
        .catch((e: unknown) => {
          if ((e as Error).name !== 'AbortError') setOffline(true);
        });
    }, 350);
    return () => {
      clearTimeout(timer);
      ctrl.abort();
    };
  }, [query, tab]);

  const choose = (image: MapNode['image']) => {
    updateNode(node.id, { image });
    onClose();
  };

  /** Saves the picture inside the map, so it shows offline and in shared files. */
  const chooseEmbedded = async (image: NonNullable<MapNode['image']>, url: string) => {
    setBusy(true);
    const src = await toDataUrl(url);
    choose(src ? { ...image, src } : image);
  };

  const addPhoto = async (source: PhotoSource) => {
    const photo = await pickPhoto(source);
    if (!photo) return;
    setBusy(true);
    try {
      choose({ kind: 'foto', ref: await photoToDataUrl(photo.webPath) });
    } catch {
      setBusy(false);
      setPhotoError('Non riesco a usare questa foto. Prova con un’altra.');
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

  return (
    <Dialog title="Immagine e colore" onClose={onClose} className="style-dialog">
      <div className="choice-row" role="tablist">
        {TABS.map((t) => (
          <button key={t.value} type="button" role="tab" className="choice" aria-selected={tab === t.value} onClick={() => setTab(t.value)}>
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
          <div className="picto-grid" aria-busy={busy}>
            {shownIllustrations.map((i) => (
              <button
                key={i.path}
                type="button"
                className="picto-tile illustration-tile"
                aria-label={i.name}
                title={i.name}
                disabled={busy}
                onClick={() => void chooseEmbedded({ kind: 'illustrazione', ref: i.path }, illustrationUrl(i.path))}
              >
                <img src={illustrationThumbUrl(i.path)} alt="" loading="lazy" />
              </button>
            ))}
          </div>
          <p className="credit">{ILLUSTRATIONS_CREDIT}</p>
        </>
      )}

      {tab === 'simboli' && (
        <>
          {searchRow}
          {offline && <p className="field-error">Serve internet per cercare nuovi simboli.</p>}
          {symbols && symbols.length === 0 && !offline && <p className="muted">Nessun simbolo. Prova con un'altra parola.</p>}
          <div className="picto-grid" aria-busy={busy}>
            {symbols?.map((p) => (
              <button
                key={p.id}
                type="button"
                className="picto-tile"
                aria-label={p.keyword}
                title={p.keyword}
                disabled={busy}
                onClick={() => void chooseEmbedded({ kind: 'arasaac', ref: p.id }, pictogramUrl(p.id))}
              >
                <img src={pictogramUrl(p.id)} alt="" loading="lazy" crossOrigin="anonymous" />
              </button>
            ))}
          </div>
          <p className="credit">{ARASAAC_CREDIT}</p>
        </>
      )}

      {tab === 'foto' && (
        <>
          <div className="photo-sources">
            <BigButton icon="📸" label="Scatta una foto" disabled={busy} onClick={() => void addPhoto('camera')} />
            <BigButton icon="🖼️" label="Dalla galleria" disabled={busy} onClick={() => void addPhoto('gallery')} />
          </div>
          <p className="muted small">Una figura del libro, un esperimento, un disegno fatto da te.</p>

          <h3 className="photo-web-title">Da Google Immagini</h3>
          {searchRow}
          <div className="photo-sources">
            <BigButton icon="🔎" label="Cerca su Google" disabled={busy || !query.trim()} onClick={() => openGoogleImages(query)} />
            <BigButton icon="📋" label="Incolla immagine" disabled={busy} onClick={() => void pasteFromClipboard()} />
          </div>
          <ol className="photo-web-steps muted small">
            <li>Premi «Cerca su Google»: si apre Google Immagini con il filtro per ragazzi.</li>
            <li>Tieni premuta l’immagine che ti piace e scegli «Copia immagine».</li>
            <li>Torna qui e premi «Incolla immagine».</li>
          </ol>
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
          {photoError && (
            <p className="field-error" role="alert">
              {photoError}
            </p>
          )}
          <p className="credit">Le immagini trovate su Google appartengono ai loro autori: usale solo per studiare.</p>
        </>
      )}

      <fieldset>
        <legend>Colore</legend>
        <div className="choice-row">
          {[...NODE_COLORS, '#ffffff'].map((c) => (
            <button
              key={c}
              type="button"
              className="color-swatch"
              style={{ background: c }}
              aria-label={`Colore ${c}`}
              aria-pressed={node.color === c}
              onClick={() => updateNode(node.id, { color: c })}
            />
          ))}
        </div>
      </fieldset>

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

      <div className="dialog-actions">
        {node.image && <BigButton icon="🚫" label="Togli immagine" onClick={() => choose(undefined)} />}
        <BigButton icon="✅" label="Fatto" variant="primary" onClick={onClose} />
      </div>
    </Dialog>
  );
}
