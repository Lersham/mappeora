import { BaseEdge, EdgeLabelRenderer, useInternalNode, type Edge, type EdgeProps, type InternalNode } from '@xyflow/react';

export type FreeEdgeData = { onEdit?: () => void };
export type FreeFlowEdge = Edge<FreeEdgeData, 'free'>;

/** Where the line from the centre of `node` towards `to` leaves its box. */
function borderPoint(node: InternalNode, to: { x: number; y: number }) {
  const { width = 0, height = 0 } = node.measured;
  const p = node.internals.positionAbsolute;
  const c = { x: p.x + width / 2, y: p.y + height / 2 };
  const [dx, dy] = [to.x - c.x, to.y - c.y];
  if (dx === 0 && dy === 0) return c;
  const t = Math.min(dx ? width / 2 / Math.abs(dx) : Infinity, dy ? height / 2 / Math.abs(dy) : Infinity);
  return { x: c.x + dx * t, y: c.y + dy * t };
}

const centre = (node: InternalNode) => ({
  x: node.internals.positionAbsolute.x + (node.measured.width ?? 0) / 2,
  y: node.internals.positionAbsolute.y + (node.measured.height ?? 0) / 2,
});

/**
 * Concepts placed by hand: a straight line between the two boxes, from
 * whichever side faces the other concept, with the linking words halfway.
 */
export function FreeEdge({ id, source, target, label, data, interactionWidth }: EdgeProps<FreeFlowEdge>) {
  const [from, to] = [useInternalNode(source), useInternalNode(target)];
  if (!from || !to) return null;
  const a = borderPoint(from, centre(to));
  const b = borderPoint(to, centre(from));
  const mid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
  return (
    <>
      <BaseEdge id={id} path={`M ${a.x},${a.y} L ${b.x},${b.y}`} interactionWidth={interactionWidth} />
      {label && (
        <EdgeLabelRenderer>
          <button
            type="button"
            className="ladder-label nodrag nopan"
            style={{ transform: `translate(${mid.x}px, ${mid.y}px) translate(-50%, -50%)` }}
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
