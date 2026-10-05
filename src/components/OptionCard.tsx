import type { ReactNode } from 'react';
import { useReadAloud } from '../hooks/useReadAloud';

interface Props {
  icon: string;
  name: string;
  /** Shown after the name, not read: e.g. the school subject. */
  extra?: ReactNode;
  description: string;
  pressed?: boolean;
  disabled?: boolean;
  onClick(): void;
}

/** A big choice with its description, and a 🔊 beside it to hear both. */
export function OptionCard({ icon, name, extra, description, pressed, disabled, onClick }: Props) {
  const { readText } = useReadAloud();
  return (
    <div className={`option-card${pressed ? ' is-selected' : ''}`}>
      <button type="button" className="review-option" aria-pressed={pressed} disabled={disabled} onClick={onClick}>
        <span className="template-icon" aria-hidden>
          {icon}
        </span>
        <span className="template-name">
          {name}
          {extra}
        </span>
        <span className="template-desc">{description}</span>
      </button>
      <button type="button" className="icon-button" aria-label={`Leggi: ${name}`} onClick={() => void readText(`${name}. ${description}`)}>
        🔊
      </button>
    </div>
  );
}

/** Instructions with a 🔊 beside them. */
export function Listenable({ text, label = 'Ascolta', children }: { text: string; label?: string; children: ReactNode }) {
  const { readText } = useReadAloud();
  return (
    <div className="listenable">
      <div>{children}</div>
      <button type="button" className="icon-button" aria-label={label} onClick={() => void readText(text)}>
        🔊
      </button>
    </div>
  );
}
