import { useEffect, type ReactNode } from 'react';
import { useBackHandler } from '../lib/backButton';

interface Props {
  title: string;
  onClose(): void;
  children: ReactNode;
  className?: string;
}

/** Modal card; closes with Esc, Android's Back or by tapping outside. */
export function Dialog({ title, onClose, children, className = '' }: Props) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);
  useBackHandler(onClose);

  return (
    <div className="overlay" role="dialog" aria-modal="true" aria-label={title} onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className={`overlay-card ${className}`}>
        <h2 className="dialog-title">{title}</h2>
        {children}
      </div>
    </div>
  );
}
