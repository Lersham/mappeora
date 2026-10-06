import { EdgeLabelRenderer } from '@xyflow/react';

/**
 * A line without linking words shows a small «+» where a finger can find
 * it: the thin line alone is hard to hit on a phone.
 */
export function LinkAdd({ x, y, onEdit }: { x: number; y: number; onEdit?: () => void }) {
  if (!onEdit) return null;
  return (
    <EdgeLabelRenderer>
      <button
        type="button"
        className="link-add nodrag nopan"
        style={{ transform: `translate(${x}px, ${y}px) translate(-50%, -50%)` }}
        aria-label="Aggiungi le parole che collegano"
        title="Aggiungi le parole che collegano"
        // The line itself is already a keyboard stop (Invio).
        tabIndex={-1}
        onClick={onEdit}
      >
        +
      </button>
    </EdgeLabelRenderer>
  );
}
