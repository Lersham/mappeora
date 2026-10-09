import { EdgeLabel } from './EdgeLabel';

/**
 * A line without linking words shows a small «+» where a finger can find
 * it: the thin line alone is hard to hit on a phone. It stands out on the
 * lines of the concept in hand (`near`), and stays faint on the others so
 * that a big map is not covered in buttons.
 */
export function LinkAdd({ x, y, onEdit, near = false }: { x: number; y: number; onEdit?: () => void; near?: boolean }) {
  if (!onEdit) return null;
  return (
    <EdgeLabel>
      <button
        type="button"
        className={`link-add nodrag nopan${near ? '' : ' is-faint'}`}
        style={{ transform: `translate(${x}px, ${y}px) translate(-50%, -50%)` }}
        aria-label="Aggiungi le parole che collegano"
        title="Aggiungi le parole che collegano"
        // The line itself is already a keyboard stop (Invio).
        tabIndex={-1}
        onClick={onEdit}
      >
        +
      </button>
    </EdgeLabel>
  );
}
