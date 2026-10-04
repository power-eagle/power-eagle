import { forwardRef, type ButtonHTMLAttributes, type MouseEvent } from 'react';
import { cn } from './classnames';

export interface SwitchProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'onChange'> {
  checked?: boolean;
  onCheckedChange?: (checked: boolean) => void;
}

export const Switch = forwardRef<HTMLButtonElement, SwitchProps>(function Switch(
  { checked = false, onCheckedChange, onClick, className, type = 'button', ...props },
  ref,
) {
  const toggle = (event: MouseEvent<HTMLButtonElement>) => {
    onClick?.(event);
    if (!event.defaultPrevented) onCheckedChange?.(!checked);
  };
  return <button
    ref={ref}
    type={type}
    role="switch"
    aria-checked={checked}
    className={cn('pe-switch', className)}
    onClick={toggle}
    {...props}
  >
    <span className="pe-switch-thumb" aria-hidden="true" />
  </button>;
});
