/**
 * Registry-driven renderer: turns a Widget tree into React elements.
 *
 * Props that are accessors are read (making them reactive); `node.on` handlers
 * are wired to DOM events; `when` gates rendering. `PluginView` subscribes to
 * the plugin store and re-renders the tree on any change (coarse reactivity —
 * the spec-sanctioned first cut; per-node subscription is a later optimization).
 */
import React from 'react';
import type { Widget } from '../types';
import type { Runtime } from '../runtime';
import type { Store } from '../state/store';
import { createRegistry, type Registry } from '../registry';

/** A widget render component: receives resolved props, the node, runtime, and children. */
export type WidgetComponent = (p: {
  node: Widget;
  resolved: Record<string, unknown>;
  runtime: Runtime<Record<string, unknown>>;
  children: React.ReactNode;
}) => React.ReactElement | null;

/** Create a widget registry preloaded with the built-in catalog. */
export function createWidgetRegistry(): Registry<WidgetComponent> {
  const registry = createRegistry<WidgetComponent>();
  registerBuiltins(registry);
  return registry;
}

/** Read every accessor-valued prop; pass literals through unchanged. */
function resolveProps(node: Widget): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(node.props)) {
    out[key] = typeof value === 'function' ? (value as () => unknown)() : value;
  }
  return out;
}

/** Render one widget node (and its subtree) to a React element. */
export function renderNode(
  node: Widget,
  runtime: Runtime<Record<string, unknown>>,
  registry: Registry<WidgetComponent>,
  key?: React.Key,
): React.ReactElement | null {
  if (node.when && !node.when()) {
    return null;
  }

  const children = node.children
    ? node.children.map((child, index) => renderNode(child, runtime, registry, index))
    : null;

  const Component = registry.get(node.type);
  if (!Component) {
    return React.createElement('div', { key, 'data-unknown-widget': node.type }, `unknown widget: ${node.type}`);
  }

  return React.createElement(Component as React.FC<Parameters<WidgetComponent>[0]>, {
    key,
    node,
    resolved: resolveProps(node),
    runtime,
    children,
  });
}

/** Root view for an activated plugin; re-renders on any store change. */
export function PluginView(props: {
  app: { store: Store<Record<string, unknown>>; runtime: Runtime<Record<string, unknown>>; view: () => Widget };
  registry: Registry<WidgetComponent>;
}): React.ReactElement | null {
  const { app, registry } = props;
  const [, force] = React.useReducer((tick: number) => tick + 1, 0);
  React.useEffect(() => app.store.subscribe(() => force()), [app]);
  return renderNode(app.view(), app.runtime, registry);
}

/**
 * Baseline widget styling using the app's shadcn design tokens, so widgets are
 * laid out and themed consistently with the host shell. The reactive theme
 * cascade layers on top of these defaults.
 */
const WIDGET_CLASS = {
  col: 'flex flex-col gap-3',
  row: 'flex flex-row flex-wrap items-center gap-2',
  list: 'flex flex-col gap-2',
  empty: 'rounded-lg border border-dashed border-border bg-muted/30 px-4 py-6 text-center text-sm text-muted-foreground',
  text: 'text-sm text-foreground',
  button:
    'inline-flex items-center justify-center rounded-md border border-border bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:pointer-events-none disabled:opacity-50',
  input: 'w-full rounded-md border border-border bg-background px-3 py-1.5 text-sm text-foreground placeholder:text-muted-foreground',
} as const;

/** Register the minimal built-in widget catalog. */
function registerBuiltins(registry: Registry<WidgetComponent>): void {
  registry.register('text', ({ resolved }) =>
    React.createElement('span', { className: WIDGET_CLASS.text }, String(resolved.data ?? '')),
  );
  registry.register('col', ({ children }) =>
    React.createElement('div', { 'data-w': 'col', className: WIDGET_CLASS.col }, children),
  );
  registry.register('row', ({ children }) =>
    React.createElement('div', { 'data-w': 'row', className: WIDGET_CLASS.row }, children),
  );
  registry.register('button', ({ resolved, node, children }) =>
    React.createElement(
      'button',
      {
        type: 'button',
        className: WIDGET_CLASS.button,
        disabled: Boolean(resolved.disabled),
        onClick: node.on?.press as React.MouseEventHandler | undefined,
      },
      children,
    ),
  );
  registry.register('input', ({ resolved, node }) =>
    React.createElement('input', {
      className: WIDGET_CLASS.input,
      value: String(resolved.value ?? ''),
      placeholder: resolved.placeholder !== undefined ? String(resolved.placeholder) : undefined,
      disabled: Boolean(resolved.disabled),
      onChange: (event: React.ChangeEvent<HTMLInputElement>) => node.on?.input?.(event.target.value),
    }),
  );
  registry.register('list', ({ resolved, children }) =>
    React.createElement(
      'div',
      { 'data-w': 'list', className: WIDGET_CLASS.list },
      React.Children.count(children) > 0
        ? children
        : React.createElement('span', { 'data-w': 'empty', className: WIDGET_CLASS.empty }, String(resolved.empty ?? '')),
    ),
  );
}
