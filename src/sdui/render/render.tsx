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

/** Register the minimal built-in widget catalog. */
function registerBuiltins(registry: Registry<WidgetComponent>): void {
  registry.register('text', ({ resolved }) =>
    React.createElement('span', null, String(resolved.data ?? '')),
  );
  registry.register('col', ({ children }) => React.createElement('div', { 'data-w': 'col' }, children));
  registry.register('row', ({ children }) => React.createElement('div', { 'data-w': 'row' }, children));
  registry.register('button', ({ resolved, node, children }) =>
    React.createElement(
      'button',
      { disabled: Boolean(resolved.disabled), onClick: node.on?.press as React.MouseEventHandler | undefined },
      children,
    ),
  );
}
