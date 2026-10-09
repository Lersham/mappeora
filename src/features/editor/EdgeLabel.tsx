import { useMemo, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { EdgeLabelRenderer, useStore } from '@xyflow/react';

/**
 * React Flow's EdgeLabelRenderer looks for its layer with querySelector at
 * every change in the flow. With a few hundred lines that is most of each
 * frame of a drag. Same portal, looked up once.
 */
export function EdgeLabel({ children }: { children: ReactNode }) {
  const domNode = useStore((s) => s.domNode);
  const layer = useMemo(() => domNode?.querySelector<HTMLElement>('.react-flow__edgelabel-renderer') ?? null, [domNode]);
  return layer ? createPortal(children, layer) : <EdgeLabelRenderer>{children}</EdgeLabelRenderer>;
}
