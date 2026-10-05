import { useEffect, useRef } from 'react';

type Handler = { current: () => void };

/** Open dialogs and modes, the newest last: Android's Back closes the newest. */
const stack: Handler[] = [];

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
    return () => {
      const i = stack.indexOf(entry);
      if (i >= 0) stack.splice(i, 1);
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
