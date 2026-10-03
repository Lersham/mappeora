import { BaseEdge, EdgeLabelRenderer, useInternalNode, type Edge, type EdgeProps } from '@xyflow/react';
import { LADDER } from '../../lib/ladder';

export type LadderEdgeData = { onEdit?: () => void };
export type LadderFlowEdge = Edge<LadderEdgeData, 'ladder'>;

/**
 * The "scaletta" line: down from the parent's left side, then right into
 * the child. Linking words sit just above the child, where there is room.
 */
export function LadderEdge({ id, target, sourceX, sourceY, targetX, targetY, label, data, interactionWidth }: EdgeProps<LadderFlowEdge>) {
  // The line enters the child at mid-height; the words go above its top edge.
  const childHeight = useInternalNode(target)?.measured.height ?? 0;
  const labelY = targetY - childHeight / 2 - LADDER.labelSpace / 2;
  const r = Math.max(0, Math.min(12, (targetY - sourceY) / 2, (targetX - sourceX) / 2));
  const path = `M ${sourceX},${sourceY} L ${sourceX},${targetY - r} Q ${sourceX},${targetY} ${sourceX + r},${targetY} L ${targetX},${targetY}`;
  return (
    <>
      <BaseEdge id={id} path={path} interactionWidth={interactionWidth} />
      {label && (
        <EdgeLabelRenderer>
          <button
            type="button"
            className="ladder-label nodrag nopan"
            style={{ transform: `translate(${sourceX + 10}px, ${labelY}px) translateY(-50%)` }}
            onClick={data?.onEdit}
            disabled={!data?.onEdit}
          >
            {label}
          </button>
        </EdgeLabelRenderer>
      )}
    </>
  );
}
