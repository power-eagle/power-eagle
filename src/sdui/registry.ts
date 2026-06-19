/**
 * A minimal keyed registry, used for both widgets and actions. Plugins and the
 * host register entries by name; the renderer/dispatcher look them up.
 */

/** A keyed lookup table with register/get/has. */
export interface Registry<V> {
  register(key: string, value: V): void;
  get(key: string): V | undefined;
  has(key: string): boolean;
}

/** Create an empty registry. */
export function createRegistry<V>(): Registry<V> {
  const map = new Map<string, V>();
  return {
    register(key, value) {
      map.set(key, value);
    },
    get(key) {
      return map.get(key);
    },
    has(key) {
      return map.has(key);
    },
  };
}
