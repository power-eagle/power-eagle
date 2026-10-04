import { forwardRef, type ButtonHTMLAttributes } from 'react';
import { cn } from './classnames';

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'default' | 'secondary' | 'outline' | 'ghost' | 'destructive';
  size?: 'sm' | 'default' | 'lg' | 'icon';
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = 'default', size = 'default', type = 'button', className, ...props },
  ref,
) {
  return <button
    ref={ref}
    type={type}
    className={cn('pe-btn', `pe-btn-${variant}`, size !== 'default' && `pe-btn-${size}`, className)}
    {...props}
  />;
});
