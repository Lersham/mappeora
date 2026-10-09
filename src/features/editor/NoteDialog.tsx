import { useRef, useState } from 'react';
import { Dialog } from '../../components/Dialog';
import { MicButton } from '../../components/MicButton';
import { BigButton } from '../../components/BigButton';
import { useMapStore } from '../../store/mapStore';
import { useReadAloud } from '../../hooks/useReadAloud';
import type { MapNode } from '../../types/map';

interface Props {
  node: MapNode;
  /** During a review the note is a hint: it can be read and heard, not changed. */
  readOnly?: boolean;
  onClose(): void;
}

/**
 * «Approfondimento»: a longer note on a concept (dates, details, an
 * example). The concept shows 📝; the note is read aloud on request, can
 * go on the last page of the PDF and never goes in the «versione per la verifica».
 */
export function NoteDialog({ node, readOnly = false, onClose }: Props) {
  const { updateNode } = useMapStore.getState();
  const [text, setText] = useState(node.note ?? '');
  /** What was written before dictating: the spoken words go after it. */
  const before = useRef('');
  const { readText } = useReadAloud();

  const save = () => {
    const note = text.trim();
    if (note !== (node.note ?? '')) updateNode(node.id, { note: note || undefined });
    onClose();
  };
  // Esc, Back or a tap outside keep what was written (or dictated).
  const close = readOnly ? onClose : save;
  const heard = (readOnly ? node.note : text)?.trim() ?? '';

  return (
    <Dialog title={readOnly ? 'Suggerimento' : 'Approfondimento'} onClose={close} className="note-dialog">
      <p className="note-concept">{node.label}</p>
      {readOnly ? (
        <p className="note-text">{node.note}</p>
      ) : (
        <>
          <p className="muted small">Date, dettagli, un esempio: quello che non sta nel riquadro. Non compare nella versione per la verifica.</p>
          <div className="note-row">
            <textarea
              className="text-field note-input"
              value={text}
              rows={6}
              autoFocus
              aria-label="Testo dell’approfondimento"
              placeholder="es. Il 14 luglio 1789 il popolo di Parigi assalta la Bastiglia."
              onChange={(e) => setText(e.target.value)}
            />
            <MicButton onStart={() => void (before.current = text.trim())} onText={(t) => setText(before.current ? `${before.current} ${t}` : t)} />
          </div>
        </>
      )}
      <div className="dialog-actions">
        <BigButton icon="speak" label="Ascolta" disabled={!heard} onClick={() => void readText(heard)} />
        {!readOnly && node.note && (
          <BigButton
            icon="trash"
            label="Togli"
            variant="danger"
            onClick={() => {
              updateNode(node.id, { note: undefined });
              onClose();
            }}
          />
        )}
        <BigButton icon="check" label={readOnly ? 'Chiudi' : 'Fatto'} variant="primary" onClick={close} />
      </div>
    </Dialog>
  );
}
