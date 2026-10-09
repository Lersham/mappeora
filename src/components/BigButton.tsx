import type { ButtonHTMLAttributes } from 'react';
import { Icon, type IconName } from './Icon';

interface Props extends ButtonHTMLAttributes<HTMLButtonElement> {
  icon: IconName;
  label: string;
  variant?: 'default' | 'primary' | 'danger';
}

/** Large touch target (≥ 56px) with an icon *and* a word: never icon-only. */
export function BigButton({ icon, label, variant = 'default', className = '', ...rest }: Props) {
  return (
    <button type="button" className={`big-button ${variant} ${className}`} {...rest}>
      <Icon name={icon} className="big-button-icon" />
      <span className="big-button-label">{label}</span>
    </button>
  );
}
