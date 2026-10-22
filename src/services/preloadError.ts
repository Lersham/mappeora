/**
 * A part of the app loaded later (the editor, Riordina, PDF…) that fails to
 * load usually belongs to an older version that is gone. The page then saves
 * and loads the new version, but only for what the child asked for, and never
 * in a loop. See the 'vite:preloadError' listener in main.tsx.
 */
const KEY = 'mappeora-reloaded';
/** A second failure this soon after a reload means the new version fails too: reloading again would not help. */
export const RELOAD_GAP_MS = 60_000;

let background = 0;

/**
 * Runs a load that nobody asked for (fetching a part ahead of time). If it
 * fails the page stays as it is: it must not reload under the child's hands,
 * and the part is asked for again, and reloaded for, when it is really needed.
 * The failure event comes before the load settles, so the counter covers it.
 */
export async function loadInBackground<T>(load: () => Promise<T>): Promise<T> {
  background++;
  try {
    return await load();
  } finally {
    background--;
  }
}

/** True when a failed load may reload the page now; it also notes the moment, so the next failure waits. */
export function takeReload(now = Date.now()): boolean {
  if (background > 0 || !navigator.onLine) return false;
  try {
    // Nothing, an old flag ('1') or a time in the future (the clock was changed) all count as long ago.
    const age = now - Number(sessionStorage.getItem(KEY));
    if (age >= 0 && age < RELOAD_GAP_MS) return false;
    sessionStorage.setItem(KEY, String(now));
    return true;
  } catch {
    // Blocked storage: no way to tell a loop from a first failure.
    return false;
  }
}

/**
 * Whether an error comes from a part that could not be loaded (the browsers
 * word it differently). The browser remembers a failed load and so does
 * React.lazy: only a new page gets the part again.
 */
export function isChunkLoadError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : '';
  return /dynamically imported module|importing a module script failed|unable to preload css|loading (?:css )?chunk/i.test(message);
}
