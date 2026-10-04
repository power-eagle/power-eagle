import { type ElementType, type HTMLAttributes } from 'react';
import { cn } from './classnames';

export interface SectionLabelProps extends HTMLAttributes<HTMLElement> {
  as?: ElementType;
}

export function SectionLabel({ as: Component = 'h3', className, ...props }: SectionLabelProps) {
  return <Component className={cn('pe-label', className)} {...props} />;
}
