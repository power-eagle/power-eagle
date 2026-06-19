import { describe, it, expect } from 'vitest';
import { createStore } from './store';
import { createScope, derived } from './reactive';

describe('reactive layer', () => {
  it('scope accessor reads live state', () => {
    const store = createStore({ name: 'a' });
    const s = createScope(store);
    expect(s.name()).toBe('a');
    store.set((d) => {
      d.name = 'b';
    });
    expect(s.name()).toBe('b');
  });

  it('derived recomputes after a change and memoizes between changes', () => {
    const store = createStore({ n: 1 });
    let calls = 0;
    const d = derived(store, (st) => {
      calls += 1;
      return st.n * 2;
    });
    expect(d()).toBe(2);
    expect(d()).toBe(2);
    expect(calls).toBe(1);

    store.set((x) => {
      x.n = 5;
    });
    expect(d()).toBe(10);
    expect(calls).toBe(2);
  });

  it('scope exposes derived values and a not() helper', () => {
    const store = createStore({ flag: false });
    const s = createScope(store, { isOff: (st) => !st.flag });
    expect(s.isOff()).toBe(true);
    expect(s.not(s.flag)()).toBe(true);
  });
});
