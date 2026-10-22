import { useState } from 'react';
import { SpokenError } from '../../components/SpokenError';
import { flushAutosave, reopenStored, saveAsCopy, useSaveStatus } from '../../services/autosave';

/** Says when the map is not being saved, and what the child can do about it. */
export function SaveProblemNotice() {
  const problem = useSaveStatus((s) => s.problem);
  const [failed, setFailed] = useState(false);
  // A second tap while the first is still saving would make two copies.
  const [busy, setBusy] = useState(false);
  if (!problem) return null;

  const run = (action: () => Promise<boolean>) => async () => {
    setBusy(true);
    try {
      setFailed(!(await action()));
    } finally {
      setBusy(false);
    }
  };

  const conflict = problem === 'conflict';
  const text = conflict
    ? `Questa mappa è stata cambiata in un’altra finestra. Le tue ultime modifiche non sono ancora salvate.${failed ? ' Non ci sono riuscito: riprova.' : ''}`
    : 'Non riesco a salvare le ultime modifiche. Per sicurezza puoi anche salvarle in un file con «Salva e manda».';

  return (
    <div className="editor-notice save-problem">
      <SpokenError
        className="save-problem-alert"
        actions={
          <div className="save-problem-actions">
            {conflict ? (
              <>
                <button type="button" className="big-button primary" disabled={busy} onClick={run(saveAsCopy)}>
                  <span className="big-button-label">Salva come copia</span>
                </button>
                <button type="button" className="big-button" disabled={busy} onClick={run(reopenStored)}>
                  <span className="big-button-label">Apri l’altra versione</span>
                </button>
              </>
            ) : (
              <button type="button" className="big-button primary" disabled={busy} onClick={run(flushAutosave)}>
                <span className="big-button-label">Riprova</span>
              </button>
            )}
          </div>
        }
      >
        {text}
      </SpokenError>
    </div>
  );
}
