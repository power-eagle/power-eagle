import { forwardRef, type InputHTMLAttributes } from 'react';
import { cn } from './classnames';

export interface InputProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'size'> {
  size?: 'sm' | 'default';
}

export const Input = forwardRef<HTMLInputElement, InputProps>(function Input(
  { size = 'default', className, ...props },
  ref,
) {
  return <input ref={ref} className={cn('pe-input', size === 'sm' && 'pe-input-sm', className)} {...props} />;
});
