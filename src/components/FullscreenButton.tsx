import { useState } from 'react';
import { createPortal } from 'react-dom';
import { BigButton } from './BigButton';
import { Dialog } from './Dialog';
import { Icon } from './Icon';
import { canFullscreen, fullscreenProps, useFullscreen } from '../lib/fullscreen';
import { isAppleMobile, isHomeScreenApp, isNative } from '../services/platform';

/**
 * How full screen is had here: the browser's own («api»); on iPhone and iPad
 * the Home screen's («home»), because there a swipe down, even one that only
 * moves the map, leaves Safari's; or none (the apps, the Home screen itself).
 */
export function fullscreenKind(): 'api' | 'home' | null {
  if (isAppleMobile()) return isNative() || isHomeScreenApp() ? null : 'home';
  return canFullscreen() ? 'api' : null;
}

/** On iPhone and iPad «Schermo intero» explains the Home screen instead. */
export const homeFullscreenProps = (open: () => void) => ({ icon: 'fullscreen' as const, label: 'Schermo intero', title: 'Schermo intero', onClick: open });

export function FullscreenHint({ onClose }: { onClose(): void }) {
  return (
    <Dialog title="Schermo intero" onClose={onClose}>
      <p>
        Su iPhone e iPad MappAmi va a tutto schermo dalla schermata Home: tocca Condividi <Icon name="share" className="inline-icon" /> e poi
        «Aggiungi alla schermata Home». Poi aprila dalla sua icona: niente barre di Safari, anche quando sposti la mappa col dito.
      </p>
      {/* The steps on a page of their own; a new tab, so the open map and this dialog stay as they are. */}
      <p>
        <a href="/installa.html#ipad" target="_blank" rel="noopener" style={{ display: 'inline-block', padding: '10px 0', color: 'var(--primary)' }}>
          Guarda come si fa
        </a>
      </p>
      <div className="dialog-actions">
        <BigButton icon="check" label="Ho capito" variant="primary" onClick={onClose} />
      </div>
    </Dialog>
  );
}

/** Full screen on and off. On a tablet there is no Esc: this is the way out. Hidden where full screen does not exist. */
export function FullscreenButton({ className }: { className?: string }) {
  const on = useFullscreen();
  const [hint, setHint] = useState(false);
  const kind = fullscreenKind();
  if (!kind) return null;
  if (kind === 'api') return <BigButton {...fullscreenProps(on)} className={className} />;
  return (
    <>
      <BigButton {...homeFullscreenProps(() => setHint(true))} className={className} />
      {/* In the body, not here: the home header slides in with a transform, which would make it the frame of the window (a 60 px strip). */}
      {hint && createPortal(<FullscreenHint onClose={() => setHint(false)} />, document.body)}
    </>
  );
}
