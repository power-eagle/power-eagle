import { type ButtonHTMLAttributes, type ReactNode } from 'react';
import { cn } from './classnames';

export interface ChipProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'children'> {
  label?: ReactNode;
  active?: boolean;
  variant?: 'filter' | 'check';
  children?: ReactNode;
}

export function Chip({ label, active = false, variant = 'filter', className, children, type = 'button', ...props }: ChipProps) {
  const check = variant === 'check';
  return <button
    type={type}
    className={cn('pe-chip', check && 'pe-chip-check', className)}
    aria-pressed={active}
    {...props}
  >
    {check ? <span className="pe-chip-box" aria-hidden="true" /> : null}
    {label ?? children}
  </button>;
}
