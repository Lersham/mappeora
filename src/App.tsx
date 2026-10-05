import { useEffect, useRef, useState } from 'react';
import { App as NativeApp } from '@capacitor/app';
import { HomeScreen } from './features/home/HomeScreen';
import { MapEditor } from './features/editor/MapEditor';
import { SettingsPanel } from './features/accessibility/SettingsPanel';
import { useMapStore, mapHistory } from './store/mapStore';
import { useSettings } from './store/settingsStore';
import { storage } from './services/storage';
import { createMap, NEW_MAP_TITLE } from './lib/mapFactory';
import { NewMapDialog } from './features/home/NewMapDialog';
import type { MapTemplate } from './types/map';
import { useAutosave } from './hooks/useAutosave';
import { useReadAloud } from './hooks/useReadAloud';
import { embedMissingImages } from './services/embed';
import { flushAutosave, recovered, showMap, useSaveStatus } from './services/autosave';
import { reloadIfSafe } from './services/pwaUpdate';
import { isNative } from './services/platform';
import { handleBack } from './lib/backButton';
import { ErrorBoundary } from './components/ErrorBoundary';
import { illustrationUrl } from './services/illustrations';
import type { ConceptMap } from './types/map';

/** Saves into the map the illustrations of older maps, so they work offline too. */
async function embedOldImages(map: ConceptMap) {
  const found = await embedMissingImages(map.nodes, (image) => (image.kind === 'illustrazione' ? illustrationUrl(image.ref) : undefined));
  if (found.size === 0) return;
  // Not an edit by the child: keep it out of the undo history.
  mapHistory().pause();
  useMapStore.setState((s) =>
    s.map?.id !== map.id
      ? {}
      : {
          map: {
            ...s.map,
            nodes: s.map.nodes.map((n) => {
              const f = found.get(n.id);
              return f && n.image && !n.image.src && n.image.ref === f.ref ? { ...n, image: { ...n.image, src: f.src } } : n;
            }),
          },
        },
  );
  mapHistory().resume();
}

/** Mirrors accessibility settings onto <html> so plain CSS can react to them. */
function useApplySettings() {
  const { font, theme, textScale, uppercase, wideSpacing } = useSettings();
  useEffect(() => {
    const root = document.documentElement;
    root.dataset.font = font;
    root.dataset.theme = theme;
    root.dataset.uppercase = String(uppercase);
    root.dataset.spacing = wideSpacing ? 'wide' : 'normal';
    root.style.setProperty('--text-scale', String(textScale));
  }, [font, theme, textScale, uppercase, wideSpacing]);
}

export default function App() {
  useApplySettings();
  useAutosave();
  const hasMap = useMapStore((s) => s.map !== null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [newMapOpen, setNewMapOpen] = useState(false);
  const [homeError, setHomeError] = useState<string | null>(null);
  // The welcome's «Provalo adesso» opens the new map straight on «Dal libro».
  const [startDialog, setStartDialog] = useState<'photo' | undefined>();
  const { stop } = useReadAloud();

  const open = async (id: string) => {
    setHomeError(null);
    try {
      await recovered();
      const stored = await storage().get(id);
      if (!stored) {
        setHomeError('Non trovo più questa mappa.');
        return;
      }
      setStartDialog(undefined);
      // Voice notes ("Spiega") were removed: drop any left in older maps.
      const map = { ...stored, nodes: stored.nodes.map(({ audio: _audio, ...n }: typeof stored.nodes[number] & { audio?: unknown }) => n) };
      showMap(map);
      void embedOldImages(map);
    } catch {
      setHomeError('Non riesco ad aprire questa mappa. Riprova.');
    }
  };

  const create = async (title: string, template: MapTemplate, dialog?: 'photo') => {
    setHomeError(null);
    const map = createMap(title, template);
    try {
      await storage().save(map);
    } catch {
      setNewMapOpen(false);
      setHomeError('Non riesco a creare la mappa: forse lo spazio sul dispositivo è pieno.');
      return;
    }
    setNewMapOpen(false);
    setStartDialog(dialog);
    showMap(map);
  };

  const back = async () => {
    void stop();
    // The list must show the latest title, and nothing may be lost unnoticed.
    if (!(await flushAutosave())) {
      const why =
        useSaveStatus.getState().problem === 'conflict'
          ? 'Questa mappa è stata cambiata in un’altra finestra e le tue ultime modifiche non sono salvate.'
          : 'Non riesco a salvare le ultime modifiche.';
      if (!window.confirm(`${why} Vuoi tornare alle mappe lo stesso? Le ultime modifiche andranno perse.`)) return;
    }
    showMap(null);
  };

  // A new version of the app waits for the list of maps (see pwaUpdate).
  useEffect(() => {
    if (hasMap) return;
    reloadIfSafe();
    const onHide = () => document.visibilityState === 'hidden' && reloadIfSafe();
    document.addEventListener('visibilitychange', onHide);
    return () => document.removeEventListener('visibilitychange', onHide);
  }, [hasMap]);

  // Android's Back: closes the newest dialog, then leaves the map, then
  // puts the app in the background (like Home, keeping it as it was).
  const backRef = useRef(back);
  backRef.current = back;
  useEffect(() => {
    if (!isNative()) return;
    const listener = NativeApp.addListener('backButton', () => {
      if (handleBack()) return;
      if (useMapStore.getState().map) void backRef.current();
      else void NativeApp.minimizeApp();
    });
    return () => void listener.then((l) => l.remove());
  }, []);

  return (
    <ErrorBoundary
      onReset={async () => {
        await flushAutosave();
        showMap(null);
      }}
    >
      {hasMap ? (
        <MapEditor onBack={back} onOpenSettings={() => setSettingsOpen(true)} initialDialog={startDialog} />
      ) : (
        <HomeScreen
          onOpen={open}
          onCreate={() => setNewMapOpen(true)}
          onStartFromBook={() => void create(NEW_MAP_TITLE, 'libera', 'photo')}
          onOpenSettings={() => setSettingsOpen(true)}
          error={homeError}
        />
      )}
      {newMapOpen && <NewMapDialog onCreate={create} onClose={() => setNewMapOpen(false)} />}
      {settingsOpen && <SettingsPanel onClose={() => setSettingsOpen(false)} />}
    </ErrorBoundary>
  );
}
