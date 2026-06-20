/**
 * `definePlugin` (authoring entry) and `activatePlugin` (runtime assembly).
 *
 * `definePlugin` just captures the typed definition. `activatePlugin` wires the
 * store, the reactive scope (state + derived), and the runtime together, runs
 * `onMount`, and exposes `view()` which produces the widget tree on demand.
 */
import type { Widget, Theme } from './types';
import { createStore, type Store } from './state/store';
import { createScope, type Scope } from './state/reactive';
import { createRuntime, type ActionFn, type Runtime } from './runtime';

/** The typed plugin definition authored via `definePlugin`. */
export interface PluginDef<S extends object> {
  manifest: { id: string; name: string; version: string; keywords?: string[]; service?: boolean; styling?: boolean };
  state?: () => S;
  derived?: Record<string, (s: Readonly<S>) => unknown>;
  actions?: Record<string, ActionFn<S>>;
  theme?: Theme;
  onMount?: (rt: Runtime<S>) => unknown;
  // A UI plugin renders a view; a service plugin (manifest.service) exposes a surface.
  view?: (s: Scope<S>, rt: Runtime<S>) => Widget;
  provides?: (rt: Runtime<S>) => object;
}

/** A loaded plugin module: static manifest + the captured definition. */
export interface PluginModule<S extends object> {
  manifest: PluginDef<S>['manifest'];
  __def: PluginDef<S>;
}

/**
 * The three mutually-exclusive plugin kinds. A plugin is visual (renders a
 * view), a service (provides a surface), or styling (provides a theme) — never
 * more than one. Throws on the service+styling XOR violation.
 */
export function pluginKind(manifest: { service?: boolean; styling?: boolean }): 'visual' | 'service' | 'styling' {
  if (manifest.service && manifest.styling) {
    throw new Error('a plugin cannot be both a service and a styling plugin');
  }
  if (manifest.service) return 'service';
  if (manifest.styling) return 'styling';
  return 'visual';
}

/** Enforce the per-kind invariants (XOR of view / provides / theme by kind). */
function validatePluginDef<S extends object>(def: PluginDef<S>): void {
  const kind = pluginKind(def.manifest);
  if (kind === 'service') {
    if (def.view) throw new Error('a service plugin cannot have a view');
    if (def.theme) throw new Error('a service plugin cannot provide styling (theme)');
    if (!def.provides) throw new Error('a service plugin must provide a surface');
  } else if (kind === 'styling') {
    if (def.view) throw new Error('a styling plugin cannot have a view');
    if (def.provides) throw new Error('a styling plugin cannot provide a service surface');
    if (!def.theme) throw new Error('a styling plugin must provide a theme');
  } else {
    if (!def.view) throw new Error('a visual plugin must have a view');
    if (def.provides) throw new Error('a visual plugin cannot provide a service surface (mark it service: true)');
  }
}

/** Capture a typed plugin definition (validated against its kind; no side effects). */
export function definePlugin<S extends object>(def: PluginDef<S>): PluginModule<S> {
  validatePluginDef(def);
  return { manifest: def.manifest, __def: def };
}

/** A live plugin: its store, runtime, optional view (UI) or provided surface (service). */
export interface ActivatedPlugin<S extends object> {
  manifest: PluginDef<S>['manifest'];
  store: Store<S>;
  runtime: Runtime<S>;
  theme?: Theme;
  view?: () => Widget;
  provides?: object;
}

/** Assemble a live plugin from its module, the host eagle bridge, and resolvable services. */
export async function activatePlugin<S extends object>(
  module: PluginModule<S>,
  eagle: Record<string, unknown> = {},
  services: Record<string, unknown> = {},
): Promise<ActivatedPlugin<S>> {
  const def = module.__def;
  const store = createStore((def.state?.() ?? {}) as S);
  const scope = createScope(store, def.derived ?? {});
  const runtime = createRuntime(store, def.actions ?? {}, eagle, services);

  if (def.onMount) {
    await def.onMount(runtime);
  }

  const view = def.view;
  return {
    manifest: def.manifest,
    store,
    runtime,
    theme: def.theme,
    view: view ? () => view(scope, runtime) : undefined,
    provides: def.provides ? def.provides(runtime) : undefined,
  };
}
