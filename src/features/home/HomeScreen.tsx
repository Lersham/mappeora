import { useEffect, useState } from 'react';
import type { MapSummary } from '../../types/map';
import { storage } from '../../services/storage';
import { recovered } from '../../services/autosave';
import { BigButton } from '../../components/BigButton';
import { useReadAloud } from '../../hooks/useReadAloud';
import { pickMapFile } from '../../services/openFile';
import { MapFileError, parseMapFile } from '../../lib/mapFile';
import { ExamplesDialog } from './ExamplesDialog';
import { WelcomeDialog, welcomeNeeded } from './WelcomeDialog';

interface Props {
  onOpen(id: string): void;
  onCreate(): void;
  /** A new map that opens on «Dal libro», from the welcome. */
  onStartFromBook(): void;
  /** A new map with the step-by-step guide («Impara facendo»). */
  onStartTutorial(): void;
  onOpenSettings(): void;
  /** Something that went wrong opening or creating a map. */
  error?: string | null;
}

export function HomeScreen({ onOpen, onCreate, onStartFromBook, onStartTutorial, onOpenSettings, error }: Props) {
  const [maps, setMaps] = useState<MapSummary[] | null>(null);
  const [importError, setImportError] = useState<string | null>(null);
  const [examplesOpen, setExamplesOpen] = useState(false);
  const [welcomeOpen, setWelcomeOpen] = useState(welcomeNeeded);
  const { readText } = useReadAloud();

  const [listError, setListError] = useState<string | null>(null);
  const refresh = () =>
    void recovered()
      .then(() => storage().list())
      .then((list) => {
        setMaps(list);
        setListError(null);
      })
      .catch(() => setListError('Non riesco a leggere le mappe salvate. Chiudi l’app e riaprila.'));
  useEffect(refresh, []);

  const remove = async (m: MapSummary) => {
    if (!window.confirm(`Vuoi cancellare la mappa "${m.title}"?`)) return;
    try {
      await storage().remove(m.id);
    } catch {
      setListError(`Non sono riuscito a cancellare "${m.title}". Riprova.`);
      return;
    }
    refresh();
  };

  const importFile = async () => {
    setImportError(null);
    const text = await pickMapFile();
    if (text === null) return;
    try {
      const map = parseMapFile(text);
      await storage().save(map);
      onOpen(map.id);
    } catch (e) {
      setImportError(e instanceof MapFileError ? e.message : 'Non riesco ad aprire questo file.');
    }
  };

  return (
    <main className="home">
      <header className="home-header">
        <div className="home-brand">
          <img src={`${import.meta.env.BASE_URL}icon.svg`} alt="" width="44" height="44" />
          <span>Mappeora</span>
        </div>
        <div className="home-header-tools">
          <BigButton icon="❓" label="Come funziona" onClick={() => setWelcomeOpen(true)} />
          <BigButton icon="🎨" label="Aspetto" onClick={onOpenSettings} />
        </div>
      </header>
      <h1 className="home-title">Le mie mappe</h1>

      <div className="home-actions">
        <BigButton icon="➕" label="Nuova mappa" variant="primary" className="home-new" onClick={onCreate} />
        <BigButton icon="📂" label="Apri file" className="home-new" onClick={() => void importFile()} />
        <BigButton icon="📚" label="Esempi" className="home-new" onClick={() => setExamplesOpen(true)} />
        <BigButton
          icon="🎓"
          label="Impara facendo"
          title="Costruisci la tua prima mappa passo passo, con una guida"
          className="home-new"
          onClick={onStartTutorial}
        />
      </div>
      {[error, importError, listError].filter(Boolean).map((message) => (
        <p key={message} className="field-error" role="alert">
          {message}
        </p>
      ))}

      {maps && maps.length === 0 && (
        <p className="empty">
          Non hai ancora mappe. Creane una, oppure apri un{' '}
          <button type="button" className="link-button" onClick={() => setExamplesOpen(true)}>
            esempio
          </button>
          .
        </p>
      )}
      {welcomeOpen && <WelcomeDialog onClose={() => setWelcomeOpen(false)} onExamples={() => setExamplesOpen(true)} onTryBook={onStartFromBook} />}
      {examplesOpen && <ExamplesDialog onOpen={onOpen} onClose={() => setExamplesOpen(false)} />}

      <ul className="map-list">
        {maps?.map(({ title, ...m }) => ({ ...m, title: title.trim() || 'Mappa senza titolo' })).map((m) => (
          <li key={m.id} className="map-card">
            <button type="button" className="map-open" onClick={() => onOpen(m.id)}>
              <span className="map-title">{m.title}</span>
              <span className="map-date">{new Date(m.updatedAt).toLocaleDateString('it-IT')}</span>
            </button>
            <button type="button" className="icon-button" aria-label={`Leggi il titolo ${m.title}`} onClick={() => void readText(m.title)}>
              🔊
            </button>
            <button type="button" className="icon-button" aria-label={`Cancella ${m.title}`} onClick={() => void remove(m)}>
              🗑️
            </button>
          </li>
        ))}
      </ul>

      <footer className="home-footer">
        <a href={`${import.meta.env.BASE_URL}privacy.html`}>🔒 Privacy</a>
      </footer>
    </main>
  );
}
