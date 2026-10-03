import { BaseEdge, EdgeLabelRenderer, type Edge, type EdgeProps } from '@xyflow/react';
import { LADDER } from '../../lib/ladder';
import { roundedPath } from '../../lib/sheetLayout';

export type BusEdgeData = { points: { x: number; y: number }[]; onEdit?: () => void };
export type BusFlowEdge = Edge<BusEdgeData, 'bus'>;

/**
 * "Foglio A4": the line from the main concept to a branch. It runs along
 * the space above each row of branches (and between columns, for lower
 * rows) and drops into the branch from above; linking words sit just above
 * the branch.
 */
export function BusEdge({ id, sourceX, sourceY, targetX, targetY, label, data, interactionWidth }: EdgeProps<BusFlowEdge>) {
  // The first and last bends follow the real connection points, which can
  // be a few pixels off the planned ones while concepts are being measured.
  const points = (data?.points ?? []).map((p) => ({ ...p }));
  if (points.length > 0) {
    points[0].x = sourceX;
    points[points.length - 1].x = targetX;
  }
  const path = roundedPath([{ x: sourceX, y: sourceY }, ...points, { x: targetX, y: targetY }]);
  // Several branches share the line along the top: only the last stretch,
  // down into this branch, is a wide target for a tap (linking words).
  const last = points[points.length - 1] ?? { x: sourceX, y: sourceY };
  return (
    <>
      <BaseEdge id={id} path={path} interactionWidth={0} />
      <path
        d={`M ${last.x},${last.y} L ${targetX},${targetY}`}
        className="react-flow__edge-interaction"
        fill="none"
        stroke="transparent"
        strokeWidth={interactionWidth ?? 32}
      />
      {label && (
        <EdgeLabelRenderer>
          <button
            type="button"
            className="ladder-label nodrag nopan"
            style={{ transform: `translate(${targetX}px, ${targetY - LADDER.labelSpace / 2 - 2}px) translate(-50%, -50%)` }}
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
