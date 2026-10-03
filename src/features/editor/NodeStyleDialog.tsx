import { useEffect, useState } from 'react';
import { Dialog } from '../../components/Dialog';
import { MicButton } from '../../components/MicButton';
import { BigButton } from '../../components/BigButton';
import { ARASAAC_CREDIT, pictogramUrl, searchPictograms, type Pictogram } from '../../services/pictograms';
import { NODE_COLORS } from '../../lib/palette';
import { useMapStore } from '../../store/mapStore';
import { photoToDataUrl, pickPhoto, type PhotoSource } from '../../services/photo';
import type { MapNode, NodeShape } from '../../types/map';

const EMOJI = [
  '💧', '🔥', '🌍', '☀️', '🌙', '⭐', '🌱', '🌳', '🌸', '🍎',
  '🐶', '🐟', '🐦', '🦋', '🐞', '🧠', '❤️', '🫁', '🦴', '👀',
  '👤', '👨‍👩‍👧', '🏠', '🏰', '⛪', '🏛️', '🗺️', '⛰️', '🌊', '🏙️',
  '⚔️', '👑', '📜', '📅', '⏳', '🔢', '➕', '📏', '🔬', '⚡',
  '🚗', '🚂', '✈️', '⛵', '🎵', '🎨', '📚', '✏️', '💡', '❓',
];

const SHAPES: { value: NodeShape; label: string }[] = [
  { value: 'rettangolo', label: 'Rettangolo' },
  { value: 'ellisse', label: 'Ovale' },
  { value: 'nuvola', label: 'Nuvola' },
];

type Tab = 'pittogrammi' | 'emoji' | 'foto';

export function NodeStyleDialog({ node, onClose }: { node: MapNode; onClose(): void }) {
  const updateNode = useMapStore((s) => s.updateNode);
  const [tab, setTab] = useState<Tab>('pittogrammi');
  const [query, setQuery] = useState(node.label);
  const [results, setResults] = useState<Pictogram[] | null>(null);
  const [offline, setOffline] = useState(false);
  const [photoState, setPhotoState] = useState<'idle' | 'busy' | 'error'>('idle');

  // Debounced search; aborts the previous request while the child types.
  useEffect(() => {
    if (tab !== 'pittogrammi') return;
    const ctrl = new AbortController();
    const timer = setTimeout(() => {
      searchPictograms(query, ctrl.signal)
        .then((r) => {
          setResults(r);
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

  const addPhoto = async (source: PhotoSource) => {
    const photo = await pickPhoto(source);
    if (!photo) return;
    setPhotoState('busy');
    try {
      choose({ kind: 'foto', ref: await photoToDataUrl(photo.webPath) });
    } catch {
      setPhotoState('error');
    }
  };

  return (
    <Dialog title="Immagine e colore" onClose={onClose} className="style-dialog">
      <div className="choice-row" role="tablist">
        <button type="button" role="tab" className="choice" aria-selected={tab === 'pittogrammi'} aria-pressed={tab === 'pittogrammi'} onClick={() => setTab('pittogrammi')}>
          🖼️ Pittogrammi
        </button>
        <button type="button" role="tab" className="choice" aria-selected={tab === 'emoji'} aria-pressed={tab === 'emoji'} onClick={() => setTab('emoji')}>
          😀 Emoji
        </button>
        <button type="button" role="tab" className="choice" aria-selected={tab === 'foto'} aria-pressed={tab === 'foto'} onClick={() => setTab('foto')}>
          📷 Foto
        </button>
      </div>

      {tab === 'pittogrammi' ? (
        <>
          <div className="search-row">
            <input
              type="search"
              className="text-field"
              value={query}
              placeholder="Cerca un'immagine…"
              aria-label="Cerca un pittogramma"
              onChange={(e) => setQuery(e.target.value)}
            />
            <MicButton onText={setQuery} label="Cerca con la voce" />
          </div>
          {offline && <p className="field-error">Serve internet per cercare nuovi pittogrammi.</p>}
          {results && results.length === 0 && !offline && <p className="muted">Nessuna immagine. Prova con un'altra parola.</p>}
          <div className="picto-grid">
            {results?.map((p) => (
              <button key={p.id} type="button" className="picto-tile" aria-label={p.keyword} onClick={() => choose({ kind: 'arasaac', ref: p.id })}>
                <img src={pictogramUrl(p.id)} alt="" loading="lazy" crossOrigin="anonymous" />
              </button>
            ))}
          </div>
          <p className="credit">{ARASAAC_CREDIT}</p>
        </>
      ) : tab === 'foto' ? (
        <div className="photo-sources">
          <BigButton icon="📸" label="Scatta una foto" disabled={photoState === 'busy'} onClick={() => void addPhoto('camera')} />
          <BigButton icon="🖼️" label="Dalla galleria" disabled={photoState === 'busy'} onClick={() => void addPhoto('gallery')} />
          {photoState === 'error' && <p className="field-error">Non riesco a usare questa foto. Prova con un’altra.</p>}
          <p className="muted small">Una figura del libro, un esperimento, un disegno fatto da te.</p>
        </div>
      ) : (
        <div className="emoji-grid">
          {EMOJI.map((e) => (
            <button key={e} type="button" className="emoji-tile" onClick={() => choose({ kind: 'emoji', ref: e })}>
              {e}
            </button>
          ))}
        </div>
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
