import { useEffect, useState } from 'react';
import type { MapSummary } from '../../types/map';
import { storage } from '../../services/storage';
import { BigButton } from '../../components/BigButton';
import { useReadAloud } from '../../hooks/useReadAloud';

interface Props {
  onOpen(id: string): void;
  onCreate(): void;
  onOpenSettings(): void;
}

export function HomeScreen({ onOpen, onCreate, onOpenSettings }: Props) {
  const [maps, setMaps] = useState<MapSummary[] | null>(null);
  const { readText } = useReadAloud();

  const refresh = () => void storage().list().then(setMaps);
  useEffect(refresh, []);

  const remove = async (m: MapSummary) => {
    if (!window.confirm(`Vuoi cancellare la mappa "${m.title}"?`)) return;
    await storage().remove(m.id);
    refresh();
  };

  return (
    <main className="home">
      <header className="home-header">
        <h1>Le mie mappe</h1>
        <BigButton icon="🎨" label="Aspetto" onClick={onOpenSettings} />
      </header>

      <BigButton icon="➕" label="Nuova mappa" variant="primary" className="home-new" onClick={onCreate} />

      {maps && maps.length === 0 && <p className="empty">Non hai ancora mappe. Creane una!</p>}

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
