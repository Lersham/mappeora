import { useState } from 'react';
import { applyUpdate, checkForUpdate, useUpdateReady, type UpdateCheck as Result } from '../services/pwaUpdate';
import { isNative } from '../services/platform';

const MESSAGES: Record<Exclude<Result, 'ready'>, string> = {
  latest: 'Hai già l’ultima versione.',
  downloading: 'Sto scaricando la versione nuova: quando è pronta compare «Aggiorna».',
  offline: 'Serve internet per cercare una versione nuova.',
  unavailable: 'Non riesco a cercare adesso. Riprova più tardi.',
};

/** «Cerca aggiornamenti», under the version: for when the child (or the teacher) wants the latest one now. */
export function UpdateCheck() {
  const ready = useUpdateReady((s) => s.ready);
  const [state, setState] = useState<'idle' | 'checking' | Exclude<Result, 'ready'>>('idle');
  const [busy, setBusy] = useState(false);
  // The apps from the stores update through the store; a browser without service workers just reloads.
  if (isNative() || !('serviceWorker' in navigator)) return null;

  const check = async () => {
    setState('checking');
    const result = await checkForUpdate();
    setState(result === 'ready' ? 'idle' : result);
  };

  const update = async () => {
    setBusy(true);
    if (!(await applyUpdate())) setBusy(false);
  };

  return (
    <div className="update-check">
      {ready ? (
        <button type="button" className="big-button primary" disabled={busy} onClick={() => void update()}>
          <span className="big-button-label">Aggiorna</span>
        </button>
      ) : (
        <button type="button" className="link-button" disabled={state === 'checking'} onClick={() => void check()}>
          Cerca aggiornamenti
        </button>
      )}
      {/* Always in the page: a live region must be there before it speaks. */}
      <div role="status">
        {ready ? (
          <p className="muted small">È pronta una nuova versione di MappAmi.</p>
        ) : state === 'checking' ? (
          <p className="muted small">Cerco…</p>
        ) : (
          state !== 'idle' && <p className="muted small">{MESSAGES[state]}</p>
        )}
      </div>
    </div>
  );
}
