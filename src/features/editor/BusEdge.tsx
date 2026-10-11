import { BaseEdge, type Edge, type EdgeProps } from '@xyflow/react';
import { EdgeLabel } from './EdgeLabel';
import { LADDER, labelScale } from '../../lib/ladder';
import { useSettings } from '../../store/settingsStore';
import { roundedPath } from '../../lib/sheetLayout';
import { LinkAdd } from './LinkAdd';
import { branchClass } from './branchColor';

export type BusEdgeData = { points: { x: number; y: number }[]; own?: number; branch?: number; column?: boolean; onEdit?: () => void; near?: boolean };
export type BusFlowEdge = Edge<BusEdgeData, 'bus'>;

/**
 * "Foglio": the line from a concept to one under it. Towards a row it runs
 * along the space above the row and drops into the concept from above;
 * down a column it starts just under the concept above it (the line from
 * the top of the column runs behind the ones in between). Linking words
 * sit just above the concept.
 */
export function BusEdge({ id, sourceX, sourceY, targetX, targetY, label, data, interactionWidth }: EdgeProps<BusFlowEdge>) {
  const scale = labelScale(useSettings((s) => s.textScale));
  // The first and last bends follow the real connection points, which can
  // be a few pixels off the planned ones while concepts are being measured.
  const points = (data?.points ?? []).map((p) => ({ ...p }));
  if (points.length > 0) {
    points[0].x = sourceX;
    points[points.length - 1].x = targetX;
  }
  const path = roundedPath([...(data?.column ? [] : [{ x: sourceX, y: sourceY }]), ...points, { x: targetX, y: targetY }]);
  // Several branches share the line along the top: only the last stretch,
  // down into this branch, is a wide target for a tap (linking words).
  const last = points[points.length - 1] ?? { x: sourceX, y: sourceY };
  // The stretch that belongs to this branch only, in the branch's colour.
  const own = points.slice(Math.min(data?.own ?? points.length, points.length));
  return (
    <>
      <BaseEdge id={id} path={path} interactionWidth={0} />
      {own.length > 0 && data?.branch !== undefined && (
        <path d={roundedPath([...own, { x: targetX, y: targetY }])} className={`react-flow__edge-path ${branchClass(data.branch)}`} fill="none" />
      )}
      <path
        d={`M ${last.x},${last.y} L ${targetX},${targetY}`}
        className="react-flow__edge-interaction"
        fill="none"
        stroke="transparent"
        strokeWidth={interactionWidth ?? 40}
      />
      {label && (
        <EdgeLabel>
          <button
            type="button"
            className="ladder-label nodrag nopan"
            style={{ transform: `translate(${targetX}px, ${targetY - (LADDER.labelSpace * scale) / 2 - 2}px) translate(-50%, -50%)` }}
            onClick={data?.onEdit}
            disabled={!data?.onEdit}
          >
            {label}
          </button>
        </EdgeLabel>
      )}
      {!label && <LinkAdd x={targetX} y={(last.y + targetY) / 2} onEdit={data?.onEdit} near={data?.near} />}
    </>
  );
}
