import type { ButtonHTMLAttributes } from 'react';

interface Props extends ButtonHTMLAttributes<HTMLButtonElement> {
  icon: string;
  label: string;
  variant?: 'default' | 'primary' | 'danger';
}

/** Large touch target (≥ 56px) with an icon *and* a word: never icon-only. */
export function BigButton({ icon, label, variant = 'default', className = '', ...rest }: Props) {
  return (
    <button type="button" className={`big-button ${variant} ${className}`} {...rest}>
      <span className="big-button-icon" aria-hidden>
        {icon}
      </span>
      <span className="big-button-label">{label}</span>
    </button>
  );
}
