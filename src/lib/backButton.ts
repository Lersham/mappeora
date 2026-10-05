import { useEffect, useRef } from 'react';

type Handler = { current: () => void };

/** Open dialogs and modes, the newest last: Android's Back closes the newest. */
const stack: Handler[] = [];
const watchers = new Set<() => void>();
const changed = () => watchers.forEach((w) => w());

/**
 * While `active`, Android's Back button calls `handler` (closes the dialog,
 * leaves the review) instead of leaving the map or the app.
 */
export function useBackHandler(handler: () => void, active = true) {
  const ref = useRef(handler);
  ref.current = handler;
  useEffect(() => {
    if (!active) return;
    const entry: Handler = { current: () => ref.current() };
    stack.push(entry);
    changed();
    return () => {
      const i = stack.indexOf(entry);
      if (i >= 0) stack.splice(i, 1);
      changed();
    };
  }, [active]);
}

/** Runs the newest handler. False when nothing is open. */
export function handleBack(): boolean {
  const top = stack.at(-1);
  if (!top) return false;
  top.current();
  return true;
}

/** True while a dialog or a mode would take the Back button. */
export const backIsHandled = () => stack.length > 0;

/** Calls `watcher` when a dialog or a mode opens or closes. */
export function watchBackHandlers(watcher: () => void): () => void {
  watchers.add(watcher);
  return () => void watchers.delete(watcher);
}

/**
 * Web: the browser's Back works like Android's. While a map or a dialog is
 * open, one page of history belongs to the app: Back takes it, and `onBack`
 * closes the newest dialog or leaves the map, instead of leaving the site.
 * Returns a function that undoes it.
 */
export function installWebBack(onBack: () => unknown, wanted: () => boolean, watch: (sync: () => void) => () => void): () => void {
  const MARK = 'mappeora-back';
  // After a reload the app's page may still be on top: it is taken back below.
  let armed = (history.state as Record<string, unknown> | null)?.[MARK] === true;
  /** Pages taken back by the app itself: their popstate is not a Back. */
  let ignore = 0;
  const sync = () => {
    if (wanted() && !armed) {
      history.pushState({ [MARK]: true }, '');
      armed = true;
    } else if (!wanted() && armed) {
      armed = false;
      ignore++;
      history.back();
    }
  };
  const onPop = () => {
    if (ignore > 0) {
      ignore--;
      return;
    }
    armed = false;
    // Whatever Back did (or a «Rimani» that kept the map), the page comes back if still needed.
    void Promise.resolve(onBack()).finally(sync);
  };
  window.addEventListener('popstate', onPop);
  const unwatch = watch(sync);
  const unwatchHandlers = watchBackHandlers(sync);
  sync();
  return () => {
    window.removeEventListener('popstate', onPop);
    unwatch();
    unwatchHandlers();
  };
}
