import { describe, it, expect } from 'vitest';
import { createStore } from './store';

describe('signal store', () => {
  it('get() returns the initial state', () => {
    const store = createStore({ count: 1, name: 'a' });
    expect(store.get()).toEqual({ count: 1, name: 'a' });
  });

  it('set() applies a mutation and notifies subscribers once', () => {
    const store = createStore({ count: 0 });
    const seen: number[] = [];
    store.subscribe(() => seen.push(store.get().count));

    store.set((draft) => {
      draft.count = 5;
    });

    expect(store.get().count).toBe(5);
    expect(seen).toEqual([5]);
  });

  it('batch() coalesces multiple writes into a single notification', () => {
    const store = createStore({ a: 0, b: 0 });
    let notifications = 0;
    store.subscribe(() => {
      notifications += 1;
    });

    store.batch(() => {
      store.set((d) => {
        d.a = 1;
      });
      store.set((d) => {
        d.b = 2;
      });
    });

    expect(store.get()).toEqual({ a: 1, b: 2 });
    expect(notifications).toBe(1);
  });
});
