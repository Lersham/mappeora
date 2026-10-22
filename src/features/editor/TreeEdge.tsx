import { memo, useSyncExternalStore } from 'react';
import { BaseEdge, EdgeText, getBezierPath, getSmoothStepPath, Position, type Edge, type EdgeProps } from '@xyflow/react';
import { useSettings } from '../../store/settingsStore';
import { LinkAdd } from './LinkAdd';
import { sameEdgeProps } from './edgeMemo';

export type TreeEdgeData = { onEdit?: () => void; near?: boolean };
export type TreeFlowEdge = Edge<TreeEdgeData, 'tree'>;

// Every font that finishes loading (OpenDyslexic chosen later, too) means a new
// measure of the linking words. One listener for all the lines: with a few
// hundred of them, one each is a few hundred calls for every font.
let fontsLoaded = 0;
const fontListeners = new Set<() => void>();
const fontsChanged = () => {
  fontsLoaded++;
  fontListeners.forEach((l) => l());
};

function subscribeToFonts(listener: () => void) {
  const fonts = typeof document === 'undefined' ? undefined : document.fonts;
  if (!fonts) return () => {};
  fontListeners.add(listener);
  // The first line also catches the fonts that were still loading before it was there.
  if (fontListeners.size === 1) {
    void fonts.ready.then(fontsChanged);
    fonts.addEventListener('loadingdone', fontsChanged);
  }
  return () => {
    fontListeners.delete(listener);
    if (fontListeners.size === 0) fonts.removeEventListener('loadingdone', fontsChanged);
  };
}

const fontsVersion = () => fontsLoaded;

/**
 * React Flow's usual curved line. Its linking words are measured once, so
 * they are measured again when the reading settings or the font change the
 * size of the text: otherwise the white box behind them stays too small.
 * From a left side to a left side (an extra line going up on a sheet) it is
 * a bracket in the margin instead: a curve would cut through the concepts in
 * between, with its «+» on one of them.
 */
function TreeEdgeView({ id, label, labelBgPadding, labelBgBorderRadius, interactionWidth, markerEnd, style, data, ...p }: EdgeProps<TreeFlowEdge>) {
  const bracket = p.sourcePosition === Position.Left && p.targetPosition === Position.Left;
  const [path, labelX, labelY] = bracket ? getSmoothStepPath({ ...p, offset: 24, borderRadius: 12 }) : getBezierPath(p);
  const look = useSettings((s) => `${s.font}|${s.uppercase}|${s.textScale}|${s.wideSpacing}`);
  const fontsVersionNow = useSyncExternalStore(subscribeToFonts, fontsVersion);
  return (
    <>
      <BaseEdge id={id} path={path} markerEnd={markerEnd} style={style} interactionWidth={interactionWidth} />
      {label && (
        <EdgeText
          key={`${look}|${fontsVersionNow}`}
          x={labelX}
          y={labelY}
          label={label}
          labelBgPadding={labelBgPadding}
          labelBgBorderRadius={labelBgBorderRadius}
        />
      )}
      {!label && <LinkAdd x={labelX} y={labelY} onEdit={data?.onEdit} near={data?.near} />}
    </>
  );
}

export const TreeEdge = memo(TreeEdgeView, sameEdgeProps);
