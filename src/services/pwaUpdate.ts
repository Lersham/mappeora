import { create } from 'zustand';
import { useMapStore } from '../store/mapStore';

/** True once a new version is installed and waiting: the list of maps shows «Aggiorna». */
export const useUpdateReady = create<{ ready: boolean }>(() => ({ ready: false }));

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
