import { type KeyboardEvent, type ReactNode } from 'react';
import { cn } from './classnames';

export interface TabsItem {
  value: string;
  label?: ReactNode;
  disabled?: boolean;
}

export interface TabsProps {
  items: Array<string | TabsItem>;
  value: string;
  onValueChange?: (value: string) => void;
  'aria-label'?: string;
  className?: string;
}

function itemValue(item: string | TabsItem): string { return typeof item === 'string' ? item : item.value; }

export function Tabs({ items, value, onValueChange, className, 'aria-label': ariaLabel }: TabsProps) {
  const selectAdjacent = (event: KeyboardEvent<HTMLButtonElement>, index: number) => {
    if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
    event.preventDefault();
    const enabled = items.map((item, itemIndex) => ({ item, itemIndex })).filter(entry => typeof entry.item === 'string' || !entry.item.disabled);
    const current = enabled.findIndex(entry => entry.itemIndex === index);
    const next = event.key === 'Home' ? 0 : event.key === 'End' ? enabled.length - 1 :
      (current + (event.key === 'ArrowRight' ? 1 : -1) + enabled.length) % enabled.length;
    const target = event.currentTarget.parentElement?.querySelectorAll<HTMLButtonElement>('[role="tab"]')[enabled[next]?.itemIndex];
    target?.focus();
    if (enabled[next]) onValueChange?.(itemValue(enabled[next].item));
  };
  return <div role="tablist" aria-label={ariaLabel} className={cn('pe-tabs', className)}>
    {items.map((entry, index) => {
      const item = typeof entry === 'string' ? { value: entry, label: entry } : { ...entry, label: entry.label ?? entry.value };
      return <button
        key={item.value}
        type="button"
        role="tab"
        className="pe-tab"
        aria-selected={value === item.value}
        tabIndex={value === item.value ? 0 : -1}
        disabled={item.disabled}
        onClick={() => onValueChange?.(item.value)}
        onKeyDown={event => selectAdjacent(event, index)}
      >{item.label}</button>;
    })}
  </div>;
}
