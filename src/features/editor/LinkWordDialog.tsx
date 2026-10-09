import { useState } from 'react';
import { Dialog } from '../../components/Dialog';
import { MicButton } from '../../components/MicButton';
import { BigButton } from '../../components/BigButton';
import { useMapStore } from '../../store/mapStore';
import type { MapEdge } from '../../types/map';

/** The most common linking words in Italian school maps. */
const SUGGESTIONS = ['è', 'ha', 'è formato da', 'si divide in', 'causa', 'provoca', 'serve per', 'si trova in', 'per esempio', 'poi', 'quindi'];

export function LinkWordDialog({ edge, onClose }: { edge: MapEdge; onClose(): void }) {
  const { updateEdge, removeEdges } = useMapStore.getState();
  const [text, setText] = useState(edge.label ?? '');

  const save = (label: string) => {
    updateEdge(edge.id, { label: label.trim() || undefined });
    onClose();
  };

  return (
    <Dialog title="Parola di collegamento" onClose={onClose}>
      <form
        className="search-row"
        onSubmit={(e) => {
          e.preventDefault();
          save(text);
        }}
      >
        <input
          className="text-field link-word-input"
          value={text}
          autoFocus
          placeholder="es. è formato da"
          aria-label="Parola di collegamento"
          onChange={(e) => setText(e.target.value)}
        />
        <MicButton onText={setText} />
      </form>
      <div className="chip-row">
        {SUGGESTIONS.map((s) => (
          <button key={s} type="button" className="chip" onClick={() => save(s)}>
            {s}
          </button>
        ))}
      </div>
      <div className="dialog-actions">
        <BigButton
          icon="scissors"
          label="Togli freccia"
          variant="danger"
          onClick={() => {
            removeEdges([edge.id]);
            onClose();
          }}
        />
        <BigButton icon="check" label="Fatto" variant="primary" onClick={() => save(text)} />
      </div>
    </Dialog>
  );
}
