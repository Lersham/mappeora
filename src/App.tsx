import { lazy, Suspense, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { App as NativeApp } from '@capacitor/app';
import { HomeScreen } from './features/home/HomeScreen';
import { SettingsPanel } from './features/accessibility/SettingsPanel';
import { useMapStore, untracked } from './store/mapStore';
import { useSettings } from './store/settingsStore';
import { storage } from './services/storage';
import { createMap, NEW_MAP_TITLE, TUTORIAL_TITLE } from './lib/mapFactory';
import { THEME_COLOR } from './lib/themeColor';
import { NewMapDialog } from './features/home/NewMapDialog';
import type { MapTemplate } from './types/map';
import { useAutosave } from './hooks/useAutosave';
import { useReadAloud } from './hooks/useReadAloud';
import { embedMissingImages } from './services/embed';
import { flushAutosave, recovered, showMap, useSaveStatus } from './services/autosave';
import { reloadIfSafe } from './services/pwaUpdate';
import { isNative } from './services/platform';
import { backIsHandled, handleBack, installWebBack } from './lib/backButton';
import { BigButton } from './components/BigButton';
import { Dialog } from './components/Dialog';
import { ErrorBoundary } from './components/ErrorBoundary';
import { Mascot } from './components/Mascot';
import { SpeechProblemNotice } from './components/SpeechProblemNotice';
import { illustrationUrl } from './services/illustrations';
import type { ConceptMap } from './types/map';

/** The editor is the heaviest part and the list does not need it: its own file, loaded on the first map. */
const loadEditor = () => import('./features/editor/MapEditor');
const MapEditor = lazy(() => loadEditor().then((m) => ({ default: m.MapEditor })));

/** The page title the HTML came with: what the list shows. */
const LIST_TITLE = document.title;

/** What shows while the editor's file arrives (a moment, or a slow connection). */
function OpeningMap() {
  return (
    <main className="home">
      <Mascot pose="mappa" className="crash-mascot" />
      <p className="home-lead" role="status">
        Apro la mappa…
      </p>
    </main>
  );
}

/** With the list on screen and nothing to do, fetches the editor so that the first map still opens at once. */
function usePrefetchEditor() {
  useEffect(() => {
    // Someone on a limited data plan asked for less.
    if ((navigator as Navigator & { connection?: { saveData?: boolean } }).connection?.saveData) return;
    const prefetch = () => void loadEditor().catch(() => {});
    if (typeof requestIdleCallback === 'function') {
      const id = requestIdleCallback(prefetch, { timeout: 5000 });
      return () => cancelIdleCallback(id);
    }
    const id = setTimeout(prefetch, 2000);
    return () => clearTimeout(id);
  }, []);
}

/**
 * The page title says where the child is, and a screen reader hears when the
 * screen changes (the focus stays put: moving it into the editor would open
 * the keyboard on a touch screen). Not on the first screen, not on a rename.
 */
function ScreenChange() {
  const title = useMapStore((s) => (s.map ? s.map.title.trim() || 'Mappa senza titolo' : null));
  const isOpen = title !== null;
  const wasOpen = useRef(isOpen);
  const [said, setSaid] = useState('');
  useEffect(() => {
    document.title = isOpen ? `${title} – MappAmi` : LIST_TITLE;
  }, [isOpen, title]);
  useEffect(() => {
    if (wasOpen.current === isOpen) return;
    wasOpen.current = isOpen;
    setSaid(isOpen ? `Mappa aperta: ${title}` : 'Elenco delle mappe');
  }, [isOpen, title]);
  // aria-live, not role="status": the page's own notes are found by that role.
  return (
    <p className="sr-only" aria-live="polite" aria-atomic="true">
      {said}
    </p>
  );
}

/** Saves into the map the illustrations of older maps, so they work offline too. */
async function embedOldImages(map: ConceptMap) {
  const found = await embedMissingImages(map.nodes, (image) => (image.kind === 'illustrazione' ? illustrationUrl(image.ref) : undefined));
  if (found.size === 0) return;
  // Not an edit by the child: keep it out of the undo history.
  untracked(() =>
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
    ),
  );
}

/** Back online: the illustrations that could not be saved in the map yet. */
function useEmbedWhenOnline() {
  useEffect(() => {
    const retry = () => {
      const map = useMapStore.getState().map;
      if (map) void embedOldImages(map);
    };
    window.addEventListener('online', retry);
    return () => window.removeEventListener('online', retry);
  }, []);
}

/** Mirrors accessibility settings onto <html> so plain CSS can react to them. */
function useApplySettings() {
  const { font, theme, textScale, uppercase, wideSpacing } = useSettings();
  // Before the first paint: the page never shows the default look for a moment.
  useLayoutEffect(() => {
    const root = document.documentElement;
    root.dataset.font = font;
    root.dataset.theme = theme;
    root.dataset.uppercase = String(uppercase);
    root.dataset.spacing = wideSpacing ? 'wide' : 'normal';
    root.style.setProperty('--text-scale', String(textScale));
    // The browser's bar takes the colour of the page.
    document.querySelectorAll('meta[name="theme-color"]').forEach((meta) => meta.setAttribute('content', THEME_COLOR[theme]));
  }, [font, theme, textScale, uppercase, wideSpacing]);
}

export default function App() {
  useApplySettings();
  useAutosave();
  useEmbedWhenOnline();
  usePrefetchEditor();
  const hasMap = useMapStore((s) => s.map !== null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [newMapOpen, setNewMapOpen] = useState(false);
  const [homeError, setHomeError] = useState<string | null>(null);
  // The welcome's «Provalo adesso» opens the new map straight on «Dal libro».
  const [startDialog, setStartDialog] = useState<'photo' | undefined>();
  // «Impara facendo» guides the child through the new map.
  const [tutorial, setTutorial] = useState(false);
  // Set when the last changes could not be saved: leaving then needs the child's say.
  const [leaveProblem, setLeaveProblem] = useState<string | null>(null);
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
      setTutorial(false);
      // Voice notes ("Spiega") were removed: drop any left in older maps.
      const map = { ...stored, nodes: stored.nodes.map(({ audio: _audio, ...n }: typeof stored.nodes[number] & { audio?: unknown }) => n) };
      showMap(map);
      void embedOldImages(map);
    } catch {
      setHomeError('Non riesco ad aprire questa mappa. Riprova.');
    }
  };

  const create = async (title: string, template: MapTemplate, dialog?: 'photo', guided = false) => {
    setHomeError(null);
    const map = createMap(title, template);
    try {
      await storage().save(map);
    } catch {
      setNewMapOpen(false);
      setHomeError('Non riesco a creare la mappa: forse non c’è più spazio libero.');
      return;
    }
    setNewMapOpen(false);
    setStartDialog(dialog);
    setTutorial(guided);
    showMap(map);
  };

  const back = async () => {
    void stop();
    // Android's Back can leave while the title is still being typed: never an empty one.
    const open = useMapStore.getState();
    if (open.map && !open.map.title.trim()) open.setTitle(open.map.nodes[0]?.label.trim() || NEW_MAP_TITLE);
    // The list must show the latest title, and nothing may be lost unnoticed.
    if (!(await flushAutosave())) {
      const why =
        useSaveStatus.getState().problem === 'conflict'
          ? 'Questa mappa è stata cambiata in un’altra finestra e le tue ultime modifiche non sono salvate.'
          : 'Non riesco a salvare le ultime modifiche.';
      // Asked in the app's own dialog (the browser's «OK / Annulla» is hard to read and may be blocked).
      setLeaveProblem(why);
      return;
    }
    showMap(null);
  };

  // A new version of the app loads by itself only while nobody is looking:
  // on the list, the page goes out of sight (see pwaUpdate; HomeScreen has «Aggiorna»).
  useEffect(() => {
    if (hasMap) return;
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
  // The browser's Back does the same on the web.
  useEffect(() => {
    if (isNative()) return;
    return installWebBack(
      () => handleBack() || (useMapStore.getState().map ? backRef.current() : undefined),
      () => backIsHandled() || useMapStore.getState().map !== null,
      (sync) => useMapStore.subscribe(sync),
    );
  }, []);

  return (
    <ErrorBoundary
      onReset={async () => {
        // Not saved: restarting keeps the changes (pagehide puts them in the
        // slot, `recovered` saves them); the list would drop them.
        if (!(await flushAutosave())) return location.reload();
        showMap(null);
      }}
    >
      {hasMap ? (
        <Suspense fallback={<OpeningMap />}>
          <MapEditor onBack={back} onOpenSettings={() => setSettingsOpen(true)} initialDialog={startDialog} tutorial={tutorial} />
        </Suspense>
      ) : (
        <HomeScreen
          onOpen={open}
          onCreate={() => setNewMapOpen(true)}
          onStartFromBook={() => void create(NEW_MAP_TITLE, 'libera', 'photo')}
          onStartTutorial={() => void create(TUTORIAL_TITLE, 'libera', undefined, true)}
          onOpenSettings={() => setSettingsOpen(true)}
          error={homeError}
        />
      )}
      {newMapOpen && <NewMapDialog onCreate={create} onClose={() => setNewMapOpen(false)} />}
      {leaveProblem !== null && (
        <Dialog title="Tornare alle mappe?" onClose={() => setLeaveProblem(null)}>
          <p>{leaveProblem} Vuoi tornare alle mappe lo stesso? Le ultime modifiche andranno perse.</p>
          <div className="dialog-actions">
            <BigButton icon="close" label="Resta qui" variant="primary" onClick={() => setLeaveProblem(null)} />
            <BigButton
              icon="map"
              label="Torna alle mappe"
              variant="danger"
              onClick={() => {
                setLeaveProblem(null);
                showMap(null);
              }}
            />
          </div>
        </Dialog>
      )}
      {settingsOpen && <SettingsPanel onClose={() => setSettingsOpen(false)} />}
      <SpeechProblemNotice />
      <ScreenChange />
    </ErrorBoundary>
  );
}
