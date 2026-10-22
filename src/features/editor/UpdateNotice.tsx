import { useState } from 'react';
import { applyUpdate, useUpdateReady } from '../../services/pwaUpdate';

/**
 * A new version is ready while a map is open. The page never reloads under
 * the child's hands: «Aggiorna» saves the map and opens it again in the new
 * version, «Dopo» keeps quiet until the app starts again.
 */
export function UpdateNotice() {
  const show = useUpdateReady((s) => s.ready && !s.later);
  // A second tap while the map is being saved would reload twice.
  const [busy, setBusy] = useState(false);
  if (!show) return null;

  const update = async () => {
    setBusy(true);
    if (!(await applyUpdate())) setBusy(false);
  };

  return (
    <section className="editor-notice update-notice" aria-label="Nuova versione">
      <p role="status">È uscita una nuova versione di MappAmi.</p>
      <div className="update-notice-actions">
        <button type="button" className="big-button primary" disabled={busy} onClick={() => void update()}>
          <span className="big-button-label">Aggiorna</span>
        </button>
        <button type="button" className="big-button" disabled={busy} onClick={() => useUpdateReady.setState({ later: true })}>
          <span className="big-button-label">Dopo</span>
        </button>
      </div>
    </section>
  );
}
