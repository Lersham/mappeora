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
import { Icon, type IconName } from '../../components/Icon';
import { friendlyDate } from '../../lib/friendlyDate';

/** One of the ways to start, with a line that says what it does. The line is the
 *  button's description (aria-describedby), not its name: the name stays the single word. */
function StartTile({ icon, label, hint, tone, onClick }: { icon: IconName; label: string; hint: string; tone: number; onClick(): void }) {
  const hintId = `start-${tone}`;
  return (
    <button type="button" className="start-tile" aria-label={label} aria-describedby={hintId} onClick={onClick}>
      <span className="tile-badge" style={{ '--tone': `var(--branch-${tone})` } as React.CSSProperties} aria-hidden>
        <Icon name={icon} />
      </span>
      <span className="tile-text">
        <span className="tile-label">{label}</span>
        <span className="tile-hint" id={hintId}>
          {hint}
        </span>
      </span>
      <Icon name="forward" className="tile-go" />
    </button>
  );
}

/** A soft colour and the first letter of the title, so each map is easy to spot. */
function MapAvatar({ id, title }: { id: string; title: string }) {
  let h = 0;
  for (const c of id) h = (h * 31 + c.charCodeAt(0)) % 6;
  // «Il sistema solare» → S, not I: skip the article.
  const word = title.replace(/^(?:(?:il|lo|la|le|gli|i|un|uno|una)\s+|(?:l|un)['’]\s*)/iu, '');
  const letter = (word.match(/[\p{L}\p{N}]/u)?.[0] ?? '•').toUpperCase();
  return (
    <span className="map-avatar" style={{ '--tone': `var(--branch-${h})` } as React.CSSProperties} aria-hidden>
      {letter}
    </span>
  );
}

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
    <BigButton icon="save" label={saving ? 'Salvo…' : 'Salva tutte le mappe'} disabled={saving} onClick={() => void saveAll()} />
  );

  return (
    <main className="home">
      <header className="home-header">
        <div className="home-brand">
          <img src={`${import.meta.env.BASE_URL}icon-192.png`} alt="" width="44" height="44" />
          <span>MappAmi</span>
        </div>
        <div className="home-header-tools">
          <BigButton icon="help" label="Come funziona" onClick={() => setWelcomeOpen(true)} />
          <BigButton icon="palette" label="Aspetto" onClick={onOpenSettings} />
        </div>
      </header>
      <h1 className="home-title">Le mie mappe</h1>
      <p className="home-lead">Cosa vuoi studiare oggi?</p>

      <button type="button" className="new-hero" aria-label="Nuova mappa" aria-describedby="new-hero-hint" onClick={onCreate}>
        <span className="new-hero-plus" aria-hidden>
          <Icon name="plus" />
        </span>
        <span className="tile-text">
          <span className="new-hero-label">Nuova mappa</span>
          <span className="new-hero-hint" id="new-hero-hint">
            Parti da un foglio vuoto o da un modello
          </span>
        </span>
      </button>
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
            <strong>Su iPhone e iPad</strong> aggiungi MappAmi alla schermata Home: tocca Condividi <Icon name="share" className="inline-icon" /> e poi «Aggiungi alla
            schermata Home». Così il browser non cancella le tue mappe.
          </p>
          <BigButton
            icon="check"
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
              icon="clock"
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
          Non hai ancora mappe. Creane una, oppure guarda un{' '}
          <button type="button" className="link-button" onClick={() => setExamplesOpen(true)}>
            esempio
          </button>
          .
        </p>
      )}
      {welcomeOpen && <WelcomeDialog onClose={() => setWelcomeOpen(false)} onExamples={() => setExamplesOpen(true)} onTryBook={onStartFromBook} />}
      {examplesOpen && <ExamplesDialog onOpen={onOpen} onClose={() => setExamplesOpen(false)} />}

      {maps && maps.length > 0 && (
        <h2 className="section-title" id="maps-title">
          Continua da dove eri rimasto
        </h2>
      )}
      <ul className="map-list" aria-labelledby={maps && maps.length > 0 ? 'maps-title' : undefined}>
        {maps?.map(({ title, ...m }) => ({ ...m, title: title.trim() || 'Mappa senza titolo' })).map((m, i) => (
          <li key={m.id} className={`map-card${i === 0 ? ' is-latest' : ''}`}>
            <button type="button" className="map-open" onClick={() => onOpen(m.id)}>
              <MapAvatar id={m.id} title={m.title} />
              <span className="map-text">
                <span className="map-title">{m.title}</span>
                <time className="map-date" dateTime={new Date(m.updatedAt).toISOString()}>
                  {friendlyDate(m.updatedAt)}
                </time>
              </span>
            </button>
            <button type="button" className="icon-button" aria-label={`Leggi il titolo ${m.title}`} onClick={() => void readText(m.title)}>
              <Icon name="speak" />
            </button>
            <button type="button" className="icon-button danger-hover" aria-label={`Cancella ${m.title}`} onClick={() => void remove(m)}>
              <Icon name="trash" />
            </button>
          </li>
        ))}
      </ul>

      <h2 className="section-title" id="start-title">
        Altri modi per iniziare
      </h2>
      <div className="start-grid" role="group" aria-labelledby="start-title">
        <StartTile icon="camera" tone={0} label="Dal libro" hint="Fotografa una pagina: il testo diventa mappa" onClick={onStartFromBook} />
        <StartTile icon="graduation" tone={3} label="Impara facendo" hint="Costruisci la tua prima mappa, passo passo" onClick={onStartTutorial} />
        <StartTile icon="book" tone={2} label="Esempi" hint="Mappe già pronte da guardare e provare" onClick={() => setExamplesOpen(true)} />
        <StartTile icon="folder" tone={1} label="Apri file" hint="Riprendi una mappa o una copia di sicurezza" onClick={() => void importFile()} />
      </div>

      {maps && maps.length > 0 && !remind && (
        <section className="backup-card" aria-label="Copia di sicurezza">
          <p className="muted">Le mappe sono solo su questo dispositivo. Ogni tanto salvane una copia (su Drive, sul computer): con «Apri file» le ritrovi tutte.</p>
          {saveAllButton}
        </section>
      )}

      <footer className="home-footer">
        <a href={`${import.meta.env.BASE_URL}privacy.html`}>
          <Icon name="lock" className="inline-icon" /> Privacy
        </a>
        <a href={`${import.meta.env.BASE_URL}crediti.html`}>Crediti</a>
      </footer>
    </main>
  );
}
