/* eslint-disable react-refresh/only-export-components -- Runtime renderers are registered as component factories. */
import * as React from 'react';
import { Button as UiButton, Tabs as UiTabs } from '../../components/ui';
import {
  Accordion, Breadcrumbs, Button, ContextMenu, IconButton, Menu, SegmentedControl, SplitPane, Tabs,
} from '../authoring/desktop';
import type { Json } from '../schema/model';
import { runtimeIcons } from './content';
import type { WidgetDefinition } from './session';
import type { WidgetRenderProps } from './view';

const text = (value: Json | undefined, fallback = '') => typeof value === 'string' ? value : fallback;
const number = (value: Json | undefined, fallback = 0) => typeof value === 'number' ? value : fallback;
const bool = (value: Json | undefined, fallback = false) => typeof value === 'boolean' ? value : fallback;
const object = (value: Json | undefined): Record<string, Json> => value && typeof value === 'object' && !Array.isArray(value) ? value : {};
const strings = (value: Json | undefined): string[] => Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : [];
const children = (slot: React.ReactNode): React.ReactNode[] => React.Children.toArray(slot);
const only = (slot: React.ReactNode): React.ReactNode => children(slot)[0];

interface Choice { value: string; label: string; disabled: boolean }
function choices(value: Json | undefined): Choice[] {
  return Array.isArray(value) ? value.map(item => {
    const option = object(item);
    return { value: text(option.value), label: text(option.label), disabled: bool(option.disabled) };
  }) : [];
}

interface MenuEntry { id: string; label: string; shortcut: string; disabled: boolean; destructive: boolean; separatorBefore: boolean }
function menuEntries(value: Json | undefined): MenuEntry[] {
  return Array.isArray(value) ? value.map(item => {
    const entry = object(item);
    return {
      id: text(entry.id), label: text(entry.label), shortcut: text(entry.shortcut), disabled: bool(entry.disabled),
      destructive: bool(entry.destructive), separatorBefore: bool(entry.separatorBefore),
    };
  }) : [];
}

const buttonVariant = (value: Json | undefined) => text(value, 'default') as 'default' | 'secondary' | 'outline' | 'ghost' | 'destructive';
const buttonSize = (value: Json | undefined) => ({ small: 'sm', large: 'lg', default: 'default' }[text(value, 'default')] ?? 'default') as 'sm' | 'default' | 'lg';

function ButtonWidget({ props, events, style }: WidgetRenderProps) {
  const busy = bool(props.busy);
  return <UiButton
    data-pe-widget="Button" variant={buttonVariant(props.variant)} size={buttonSize(props.size)}
    type={text(props.buttonType, 'button') as 'button' | 'submit' | 'reset'} style={style}
    disabled={bool(props.disabled) || busy} aria-busy={busy || undefined} autoFocus={bool(props.autofocus)}
    title={text(props.tooltip) || undefined}
    onClick={() => void events.press?.(null)}
    onFocus={() => void events.focus?.(true)} onBlur={() => void events.focus?.(false)}
  >{text(props.label)}{busy && <span aria-hidden="true">…</span>}</UiButton>;
}

function IconButtonWidget({ props, events, style }: WidgetRenderProps) {
  const selected = bool(props.selected);
  const iconName = selected && text(props.selectedIcon) ? text(props.selectedIcon) : text(props.icon);
  const Glyph = runtimeIcons[iconName];
  const label = text(props.label);
  return <UiButton
    data-pe-widget="IconButton" variant={buttonVariant(props.variant)} size="icon" style={{ ...style, ...(text(props.size) === 'small' ? { width: 'var(--control-sm)', height: 'var(--control-sm)' } : text(props.size) === 'large' ? { width: 'var(--control-lg)', height: 'var(--control-lg)' } : {}) }}
    disabled={bool(props.disabled)} autoFocus={bool(props.autofocus)} aria-label={label} aria-pressed={selected || undefined}
    title={text(props.tooltip) || label}
    onClick={() => void events.press?.(null)}
    onFocus={() => void events.focus?.(true)} onBlur={() => void events.focus?.(false)}
  ><Glyph aria-hidden="true" size={18} /></UiButton>;
}

function SegmentedControlWidget({ props, events, style }: WidgetRenderProps) {
  const options = choices(props.options);
  const value = text(props.value);
  const disabled = bool(props.disabled);
  const buttons = React.useRef<Array<HTMLButtonElement | null>>([]);
  const choose = (option: Choice) => { if (!disabled && !option.disabled) void events.change?.(option.value); };
  const move = (event: React.KeyboardEvent<HTMLButtonElement>, index: number) => {
    if (!['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Home', 'End'].includes(event.key)) return;
    event.preventDefault();
    const enabled = options.map((option, itemIndex) => ({ option, itemIndex })).filter(entry => !entry.option.disabled);
    const current = enabled.findIndex(entry => entry.itemIndex === index);
    const delta = event.key === 'ArrowRight' || event.key === 'ArrowDown' ? 1 : -1;
    const next = event.key === 'Home' ? 0 : event.key === 'End' ? enabled.length - 1 : (current + delta + enabled.length) % enabled.length;
    const target = enabled[next];
    if (target) { buttons.current[target.itemIndex]?.focus(); choose(target.option); }
  };
  return <div data-pe-widget="SegmentedControl" role="radiogroup" aria-label={text(props.label)} className="pe-segmented" style={style}>
    {options.map((option, index) => <button
      ref={element => { buttons.current[index] = element; }} key={`${option.value}:${index}`} type="button" role="radio"
      aria-checked={value === option.value} tabIndex={value === option.value ? 0 : -1}
      disabled={disabled || option.disabled} className="pe-segmented-option"
      onClick={() => choose(option)} onKeyDown={event => move(event, index)}
    >{option.label}</button>)}
  </div>;
}

function TabsWidget({ props, events, style, slots }: WidgetRenderProps) {
  const options = choices(props.tabs);
  const value = text(props.value);
  const selected = options.findIndex(option => option.value === value);
  const panels = children(slots.children);
  const disabled = bool(props.disabled);
  return <div data-pe-widget="Tabs" className="pe-runtime-tabs" style={style}>
    <UiTabs
      aria-label={text(props.label)} value={value}
      items={options.map(option => ({ value: option.value, label: option.label, disabled: disabled || option.disabled }))}
      onValueChange={next => { if (!disabled) void events.change?.(next); }}
    />
    {selected >= 0 && <div className="pe-tab-panel" role="tabpanel" aria-label={options[selected].label}>{panels[selected]}</div>}
  </div>;
}

interface AccordionEntry { id: string; label: string; disabled: boolean }
function accordionEntries(value: Json | undefined): AccordionEntry[] {
  return Array.isArray(value) ? value.map(item => {
    const entry = object(item);
    return { id: text(entry.id), label: text(entry.label), disabled: bool(entry.disabled) };
  }) : [];
}

function AccordionWidget({ props, events, style, slots }: WidgetRenderProps) {
  const id = React.useId();
  const items = accordionEntries(props.items);
  const value = strings(props.value);
  const panels = children(slots.children);
  const disabled = bool(props.disabled);
  const multiple = bool(props.multiple);
  const buttons = React.useRef<Array<HTMLButtonElement | null>>([]);
  const toggle = (entry: AccordionEntry) => {
    if (disabled || entry.disabled) return;
    const next = value.includes(entry.id) ? value.filter(item => item !== entry.id) : multiple ? [...value, entry.id] : [entry.id];
    void events.change?.(next);
  };
  const move = (event: React.KeyboardEvent<HTMLButtonElement>, index: number) => {
    if (!['ArrowUp', 'ArrowDown', 'Home', 'End'].includes(event.key)) return;
    event.preventDefault();
    const enabled = items.map((item, itemIndex) => ({ item, itemIndex })).filter(entry => !entry.item.disabled);
    const current = enabled.findIndex(entry => entry.itemIndex === index);
    const next = event.key === 'Home' ? 0 : event.key === 'End' ? enabled.length - 1 :
      (current + (event.key === 'ArrowDown' ? 1 : -1) + enabled.length) % enabled.length;
    if (enabled[next]) buttons.current[enabled[next].itemIndex]?.focus();
  };
  return <div data-pe-widget="Accordion" className="pe-accordion" aria-label={text(props.label)} style={style}>
    {items.map((item, index) => {
      const open = value.includes(item.id);
      const triggerId = `${id}-trigger-${index}`;
      const panelId = `${id}-panel-${index}`;
      return <div className="pe-accordion-item" key={`${item.id}:${index}`}>
        <h3>
          <button
            ref={element => { buttons.current[index] = element; }} id={triggerId} type="button" className="pe-accordion-trigger"
            aria-expanded={open} aria-controls={panelId} disabled={disabled || item.disabled}
            onClick={() => toggle(item)} onKeyDown={event => move(event, index)}
          ><span>{item.label}</span><span aria-hidden="true">{open ? '−' : '+'}</span></button>
        </h3>
        <div id={panelId} role="region" aria-labelledby={triggerId} className="pe-accordion-panel" hidden={!open}>{panels[index]}</div>
      </div>;
    })}
  </div>;
}

function MenuPopup({ entries, placement, position, onSelect, onClose }: {
  entries: MenuEntry[];
  placement?: string;
  position?: { x: number; y: number };
  onSelect(entry: MenuEntry): void;
  onClose(restoreFocus: boolean): void;
}) {
  const menu = React.useRef<HTMLDivElement>(null);
  React.useEffect(() => {
    menu.current?.querySelector<HTMLButtonElement>('[role="menuitem"]:not(:disabled)')?.focus();
  }, []);
  const move = (event: React.KeyboardEvent<HTMLDivElement>) => {
    if (event.key === 'Escape') { event.preventDefault(); onClose(true); return; }
    if (!['ArrowUp', 'ArrowDown', 'Home', 'End'].includes(event.key)) return;
    event.preventDefault();
    const enabled = [...(menu.current?.querySelectorAll<HTMLButtonElement>('[role="menuitem"]:not(:disabled)') ?? [])];
    if (!enabled.length) return;
    const current = enabled.indexOf(document.activeElement as HTMLButtonElement);
    const next = event.key === 'Home' ? 0 : event.key === 'End' ? enabled.length - 1 :
      (current + (event.key === 'ArrowDown' ? 1 : -1) + enabled.length) % enabled.length;
    enabled[next]?.focus();
  };
  return <div
    ref={menu} role="menu" className="pe-menu-popup" data-placement={placement}
    style={position ? { position: 'fixed', left: position.x, top: position.y } : undefined}
    onKeyDown={move}
  >
    {entries.map((entry, index) => <React.Fragment key={`${entry.id}:${index}`}>
      {entry.separatorBefore && <div role="separator" className="pe-menu-separator" />}
      <button
        type="button" role="menuitem" className="pe-menu-item" data-destructive={entry.destructive || undefined}
        disabled={entry.disabled} onClick={() => onSelect(entry)}
      ><span>{entry.label}</span>{entry.shortcut && <kbd>{entry.shortcut}</kbd>}</button>
    </React.Fragment>)}
  </div>;
}

function MenuWidget({ props, events, style }: WidgetRenderProps) {
  const id = React.useId();
  const root = React.useRef<HTMLDivElement>(null);
  const trigger = React.useRef<HTMLButtonElement>(null);
  const [open, setOpen] = React.useState(false);
  const entries = menuEntries(props.items);
  const close = (restoreFocus: boolean) => {
    if (!open) return;
    setOpen(false);
    void events.close?.(null);
    if (restoreFocus) setTimeout(() => trigger.current?.focus(), 0);
  };
  const show = () => {
    if (bool(props.disabled) || open) return;
    setOpen(true);
    void events.open?.(null);
  };
  return <div
    ref={root} data-pe-widget="Menu" className="pe-menu" style={style}
    onBlur={event => { if (!root.current?.contains(event.relatedTarget as Node | null)) close(false); }}
  >
    <UiButton
      ref={trigger} variant="secondary" size="sm" disabled={bool(props.disabled)}
      aria-haspopup="menu" aria-expanded={open} aria-controls={id}
      onClick={() => open ? close(false) : show()}
      onKeyDown={event => { if (event.key === 'ArrowDown' || event.key === 'ArrowUp') { event.preventDefault(); show(); } }}
    >{text(props.label)}</UiButton>
    {open && <div id={id}><MenuPopup
      entries={entries} placement={text(props.placement, 'bottomStart')}
      onClose={close} onSelect={entry => { close(true); void events.select?.(entry.id); }}
    /></div>}
  </div>;
}

function ContextMenuWidget({ props, events, style, slots }: WidgetRenderProps) {
  const root = React.useRef<HTMLDivElement>(null);
  const [position, setPosition] = React.useState<{ x: number; y: number }>();
  const entries = menuEntries(props.items);
  const close = (restoreFocus: boolean) => {
    if (!position) return;
    setPosition(undefined);
    void events.close?.(null);
    if (restoreFocus) setTimeout(() => root.current?.focus(), 0);
  };
  const show = (x: number, y: number) => {
    if (bool(props.disabled)) return;
    setPosition({ x, y });
    void events.open?.(null);
  };
  return <div
    ref={root} data-pe-widget="ContextMenu" className="pe-context-menu" style={style} tabIndex={bool(props.disabled) ? -1 : 0}
    aria-label={text(props.label)}
    onBlur={event => { if (!root.current?.contains(event.relatedTarget as Node | null)) close(false); }}
    onContextMenu={event => { if (!bool(props.disabled)) { event.preventDefault(); show(event.clientX, event.clientY); } }}
    onKeyDown={event => {
      if (event.key === 'ContextMenu' || (event.shiftKey && event.key === 'F10')) {
        event.preventDefault();
        const rect = root.current?.getBoundingClientRect();
        show(rect?.left ?? 0, rect?.bottom ?? 0);
      }
    }}
  >
    {only(slots.child)}
    {position && <MenuPopup
      entries={entries} position={position} onClose={close}
      onSelect={entry => { close(true); void events.select?.(entry.id); }}
    />}
  </div>;
}

interface Crumb { id: string; label: string; current: boolean; disabled: boolean }
function crumbs(value: Json | undefined): Crumb[] {
  return Array.isArray(value) ? value.map(item => {
    const entry = object(item);
    return { id: text(entry.id), label: text(entry.label), current: bool(entry.current), disabled: bool(entry.disabled) };
  }) : [];
}

function BreadcrumbsWidget({ props, events, style }: WidgetRenderProps) {
  const disabled = bool(props.disabled);
  return <nav data-pe-widget="Breadcrumbs" className="pe-breadcrumbs" style={style} aria-label={text(props.label)}>
    <ol>{crumbs(props.items).map((item, index) => <li key={`${item.id}:${index}`}>
      {index > 0 && <span aria-hidden="true" className="pe-breadcrumb-separator">/</span>}
      {item.current ? <span aria-current="page">{item.label}</span> : <button
        type="button" disabled={disabled || item.disabled} onClick={() => void events.select?.(item.id)}
      >{item.label}</button>}
    </li>)}</ol>
  </nav>;
}

const clamp = (value: number, minimum: number, maximum: number) => Math.min(maximum, Math.max(minimum, value));

function SplitPaneWidget({ props, events, style, slots }: WidgetRenderProps) {
  const root = React.useRef<HTMLDivElement>(null);
  const [dragging, setDragging] = React.useState(false);
  const direction = text(props.direction, 'horizontal') === 'vertical' ? 'vertical' : 'horizontal';
  const minimum = clamp(number(props.minimumStart, 20), 0, 100);
  const maximum = Math.max(minimum, clamp(100 - number(props.minimumEnd, 20), 0, 100));
  const value = clamp(number(props.value, 50), minimum, maximum);
  const step = number(props.step, 5);
  const disabled = bool(props.disabled);
  const eventsRef = React.useRef(events);
  eventsRef.current = events;
  const latest = React.useRef(value);
  latest.current = value;
  const resize = React.useCallback((next: number) => {
    const bounded = Number(clamp(next, minimum, maximum).toFixed(4));
    latest.current = bounded;
    void eventsRef.current.resize?.(bounded);
  }, [maximum, minimum]);
  React.useEffect(() => {
    if (!dragging) return;
    const moved = (event: PointerEvent) => {
      const rect = root.current?.getBoundingClientRect();
      const size = direction === 'horizontal' ? rect?.width ?? 0 : rect?.height ?? 0;
      if (!rect || size <= 0) return;
      const offset = direction === 'horizontal' ? event.clientX - rect.left : event.clientY - rect.top;
      resize(offset / size * 100);
    };
    const ended = () => {
      setDragging(false);
      void eventsRef.current.resizeEnd?.(latest.current);
    };
    window.addEventListener('pointermove', moved);
    window.addEventListener('pointerup', ended, { once: true });
    return () => { window.removeEventListener('pointermove', moved); window.removeEventListener('pointerup', ended); };
  }, [direction, dragging, resize]);
  const grid = direction === 'horizontal'
    ? { gridTemplateColumns: `calc(${value}% - 3px) 6px minmax(0, 1fr)` }
    : { gridTemplateRows: `calc(${value}% - 3px) 6px minmax(0, 1fr)` };
  return <div
    ref={root} data-pe-widget="SplitPane" data-direction={direction} data-dragging={dragging || undefined}
    className="pe-split-pane" style={{ ...grid, ...style }}
  >
    <div className="pe-split-pane-content pe-split-pane-start">{only(slots.start)}</div>
    <div
      role="separator" className="pe-split-pane-divider" tabIndex={disabled ? -1 : 0}
      aria-label={text(props.label)} aria-orientation={direction} aria-valuemin={minimum} aria-valuemax={maximum}
      aria-valuenow={value} aria-valuetext={`${value}%`}
      onPointerDown={event => {
        if (disabled) return;
        event.preventDefault();
        latest.current = value;
        setDragging(true);
        void events.resizeStart?.(value);
      }}
      onKeyDown={event => {
        if (disabled) return;
        const decrease = direction === 'horizontal' ? 'ArrowLeft' : 'ArrowUp';
        const increase = direction === 'horizontal' ? 'ArrowRight' : 'ArrowDown';
        if (event.key === decrease) { event.preventDefault(); resize(value - step); }
        else if (event.key === increase) { event.preventDefault(); resize(value + step); }
        else if (event.key === 'Home') { event.preventDefault(); resize(minimum); }
        else if (event.key === 'End') { event.preventDefault(); resize(maximum); }
      }}
    />
    <div className="pe-split-pane-content pe-split-pane-end">{only(slots.end)}</div>
  </div>;
}

const renderers: Record<string, WidgetDefinition['render']> = {
  Button: ButtonWidget,
  IconButton: IconButtonWidget,
  SegmentedControl: SegmentedControlWidget,
  Tabs: TabsWidget,
  Accordion: AccordionWidget,
  Menu: MenuWidget,
  ContextMenu: ContextMenuWidget,
  Breadcrumbs: BreadcrumbsWidget,
  SplitPane: SplitPaneWidget,
};
const contracts = { Button, IconButton, SegmentedControl, Tabs, Accordion, Menu, ContextMenu, Breadcrumbs, SplitPane };
export const desktopRuntimeWidgets: Record<string, WidgetDefinition> = Object.fromEntries(
  Object.entries(contracts).map(([type, widget]) => [type, { contract: widget.contract, render: renderers[type] }]),
);
