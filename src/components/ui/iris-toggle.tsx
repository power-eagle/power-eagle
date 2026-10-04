import type { MouseEvent } from 'react';
import { cn } from './classnames';

export interface IrisToggleProps {
  name: string;
  on: boolean;
  failed?: boolean;
  size?: 'sm' | 'lg';
  onToggle?: () => void;
}

export function IrisToggle({ name, on: requestedOn, failed = false, size = 'sm', onToggle }: IrisToggleProps) {
  const on = requestedOn && !failed;
  const label = failed ? `${name} failed to load` : `${on ? 'Disable' : 'Enable'} ${name}`;
  const toggle = (event: MouseEvent<HTMLButtonElement>) => {
    event.stopPropagation();
    onToggle?.();
  };
  return <button
    type="button"
    role="switch"
    aria-checked={on}
    aria-label={label}
    title={label}
    disabled={failed}
    className={cn('pe-iris', size === 'lg' && 'pe-iris-lg', failed ? 'pe-iris-failed' : on && 'pe-iris-on')}
    onClick={toggle}
  >
    <span className="pe-iris-dot" aria-hidden="true" />
  </button>;
}
