import { useEffect, useState } from 'react';
import { HomeScreen } from './features/home/HomeScreen';
import { MapEditor } from './features/editor/MapEditor';
import { SettingsPanel } from './features/accessibility/SettingsPanel';
import { useMapStore, mapHistory } from './store/mapStore';
import { useSettings } from './store/settingsStore';
import { storage } from './services/storage';
import { createMap } from './lib/mapFactory';
import { NewMapDialog } from './features/home/NewMapDialog';
import type { MapTemplate } from './types/map';
import { useAutosave } from './hooks/useAutosave';
import { useReadAloud } from './hooks/useReadAloud';
import { embedMissingImages } from './services/embed';
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
  const { stop } = useReadAloud();

  const open = async (id: string) => {
    const stored = await storage().get(id);
    if (!stored) return;
    // Voice notes ("Spiega") were removed: drop any left in older maps.
    const map = { ...stored, nodes: stored.nodes.map(({ audio: _audio, ...n }: typeof stored.nodes[number] & { audio?: unknown }) => n) };
    useMapStore.getState().load(map);
    mapHistory().clear();
    void embedOldImages(map);
  };

  const create = async (title: string, template: MapTemplate) => {
    setNewMapOpen(false);
    const map = createMap(title, template);
    await storage().save(map);
    useMapStore.getState().load(map);
    mapHistory().clear();
  };

  const back = async () => {
    void stop();
    // Save now so the list shows the latest title (autosave is debounced).
    const current = useMapStore.getState().map;
    if (current) await storage().save(current);
    useMapStore.getState().load(null);
    mapHistory().clear();
  };

  return (
    <>
      {hasMap ? (
        <MapEditor onBack={back} onOpenSettings={() => setSettingsOpen(true)} />
      ) : (
        <HomeScreen onOpen={open} onCreate={() => setNewMapOpen(true)} onOpenSettings={() => setSettingsOpen(true)} />
      )}
      {newMapOpen && <NewMapDialog onCreate={create} onClose={() => setNewMapOpen(false)} />}
      {settingsOpen && <SettingsPanel onClose={() => setSettingsOpen(false)} />}
    </>
  );
}
