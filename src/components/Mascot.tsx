import mappa from '../assets/mascotte/mappa.webp';
import indica from '../assets/mascotte/indica.webp';
import esulta from '../assets/mascotte/esulta.webp';
import cerca from '../assets/mascotte/cerca.webp';
import ops from '../assets/mascotte/ops.webp';

/** Picture and its pixel size: the size reserves the space before the picture arrives. */
const POSES = {
  mappa: [mappa, 269, 360],
  indica: [indica, 268, 360],
  esulta: [esulta, 305, 360],
  cerca: [cerca, 225, 360],
  ops: [ops, 236, 360],
} as const;

export type Pose = keyof typeof POSES;

/**
 * The MappAmi character, next to words that already say everything: decoration
 * only (empty alt), so a screen reader skips it. Its size comes from the CSS height.
 */
export function Mascot({ pose, className = '' }: { pose: Pose; className?: string }) {
  const [src, width, height] = POSES[pose];
  return <img src={src} alt="" width={width} height={height} decoding="async" className={`mascot ${className}`} />;
}
