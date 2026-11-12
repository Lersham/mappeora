import { useState } from 'react';
import { Dialog } from '../../components/Dialog';
import { BigButton } from '../../components/BigButton';
import { friendlyDate } from '../../lib/friendlyDate';
import { TRASH_DAYS, type TrashedSummary } from '../../services/storage/types';

interface Props {
  maps: TrashedSummary[];
  /** Puts the map back; false if it could not. */
  onRestore(id: string): Promise<boolean>;
  onClose(): void;
}

/** The maps deleted in the last 30 days: a tap puts one back in the list. */
export function TrashDialog({ maps, onRestore, onClose }: Props) {
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);

  const restore = async (id: string) => {
    setBusy(true);
    setFailed(false);
    const ok = await onRestore(id);
    setBusy(false);
    setFailed(!ok);
  };

  return (
    <Dialog title="Mappe cancellate" onClose={onClose}>
      <p className="muted">
        Le mappe che cancelli restano qui per {TRASH_DAYS} giorni. Poi spariscono per sempre.
      </p>
      {maps.length === 0 ? (
        <p>Non ci sono mappe cancellate.</p>
      ) : (
        <ul className="trash-list">
          {maps.map((m) => {
            const title = m.title.trim() || 'Mappa senza titolo';
            return (
              <li key={m.id} className="map-removed">
                <p id={`trash-${m.id}`}>
                  <strong>{title}</strong>
                  <br />
                  Cancellata: {friendlyDate(m.removedAt).toLowerCase()}
                </p>
                <BigButton icon="undo" label="Rimetti" aria-describedby={`trash-${m.id}`} disabled={busy} onClick={() => void restore(m.id)} />
              </li>
            );
          })}
        </ul>
      )}
      {failed && (
        <p className="field-error" role="alert">
          Non ce l’ho fatta a rimettere la mappa. Riprova.
        </p>
      )}
      <div className="dialog-actions">
        <BigButton icon="close" label="Chiudi" onClick={onClose} />
      </div>
    </Dialog>
  );
}
