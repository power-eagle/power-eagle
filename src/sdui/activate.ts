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
  manifest: { id: string; name: string; version: string; keywords?: string[] };
  state: () => S;
  derived?: Record<string, (s: Readonly<S>) => unknown>;
  actions?: Record<string, ActionFn<S>>;
  theme?: Theme;
  onMount?: (rt: Runtime<S>) => unknown;
  view: (s: Scope<S>, rt: Runtime<S>) => Widget;
}

/** A loaded plugin module: static manifest + the captured definition. */
export interface PluginModule<S extends object> {
  manifest: PluginDef<S>['manifest'];
  __def: PluginDef<S>;
}

/** Capture a typed plugin definition (no side effects). */
export function definePlugin<S extends object>(def: PluginDef<S>): PluginModule<S> {
  return { manifest: def.manifest, __def: def };
}

/** A live plugin: its store, runtime, and a lazy view builder. */
export interface ActivatedPlugin<S extends object> {
  manifest: PluginDef<S>['manifest'];
  store: Store<S>;
  runtime: Runtime<S>;
  theme?: Theme;
  view: () => Widget;
}

/** Assemble a live plugin from its module and the host eagle bridge. */
export async function activatePlugin<S extends object>(
  module: PluginModule<S>,
  eagle: Record<string, unknown> = {},
): Promise<ActivatedPlugin<S>> {
  const def = module.__def;
  const store = createStore(def.state());
  const scope = createScope(store, def.derived ?? {});
  const runtime = createRuntime(store, def.actions ?? {}, eagle);

  if (def.onMount) {
    await def.onMount(runtime);
  }

  return {
    manifest: def.manifest,
    store,
    runtime,
    theme: def.theme,
    view: () => def.view(scope, runtime),
  };
}
