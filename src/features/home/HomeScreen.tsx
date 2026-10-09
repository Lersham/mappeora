import { useEffect, useState } from 'react';
import type { MapSummary } from '../../types/map';
import { storage } from '../../services/storage';
import { recovered } from '../../services/autosave';
import { BigButton } from '../../components/BigButton';
import { useReadAloud } from '../../hooks/useReadAloud';
import { pickMapFile } from '../../services/openFile';
import { MapFileError, parseAnyMapFile } from '../../lib/mapFile';
import { backupDue, homeScreenHintNeeded, homeScreenHintSeen, restoreMaps, saveAllMaps, snoozeBackup } from '../../services/backup';
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
  /** What «Salva tutte le mappe» or a safety copy just did. */
  const [backupNote, setBackupNote] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [remind, setRemind] = useState(false);
  const [homeHint, setHomeHint] = useState(homeScreenHintNeeded);
  const refresh = () =>
    void recovered()
      .then(() => storage().list())
      .then((list) => {
        setMaps(list);
        setRemind(backupDue(list));
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
    let text: string | null;
    try {
      text = await pickMapFile();
    } catch {
      return setImportError('Non riesco a leggere questo file. Se è su Drive o in una chat, scaricalo prima sul dispositivo.');
    }
    if (text === null) return;
    try {
      const { archive, maps: found } = parseAnyMapFile(text);
      if (!archive) {
        await storage().save(found[0]);
        return onOpen(found[0].id);
      }
      const { added, already } = await restoreMaps(found);
      setBackupNote(
        `${added === 1 ? 'Ho ritrovato 1 mappa' : `Ho ritrovato ${added} mappe`}${already ? ` (${already === 1 ? '1 c’era già' : `${already} c’erano già`})` : ''}.`,
      );
      refresh();
    } catch (e) {
      setImportError(e instanceof MapFileError ? e.message : 'Non riesco ad aprire questo file.');
    }
  };

  const saveAll = async () => {
    setSaving(true);
    setBackupNote(null);
    try {
      const n = await saveAllMaps();
      setRemind(false);
      setBackupNote(`${n === 1 ? 'Ho salvato 1 mappa' : `Ho salvato ${n} mappe`} in un file. Tienilo al sicuro: con «Apri file» le ritrovi tutte.`);
    } catch (e) {
      if (!(e instanceof Error && /cancel/i.test(e.message))) setListError('Non sono riuscito a salvare le mappe. Riprova.');
    } finally {
      setSaving(false);
    }
  };

  const saveAllButton = (
    <BigButton icon="💾" label={saving ? 'Salvo…' : 'Salva tutte le mappe'} disabled={saving} onClick={() => void saveAll()} />
  );

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
      {backupNote && (
        <p className="backup-note" role="status">
          {backupNote}
        </p>
      )}

      {homeHint && (
        <section className="home-notice" aria-label="Consiglio per iPhone e iPad">
          <p>
            <strong>Su iPhone e iPad</strong> aggiungi Mappeora alla schermata Home: tocca Condividi <span aria-hidden>⬆️</span> e poi «Aggiungi alla
            schermata Home». Così il browser non cancella le tue mappe.
          </p>
          <BigButton
            icon="👍"
            label="Ho capito"
            onClick={() => {
              homeScreenHintSeen();
              setHomeHint(false);
            }}
          />
        </section>
      )}
      {remind && maps && maps.length > 0 && (
        <section className="home-notice" aria-label="Copia di sicurezza">
          <p>
            <strong>Fai una copia delle tue mappe.</strong> Sono solo su questo dispositivo: se si rompe o si cancellano i dati, si perdono.
          </p>
          <div className="home-notice-actions">
            {saveAllButton}
            <BigButton
              icon="⏰"
              label="Più tardi"
              onClick={() => {
                snoozeBackup();
                setRemind(false);
              }}
            />
          </div>
        </section>
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

      {maps && maps.length > 0 && !remind && (
        <section className="backup-card" aria-label="Copia di sicurezza">
          <p className="muted">Le mappe sono solo su questo dispositivo. Ogni tanto salvane una copia (su Drive, sul computer): con «Apri file» le ritrovi tutte.</p>
          {saveAllButton}
        </section>
      )}

      <footer className="home-footer">
        <a href={`${import.meta.env.BASE_URL}privacy.html`}>🔒 Privacy</a>
      </footer>
    </main>
  );
}
