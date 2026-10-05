import { useState } from 'react';
import { flushAutosave, reopenStored, saveAsCopy, useSaveStatus } from '../../services/autosave';

/** Says when the map is not being saved, and what the child can do about it. */
export function SaveProblemNotice() {
  const problem = useSaveStatus((s) => s.problem);
  const [failed, setFailed] = useState(false);
  if (!problem) return null;

  const run = (action: () => Promise<boolean>) => async () => setFailed(!(await action()));

  return (
    <div className="editor-notice save-problem" role="alert">
      {problem === 'conflict' ? (
        <>
          <span>
            Questa mappa è stata cambiata in un’altra finestra. Le tue ultime modifiche non sono ancora salvate.
            {failed && ' Non ci sono riuscito: riprova.'}
          </span>
          <div className="save-problem-actions">
            <button type="button" className="big-button primary" onClick={run(saveAsCopy)}>
              <span className="big-button-label">Salva come copia</span>
            </button>
            <button type="button" className="big-button" onClick={run(reopenStored)}>
              <span className="big-button-label">Apri l’altra versione</span>
            </button>
          </div>
        </>
      ) : (
        <>
          <span>
            Non riesco a salvare le ultime modifiche. Per sicurezza puoi anche salvarle in un file con «Salva».
          </span>
          <div className="save-problem-actions">
            <button type="button" className="big-button primary" onClick={run(flushAutosave)}>
              <span className="big-button-label">Riprova</span>
            </button>
          </div>
        </>
      )}
    </div>
  );
}
