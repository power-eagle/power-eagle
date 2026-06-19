/**
 * Reactive accessors and derived (computed) values over a {@link Store}.
 *
 * An accessor is a zero-arg getter that reads the current value; passing one
 * into a widget prop makes that prop reactive. `derived` memoizes a computed
 * value and recomputes it after the store changes (coarse invalidation — a
 * correct baseline; per-dependency tracking is a later optimization).
 */
import type { Store } from './store';

/** A reactive read; `.not()` derives the logical negation as another accessor. */
export interface Accessor<T> {
  (): T;
  not(): Accessor<boolean>;
}

/** Wrap a read function as an Accessor with a `.not()` helper. */
function makeAccessor<T>(read: () => T): Accessor<T> {
  const acc = (() => read()) as Accessor<T>;
  acc.not = () => makeAccessor(() => !read());
  return acc;
}

/** A memoized computed value over the store, recomputed after each change. */
export function derived<S extends object, T>(store: Store<S>, fn: (s: Readonly<S>) => T): Accessor<T> {
  let cached: T;
  let valid = false;
  store.subscribe(() => {
    valid = false;
  });
  return makeAccessor(() => {
    if (!valid) {
      cached = fn(store.get());
      valid = true;
    }
    return cached;
  });
}

/** The `s` argument passed to `view`/`derived`: accessors for state + derived, plus `not`. */
export type Scope<S extends object> = {
  [K in keyof S]: Accessor<S[K]>;
} & {
  not(a: Accessor<unknown>): Accessor<boolean>;
} & Record<string, Accessor<unknown>>;

/** Build a scope: one accessor per state key, plus the declared derived values. */
export function createScope<S extends object>(
  store: Store<S>,
  derivedDefs: Record<string, (s: Readonly<S>) => unknown> = {},
): Scope<S> {
  const scope = {} as Record<string, unknown>;

  for (const key of Object.keys(store.get())) {
    scope[key] = makeAccessor(() => (store.get() as Record<string, unknown>)[key]);
  }
  for (const [name, fn] of Object.entries(derivedDefs)) {
    scope[name] = derived(store, fn);
  }
  scope.not = (a: Accessor<unknown>) => makeAccessor(() => !a());

  return scope as Scope<S>;
}
