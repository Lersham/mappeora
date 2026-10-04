import { useEffect, useState } from 'react';
import type { MapSummary } from '../../types/map';
import { storage } from '../../services/storage';
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
  onOpenSettings(): void;
}

export function HomeScreen({ onOpen, onCreate, onStartFromBook, onOpenSettings }: Props) {
  const [maps, setMaps] = useState<MapSummary[] | null>(null);
  const [importError, setImportError] = useState<string | null>(null);
  const [examplesOpen, setExamplesOpen] = useState(false);
  const [welcomeOpen, setWelcomeOpen] = useState(welcomeNeeded);
  const { readText } = useReadAloud();

  const refresh = () => void storage().list().then(setMaps);
  useEffect(refresh, []);

  const remove = async (m: MapSummary) => {
    if (!window.confirm(`Vuoi cancellare la mappa "${m.title}"?`)) return;
    await storage().remove(m.id);
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
        <h1>Le mie mappe</h1>
        <div className="home-header-tools">
          <BigButton icon="❓" label="Come funziona" onClick={() => setWelcomeOpen(true)} />
          <BigButton icon="🎨" label="Aspetto" onClick={onOpenSettings} />
        </div>
      </header>

      <div className="home-actions">
        <BigButton icon="➕" label="Nuova mappa" variant="primary" className="home-new" onClick={onCreate} />
        <BigButton icon="📂" label="Apri file" className="home-new" onClick={() => void importFile()} />
        <BigButton icon="📚" label="Esempi" className="home-new" onClick={() => setExamplesOpen(true)} />
      </div>
      {importError && (
        <p className="field-error" role="alert">
          {importError}
        </p>
      )}

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
        {maps?.map((m) => (
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
    </main>
  );
}
