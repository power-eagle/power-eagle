import { forwardRef, type HTMLAttributes } from 'react';
import { cn } from './classnames';

export interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  variant?: 'default' | 'secondary' | 'destructive' | 'outline';
}

export const Badge = forwardRef<HTMLSpanElement, BadgeProps>(function Badge(
  { variant = 'default', className, ...props },
  ref,
) {
  return <span ref={ref} className={cn('pe-badge', `pe-badge-${variant}`, className)} {...props} />;
});
