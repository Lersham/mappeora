import { useEffect, useRef, useState, type KeyboardEvent, type MouseEvent, type PointerEvent, type ReactNode } from 'react';
import { useBackHandler } from '../lib/backButton';

interface Props {
  title: string;
  onClose(): void;
  children: ReactNode;
  className?: string;
}

const FOCUSABLE = 'button:not(:disabled), input:not(:disabled), select:not(:disabled), textarea:not(:disabled), a[href], [tabindex]:not([tabindex="-1"])';

/**
 * Keyboard and focus for a modal: focus goes inside when it opens and back
 * where it was when it closes, Tab stays inside, Esc closes it.
 */
export function useModal(onClose: () => void) {
  const ref = useRef<HTMLDivElement>(null);
  // Read while rendering, before a field inside takes the focus with autoFocus.
  const [opener] = useState(() => (document.activeElement instanceof HTMLElement ? document.activeElement : null));
  useEffect(() => {
    // A field with autoFocus already has it; otherwise the dialog itself.
    if (!ref.current?.contains(document.activeElement)) ref.current?.focus({ preventScroll: true });
    return () => {
      if (opener?.isConnected) opener.focus({ preventScroll: true });
    };
  }, [opener]);
  useBackHandler(onClose);

  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.defaultPrevented) return;
    if (e.key === 'Escape') {
      // Only the newest dialog: the event stops here.
      e.stopPropagation();
      e.preventDefault();
      onClose();
    } else if (e.key === 'Tab' && ref.current) {
      const all = [...ref.current.querySelectorAll<HTMLElement>(FOCUSABLE)].filter((el) => el.getClientRects().length > 0);
      if (all.length === 0) return;
      const [first, last] = [all[0], all[all.length - 1]];
      const at = document.activeElement;
      if (e.shiftKey && (at === first || at === ref.current)) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && at === last) {
        e.preventDefault();
        first.focus();
      }
    }
  };

  // Closes on a tap outside the card, not when a text selection that started
  // inside the card ends outside it.
  const downOutside = useRef(false);
  const backdrop = {
    onPointerDown: (e: PointerEvent) => void (downOutside.current = e.target === e.currentTarget),
    onClick: (e: MouseEvent) => {
      if (downOutside.current && e.target === e.currentTarget) onClose();
      downOutside.current = false;
    },
  };
  return { ref, onKeyDown, tabIndex: -1, ...backdrop };
}

/** Modal card; closes with Esc, Android's Back or by tapping outside. */
export function Dialog({ title, onClose, children, className = '' }: Props) {
  const modal = useModal(onClose);
  return (
    <div className="overlay" role="dialog" aria-modal="true" aria-label={title} {...modal}>
      <div className={`overlay-card ${className}`}>
        <h2 className="dialog-title">{title}</h2>
        {children}
      </div>
    </div>
  );
}
