import { useMapStore } from '../store/mapStore';

let wanted = false;

/**
 * A new version is installed. Reloading now would interrupt the child in
 * the middle of a map or a dialog: wait until they are on the list of maps.
 */
export function updateReady() {
  wanted = true;
  reloadIfSafe();
}

/** Loads the new version, if there is one and nothing is in progress. */
export function reloadIfSafe() {
  if (!wanted || useMapStore.getState().map || document.querySelector('[role="dialog"]')) return;
  wanted = false;
  window.location.reload();
}
