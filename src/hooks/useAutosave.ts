import { useEffect } from 'react';
import { useMapStore } from '../store/mapStore';
import { storage } from '../services/storage';

const DELAY_MS = 600;

/** Saves the open map shortly after every change: there is no "Save" button. */
export function useAutosave() {
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    let pending: Parameters<ReturnType<typeof storage>['save']>[0] | null = null;
    const flush = () => {
      if (pending) void storage().save(pending);
      pending = null;
    };
    const unsubscribe = useMapStore.subscribe((state, prev) => {
      if (!state.map || state.map === prev.map) return;
      pending = state.map;
      clearTimeout(timer);
      timer = setTimeout(flush, DELAY_MS);
    });
    const onHide = () => document.visibilityState === 'hidden' && flush();
    document.addEventListener('visibilitychange', onHide);
    return () => {
      unsubscribe();
      clearTimeout(timer);
      flush();
      document.removeEventListener('visibilitychange', onHide);
    };
  }, []);
}
