import { create } from 'zustand';
import { useMapStore } from '../store/mapStore';
import { flushAutosave } from './autosave';

/**
 * `ready`: a new version is installed and waiting, so «Aggiorna» shows on the
 * list and in the map. `later`: the child chose «Dopo» in the map, so it stays
 * quiet there until the next time the app starts.
 */
export const useUpdateReady = create<{ ready: boolean; later: boolean }>(() => ({ ready: false, later: false }));

/** A new version is installed. Never reload on the spot: the child may be in a map or a dialog. */
export function updateReady() {
  useUpdateReady.setState({ ready: true });
}

/**
 * Called when the page goes out of sight: nobody is looking, so the new
 * version loads invisibly, unless a map or a dialog is open.
 */
export function reloadIfSafe() {
  if (!useUpdateReady.getState().ready || useMapStore.getState().map || document.querySelector('[role="dialog"]')) return;
  useUpdateReady.setState({ ready: false });
  window.location.reload();
}

let registration: ServiceWorkerRegistration | undefined;

/** Kept so that «Cerca aggiornamenti» can ask for a new version at once. */
export function rememberRegistration(r: ServiceWorkerRegistration) {
  registration = r;
}

/** `downloading`: a new version was found but is still on its way; «Aggiorna» shows when it is ready. */
export type UpdateCheck = 'ready' | 'latest' | 'downloading' | 'offline' | 'unavailable';

/** Asks the server whether there is a newer version, and waits a little for it to arrive. */
export async function checkForUpdate(waitMs = 20_000): Promise<UpdateCheck> {
  if (useUpdateReady.getState().ready) return 'ready';
  if (!navigator.onLine) return 'offline';
  if (!registration) return 'unavailable';
  try {
    await registration.update();
  } catch {
    return navigator.onLine ? 'unavailable' : 'offline';
  }
  if (useUpdateReady.getState().ready) return 'ready';
  if (!registration.installing && !registration.waiting) return 'latest';
  // A new version is downloading: with autoUpdate it takes over by itself, then updateReady() runs.
  return new Promise((resolve) => {
    const done = (result: UpdateCheck) => {
      clearTimeout(timer);
      stop();
      resolve(result);
    };
    const timer = setTimeout(() => done('downloading'), waitMs);
    const stop = useUpdateReady.subscribe((s) => s.ready && done('ready'));
  });
}

const REOPEN = 'mappeora-reopen';

/**
 * Loads the new version now. The open map is saved first and opened again
 * afterwards, so the child finds it as it was. Returns false (and stays) when
 * the map could not be saved: the editor already says so.
 */
export async function applyUpdate(): Promise<boolean> {
  const id = useMapStore.getState().map?.id;
  if (!(await flushAutosave())) return false;
  try {
    if (id) sessionStorage.setItem(REOPEN, id);
  } catch {
    // Blocked storage: the new version starts on the list, the map is saved anyway.
  }
  useUpdateReady.setState({ ready: false });
  window.location.reload();
  return true;
}

/** The map that was open before «Aggiorna», once. */
export function takeReopen(): string | null {
  try {
    const id = sessionStorage.getItem(REOPEN);
    sessionStorage.removeItem(REOPEN);
    return id;
  } catch {
    return null;
  }
}
