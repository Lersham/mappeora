import { BigButton } from './BigButton';
import { canFullscreen, fullscreenProps, useFullscreen } from '../lib/fullscreen';

/** Full screen on and off. On a tablet there is no Esc: this is the way out. Hidden where full screen does not exist. */
export function FullscreenButton({ className }: { className?: string }) {
  const on = useFullscreen();
  if (!canFullscreen()) return null;
  return <BigButton {...fullscreenProps(on)} className={className} />;
}
