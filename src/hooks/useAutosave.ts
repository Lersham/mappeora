import { useEffect } from 'react';
import { startAutosave } from '../services/autosave';

/** Saves the open map shortly after every change: there is no "Save" button. */
export function useAutosave() {
  useEffect(startAutosave, []);
}
