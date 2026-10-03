import { useEffect, useState } from 'react';
import { HomeScreen } from './features/home/HomeScreen';
import { MapEditor } from './features/editor/MapEditor';
import { SettingsPanel } from './features/accessibility/SettingsPanel';
import { useMapStore, mapHistory } from './store/mapStore';
import { useSettings } from './store/settingsStore';
import { storage } from './services/storage';
import { createEmptyMap } from './lib/mapFactory';
import { useAutosave } from './hooks/useAutosave';
import { useReadAloud } from './hooks/useReadAloud';

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
  const { stop } = useReadAloud();

  const open = async (id: string) => {
    const map = await storage().get(id);
    if (!map) return;
    useMapStore.getState().load(map);
    mapHistory().clear();
  };

  const create = async () => {
    const map = createEmptyMap();
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
        <HomeScreen onOpen={open} onCreate={create} onOpenSettings={() => setSettingsOpen(true)} />
      )}
      {settingsOpen && <SettingsPanel onClose={() => setSettingsOpen(false)} />}
    </>
  );
}
