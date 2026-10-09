import { BaseEdge, useInternalNode, type Edge, type EdgeProps } from '@xyflow/react';
import { EdgeLabel } from './EdgeLabel';
import { LADDER, labelScale } from '../../lib/ladder';
import { useSettings } from '../../store/settingsStore';
import { LinkAdd } from './LinkAdd';
import { branchClass } from './branchColor';

export type LadderEdgeData = { onEdit?: () => void; branch?: number; near?: boolean };
export type LadderFlowEdge = Edge<LadderEdgeData, 'ladder'>;

/**
 * The "scaletta" line: down from the parent's left side, then right into
 * the child. Linking words sit just above the child, where there is room.
 */
export function LadderEdge({ id, target, sourceX, sourceY, targetX, targetY, label, data, interactionWidth }: EdgeProps<LadderFlowEdge>) {
  // The line enters the child at mid-height; the words go above its top edge.
  const childHeight = useInternalNode(target)?.measured.height ?? 0;
  const scale = labelScale(useSettings((s) => s.textScale));
  const labelY = targetY - childHeight / 2 - (LADDER.labelSpace * scale) / 2;
  const r = Math.max(0, Math.min(12, (targetY - sourceY) / 2, (targetX - sourceX) / 2));
  const path = `M ${sourceX},${sourceY} L ${sourceX},${targetY - r} Q ${sourceX},${targetY} ${sourceX + r},${targetY} L ${targetX},${targetY}`;
  return (
    <>
      <BaseEdge id={id} path={path} interactionWidth={interactionWidth} className={branchClass(data?.branch)} />
      {label && (
        <EdgeLabel>
          <button
            type="button"
            className="ladder-label nodrag nopan"
            style={{ transform: `translate(${sourceX + 10}px, ${labelY}px) translateY(-50%)` }}
            onClick={data?.onEdit}
            disabled={!data?.onEdit}
          >
            {label}
          </button>
        </EdgeLabel>
      )}
      {/* On the line down, level with the child's top: clear of its connection dot. */}
      {!label && <LinkAdd x={sourceX} y={targetY - childHeight / 2} onEdit={data?.onEdit} near={data?.near} />}
    </>
  );
}
