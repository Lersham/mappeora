import { useEffect, useState } from 'react';
import { BaseEdge, EdgeText, getBezierPath, type Edge, type EdgeProps } from '@xyflow/react';
import { useSettings } from '../../store/settingsStore';
import { LinkAdd } from './LinkAdd';

export type TreeEdgeData = { onEdit?: () => void };
export type TreeFlowEdge = Edge<TreeEdgeData, 'tree'>;

/**
 * React Flow's usual curved line. Its linking words are measured once, so
 * they are measured again when the reading settings or the font change the
 * size of the text: otherwise the white box behind them stays too small.
 */
export function TreeEdge({ id, label, labelBgPadding, labelBgBorderRadius, interactionWidth, markerEnd, style, data, ...p }: EdgeProps<TreeFlowEdge>) {
  const [path, labelX, labelY] = getBezierPath(p);
  const look = useSettings((s) => `${s.font}|${s.uppercase}|${s.textScale}|${s.wideSpacing}`);
  const [fontsReady, setFontsReady] = useState(false);
  useEffect(() => {
    let live = true;
    void document.fonts?.ready.then(() => live && setFontsReady(true));
    return () => void (live = false);
  }, []);
  return (
    <>
      <BaseEdge id={id} path={path} markerEnd={markerEnd} style={style} interactionWidth={interactionWidth} />
      {label && (
        <EdgeText
          key={`${look}|${fontsReady}`}
          x={labelX}
          y={labelY}
          label={label}
          labelBgPadding={labelBgPadding}
          labelBgBorderRadius={labelBgBorderRadius}
        />
      )}
      {!label && <LinkAdd x={labelX} y={labelY} onEdit={data?.onEdit} />}
    </>
  );
}
