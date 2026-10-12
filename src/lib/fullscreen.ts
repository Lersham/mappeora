import { useSyncExternalStore } from 'react';

// Safari on iPad (before 16.4 or so) only has the prefixed API.
type FsDocument = Document & {
  webkitFullscreenEnabled?: boolean;
  webkitFullscreenElement?: Element | null;
  webkitExitFullscreen?: () => Promise<void> | void;
};
type FsElement = HTMLElement & { webkitRequestFullscreen?: () => Promise<void> | void };

const doc = () => document as FsDocument;

/** False where full screen does not exist (iPhone Safari, some WebViews): the button is then hidden. */
export function canFullscreen(): boolean {
  return !!(doc().fullscreenEnabled || doc().webkitFullscreenEnabled);
}

export function isFullscreen(): boolean {
  return !!(doc().fullscreenElement || doc().webkitFullscreenElement);
}

export async function enterFullscreen(): Promise<void> {
  const el = document.documentElement as FsElement;
  try {
    await (el.requestFullscreen ? el.requestFullscreen() : el.webkitRequestFullscreen?.());
  } catch {
    // Refused (no user gesture, policy): the button simply shows the real state.
  }
}

export async function exitFullscreen(): Promise<void> {
  try {
    await (doc().exitFullscreen ? doc().exitFullscreen() : doc().webkitExitFullscreen?.());
  } catch {
    // Already out.
  }
}

export function toggleFullscreen(): Promise<void> {
  return isFullscreen() ? exitFullscreen() : enterFullscreen();
}

function subscribe(onChange: () => void) {
  document.addEventListener('fullscreenchange', onChange);
  document.addEventListener('webkitfullscreenchange', onChange);
  return () => {
    document.removeEventListener('fullscreenchange', onChange);
    document.removeEventListener('webkitfullscreenchange', onChange);
  };
}

/** Whether the page is in full screen right now, whoever put it there (the button or the system). */
export function useFullscreen(): boolean {
  return useSyncExternalStore(subscribe, isFullscreen, () => false);
}

/** What the button shows: the word says what a press does now, so no aria-pressed. */
export const fullscreenProps = (on: boolean) => ({
  icon: on ? ('fullscreen-exit' as const) : ('fullscreen' as const),
  label: on ? 'Esci da schermo intero' : 'Schermo intero',
  onClick: () => void toggleFullscreen(),
});
