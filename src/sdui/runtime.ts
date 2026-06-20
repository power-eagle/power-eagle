/**
 * The runtime facade (`rt`) passed to actions and `onMount`. It exposes state
 * read/write over the store and dispatches the plugin's own actions by name.
 * `eagle` carries the typed host bridge (filled by the host adapter).
 */
import type { Store } from './state/store';

/** Plugin action signature: receives the runtime, then the call args. */
export type ActionFn<S extends object> = (rt: Runtime<S>, ...args: unknown[]) => unknown;

/** The single context handed to actions and lifecycle hooks. */
export interface Runtime<S extends object = Record<string, unknown>> {
  get(): Readonly<S>;
  set(mutator: (draft: S) => void): void;
  batch(fn: () => void): void;
  run(action: string, ...args: unknown[]): Promise<unknown>;
  eagle: Record<string, unknown>;
  /** Resolve a service plugin's provided surface by manifest id. */
  service<C = unknown>(id: string): C;
}

/** Build a runtime bound to a store, the plugin's action map, and resolvable services. */
export function createRuntime<S extends object>(
  store: Store<S>,
  actions: Record<string, ActionFn<S>>,
  eagle: Record<string, unknown> = {},
  services: Record<string, unknown> = {},
): Runtime<S> {
  const rt: Runtime<S> = {
    get: () => store.get(),
    set: (mutator) => store.set(mutator),
    batch: (fn) => store.batch(fn),
    eagle,
    run: async (action, ...args) => {
      const fn = actions[action];
      if (!fn) {
        throw new Error(`unknown action: ${action}`);
      }
      return fn(rt, ...args);
    },
    service: <C = unknown>(id: string): C => {
      if (!(id in services)) {
        throw new Error(`unknown service: ${id}`);
      }
      return services[id] as C;
    },
  };
  return rt;
}
