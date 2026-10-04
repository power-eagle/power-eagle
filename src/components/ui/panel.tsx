import type { ReactNode } from 'react';
import { cn } from './classnames';

export interface PanelProps {
  index?: string;
  label: string;
  hint?: ReactNode;
  actions?: ReactNode;
  footer?: ReactNode;
  collapsed?: boolean;
  onToggleCollapsed?: () => void;
  className?: string;
  bodyClassName?: string;
  children?: ReactNode;
}

export function Panel({
  index, label, hint, actions, footer, collapsed = false, onToggleCollapsed, className, bodyClassName, children,
}: PanelProps) {
  const title = `${index ? `${index} / ` : ''}${label}`;
  if (collapsed) return <aside className={cn('pe-panel', 'pe-panel-collapsed', className)} aria-label={label}>
    <button type="button" className="pe-rail-btn" aria-label={`Expand ${label}`} onClick={onToggleCollapsed}>+</button>
    <span className="pe-label pe-panel-rail-label">{title}</span>
  </aside>;
  return <section className={cn('pe-panel', className)} aria-label={label}>
    <header className="pe-panel-bar">
      <span className="pe-panel-index">{title}</span>
      <span className="pe-panel-spacer" />
      {hint ? <span className="pe-panel-hint">{hint}</span> : null}
      {actions ? <span className="pe-panel-actions">{actions}</span> : null}
      {onToggleCollapsed ? <button type="button" className="pe-rail-btn" aria-label={`Collapse ${label}`} onClick={onToggleCollapsed}>−</button> : null}
    </header>
    <div className={cn('pe-panel-body', 'pe-scroll', bodyClassName)}>{children}</div>
    {footer ? <footer className="pe-panel-footer">{footer}</footer> : null}
  </section>;
}
