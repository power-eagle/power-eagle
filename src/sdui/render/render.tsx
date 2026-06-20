/**
 * Registry-driven renderer: turns a Widget tree into React elements.
 *
 * Props that are accessors are read (making them reactive); `node.on` handlers
 * are wired to DOM events; `when` gates rendering. `PluginView` subscribes to
 * the plugin store and re-renders the tree on any change (coarse reactivity —
 * the spec-sanctioned first cut; per-node subscription is a later optimization).
 */
import React from 'react';
import type { Widget, Theme } from '../types';
import type { Runtime } from '../runtime';
import type { Store } from '../state/store';
import { createRegistry, type Registry } from '../registry';
import { makeAccessor } from '../state/reactive';
import { styleForNode, mergeThemes, EMPTY_THEME } from '../theme';

/** The active theme for rendering; provide a value to restyle the widget tree. */
export const ThemeContext = React.createContext<Theme>(EMPTY_THEME);

/**
 * A widget render component: receives resolved props, the node, its computed
 * style, the runtime, and rendered children. A styling plugin contributes these
 * by widget `type` to overload an existing widget or insert a new one.
 */
export type WidgetComponent = (p: {
  node: Widget;
  resolved: Record<string, unknown>;
  style: React.CSSProperties;
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
  theme: Theme = EMPTY_THEME,
  key?: React.Key,
): React.ReactElement | null {
  if (node.when && !node.when()) {
    return null;
  }

  const children = node.for
    ? renderForEach(node, runtime, registry, theme)
    : node.children
      ? node.children.map((child, index) => renderNode(child, runtime, registry, theme, index))
      : null;

  const Component = registry.get(node.type);
  if (!Component) {
    return React.createElement('div', { key, 'data-unknown-widget': node.type }, `unknown widget: ${node.type}`);
  }

  return React.createElement(Component as React.FC<Parameters<WidgetComponent>[0]>, {
    key,
    node,
    resolved: resolveProps(node),
    style: styleForNode(node, theme) as React.CSSProperties,
    runtime,
    children,
  });
}

/** Render a `for`/`render` list: one rendered node per item, else the `empty` widget. */
function renderForEach(
  node: Widget,
  runtime: Runtime<Record<string, unknown>>,
  registry: Registry<WidgetComponent>,
  theme: Theme,
): React.ReactNode[] {
  const items = node.for!();
  if (items.length === 0) {
    return node.empty ? [renderNode(node.empty, runtime, registry, theme, 'empty')] : [];
  }
  return items.map((_, index) => {
    const itemAccessor = makeAccessor(() => node.for!()[index]);
    const indexAccessor = makeAccessor(() => index);
    const childNode = node.render!(itemAccessor, indexAccessor);
    const key = typeof childNode.key === 'function' ? childNode.key() : childNode.key ?? index;
    return renderNode(childNode, runtime, registry, theme, key);
  });
}

/** Root view for an activated plugin; re-renders on any store change. */
export function PluginView(props: {
  app: { store: Store<Record<string, unknown>>; runtime: Runtime<Record<string, unknown>>; theme?: Theme; view?: () => Widget };
  registry: Registry<WidgetComponent>;
}): React.ReactElement | null {
  const { app, registry } = props;
  const ambient = React.useContext(ThemeContext);
  // Cascade: ambient (builtin < user-global) < this plugin's own theme.
  const theme = app.theme ? mergeThemes(ambient, app.theme) : ambient;
  const [, force] = React.useReducer((tick: number) => tick + 1, 0);
  React.useEffect(() => app.store.subscribe(() => force()), [app]);
  // A service plugin has no view; nothing to render.
  return app.view ? renderNode(app.view(), app.runtime, registry, theme) : null;
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
  text: 'text-sm', // no color — inherit from container (button supplies its own foreground)
  button:
    'inline-flex items-center justify-center rounded-md border border-border bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:pointer-events-none disabled:opacity-50',
  input: 'w-full rounded-md border border-border bg-background px-3 py-1.5 text-sm text-foreground placeholder:text-muted-foreground',
} as const;

/** Register the minimal built-in widget catalog. */
function registerBuiltins(registry: Registry<WidgetComponent>): void {
  registry.register('text', ({ resolved, style }) =>
    React.createElement('span', { className: WIDGET_CLASS.text, style }, String(resolved.data ?? '')),
  );
  registry.register('col', ({ children, style }) =>
    React.createElement('div', { 'data-w': 'col', className: WIDGET_CLASS.col, style }, children),
  );
  registry.register('row', ({ children, style }) =>
    React.createElement('div', { 'data-w': 'row', className: WIDGET_CLASS.row, style }, children),
  );
  registry.register('button', ({ resolved, node, children, style }) =>
    React.createElement(
      'button',
      {
        type: 'button',
        className: WIDGET_CLASS.button,
        style,
        disabled: Boolean(resolved.disabled),
        onClick: node.on?.press as React.MouseEventHandler | undefined,
      },
      children,
    ),
  );
  registry.register('input', ({ resolved, node, style }) =>
    React.createElement('input', {
      className: WIDGET_CLASS.input,
      style,
      value: String(resolved.value ?? ''),
      placeholder: resolved.placeholder !== undefined ? String(resolved.placeholder) : undefined,
      disabled: Boolean(resolved.disabled),
      onChange: (event: React.ChangeEvent<HTMLInputElement>) => node.on?.input?.(event.target.value),
    }),
  );
  registry.register('list', ({ children, style }) =>
    React.createElement('div', { 'data-w': 'list', className: WIDGET_CLASS.list, style }, children),
  );
}
