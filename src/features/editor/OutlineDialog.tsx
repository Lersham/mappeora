import { useEffect, useRef, useState, type CSSProperties, type KeyboardEvent } from 'react';
import { Dialog } from '../../components/Dialog';
import { BigButton } from '../../components/BigButton';
import { MicButton } from '../../components/MicButton';
import { useMapStore } from '../../store/mapStore';
import { toOutline, type OutlineRow } from '../../lib/outline';
import { newId } from '../../lib/id';

/** Rows from `i` to the end of its sub-list (the line and the ones indented under it). */
function subtreeEnd(rows: OutlineRow[], i: number): number {
  let end = i + 1;
  while (end < rows.length && rows[end].depth > rows[i].depth) end++;
  return end;
}

/**
 * The map as an indented list: write a line per concept, move it right to
 * put it under the one above. «Fatto» builds the map from the list.
 */
export function OutlineDialog({ onDone, onClose }: { onDone(): void; onClose(): void }) {
  const map = useMapStore((s) => s.map)!;
  const applyOutline = useMapStore((s) => s.applyOutline);
  const [initial] = useState<OutlineRow[]>(() => {
    const list = toOutline(map);
    return list.length ? list : [{ id: newId(), label: '', depth: 0 }];
  });
  const [rows, setRows] = useState(initial);
  const [focusId, setFocusId] = useState<string | null>(null);
  const inputs = useRef(new Map<string, HTMLInputElement>());

  useEffect(() => {
    if (!focusId) return;
    inputs.current.get(focusId)?.focus();
    setFocusId(null);
  }, [focusId]);

  const setLabel = (id: string, label: string) => setRows((r) => r.map((x) => (x.id === id ? { ...x, label } : x)));

  /** Moves a line with the lines under it: right puts it under the line above. */
  const shift = (i: number, by: 1 | -1) =>
    setRows((r) => {
      const max = i === 0 ? 0 : r[i - 1].depth + 1;
      const depth = Math.max(0, Math.min(max, r[i].depth + by));
      const delta = depth - r[i].depth;
      if (!delta) return r;
      const end = subtreeEnd(r, i);
      return r.map((x, j) => (j >= i && j < end ? { ...x, depth: x.depth + delta } : x));
    });

  /**
   * A new line right below: the first one under `i` if it has some, else
   * next to it. Never a second main concept: ⬅️ makes one if wanted.
   */
  const insertAfter = (i: number, label = '') => {
    const id = newId();
    setRows((r) => {
      const depth = Math.max(1, r[i + 1] && r[i + 1].depth > r[i].depth ? r[i + 1].depth : r[i].depth);
      return [...r.slice(0, i + 1), { id, label, depth }, ...r.slice(i + 1)];
    });
    setFocusId(id);
  };

  /** Removes a line; the lines under it move one step left. */
  const remove = (i: number) => {
    setRows((r) => {
      const end = subtreeEnd(r, i);
      const next = r.map((x, j) => (j > i && j < end ? { ...x, depth: x.depth - 1 } : x)).filter((_, j) => j !== i);
      return next.length ? next : [{ id: newId(), label: '', depth: 0 }];
    });
    if (i > 0) setFocusId(rows[i - 1].id);
  };

  /** A new line at the end, under the main concept. */
  const add = (label = '') => {
    const id = newId();
    setRows((r) => [...r, { id, label, depth: r.length ? 1 : 0 }]);
    return id;
  };

  // Dictation fills one new line as the child speaks (see MicButton).
  const dictated = useRef<string | null>(null);
  const onDictation = (text: string) => {
    if (dictated.current) setLabel(dictated.current, text);
    else dictated.current = add(text);
  };

  const done = () => {
    applyOutline(rows);
    onDone();
  };

  /** Esc, Back or a tap outside: written lines are not thrown away unasked. */
  const close = () => {
    const changed = rows.length !== initial.length || rows.some((r, i) => r.id !== initial[i].id || r.label !== initial[i].label || r.depth !== initial[i].depth);
    if (!changed || window.confirm('Chiudere la scaletta senza cambiare la mappa? Le righe scritte andranno perse.')) onClose();
  };

  const onKey = (e: KeyboardEvent<HTMLInputElement>, i: number) => {
    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
      e.preventDefault();
      done();
    } else if (e.key === 'Enter') {
      e.preventDefault();
      insertAfter(i);
    } else if (e.key === 'Tab') {
      // Only when the line can move: otherwise Tab goes to the next button as usual.
      const canMove = e.shiftKey ? rows[i].depth > 0 : i > 0 && rows[i].depth <= rows[i - 1].depth;
      if (!canMove) return;
      e.preventDefault();
      shift(i, e.shiftKey ? -1 : 1);
    } else if (e.key === 'Backspace' && !rows[i].label && rows.length > 1) {
      e.preventDefault();
      remove(i);
    }
  };

  return (
    <Dialog title="Scaletta" onClose={close} className="outline-dialog">
      <p className="muted small">Un concetto per riga. Con ➡️ lo metti sotto quello di sopra, con ⬅️ lo riporti indietro.</p>
      <p className="muted small outline-keys">Con la tastiera: Invio per una nuova riga, Tab e Maiusc+Tab per spostarla, Ctrl+Invio per finire.</p>
      <ol className="outline-list">
        {rows.map((r, i) => (
          <li key={r.id} className="outline-row" style={{ '--depth': Math.min(r.depth, 6) } as CSSProperties}>
            <span className="outline-bullet" aria-hidden>
              {r.depth === 0 ? '●' : '–'}
            </span>
            <input
              ref={(el) => void (el ? inputs.current.set(r.id, el) : inputs.current.delete(r.id))}
              className="text-field outline-input"
              value={r.label}
              aria-label={`Riga ${i + 1}, livello ${r.depth + 1}`}
              placeholder="Scrivi un concetto"
              enterKeyHint="next"
              onChange={(e) => setLabel(r.id, e.target.value)}
              onKeyDown={(e) => onKey(e, i)}
            />
            <button type="button" className="outline-tool outline-tools-start" aria-label="Sposta a sinistra" disabled={r.depth === 0} onClick={() => shift(i, -1)}>
              ⬅️
            </button>
            <button type="button" className="outline-tool" aria-label="Sposta a destra" disabled={i === 0 || r.depth > rows[i - 1].depth} onClick={() => shift(i, 1)}>
              ➡️
            </button>
            <button type="button" className="outline-tool" aria-label="Togli la riga" onClick={() => remove(i)}>
              🗑️
            </button>
          </li>
        ))}
      </ol>
      <div className="outline-add">
        <BigButton icon="➕" label="Nuova riga" onClick={() => setFocusId(add())} />
        <span className="outline-mic">
          <MicButton onText={onDictation} onStart={() => void (dictated.current = null)} label="Detta una nuova riga" />
        </span>
      </div>
      <div className="dialog-actions">
        <BigButton icon="✖️" label="Annulla" onClick={onClose} />
        <BigButton
          icon="✅"
          label="Fatto"
          variant="primary"
          onClick={done}
        />
      </div>
    </Dialog>
  );
}
