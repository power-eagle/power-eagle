/**
 * Reactive variable store for the SDUI v3 runtime.
 *
 * Holds a plugin's `state`, applies mutations through `set`, and notifies
 * subscribers. `batch` coalesces multiple writes into a single notification so
 * an action that touches several variables re-renders dependents once. This is
 * the foundation the accessor/`derived` layer (next cycle) builds on.
 */

/** Public store surface consumed by the runtime and the React binding layer. */
export interface Store<S extends object> {
  /** Current state snapshot (same reference; treat as read-only). */
  get(): Readonly<S>;
  /** Apply a mutation to the draft, then notify (or mark dirty inside a batch). */
  set(mutator: (draft: S) => void): void;
  /** Register a listener; returns an unsubscribe function. */
  subscribe(listener: () => void): () => void;
  /** Run `fn`, coalescing any writes it makes into one notification. */
  batch(fn: () => void): void;
}

/** Create a reactive store seeded from `initial`. */
export function createStore<S extends object>(initial: S): Store<S> {
  const state: S = structuredClone(initial);
  const listeners = new Set<() => void>();
  let batchDepth = 0;
  let dirty = false;

  /** Fire every subscriber once. */
  function notify(): void {
    for (const listener of listeners) {
      listener();
    }
  }

  return {
    get(): Readonly<S> {
      return state;
    },

    set(mutator: (draft: S) => void): void {
      mutator(state);
      if (batchDepth > 0) {
        dirty = true;
      } else {
        notify();
      }
    },

    subscribe(listener: () => void): () => void {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },

    batch(fn: () => void): void {
      batchDepth += 1;
      try {
        fn();
      } finally {
        batchDepth -= 1;
        if (batchDepth === 0 && dirty) {
          dirty = false;
          notify();
        }
      }
    },
  };
}
