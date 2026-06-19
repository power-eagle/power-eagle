import { describe, it, expect } from 'vitest';
import { createStore } from './state/store';
import { createRuntime } from './runtime';

describe('runtime', () => {
  it('run invokes a plugin action with rt and args; set mutates state', async () => {
    const store = createStore({ n: 0 });
    const rt = createRuntime(store, {
      async add(r, by: number) {
        r.set((d) => {
          d.n += by;
        });
      },
    });
    await rt.run('add', 5);
    expect(rt.get().n).toBe(5);
  });

  it('run rejects on an unknown action', async () => {
    const store = createStore({});
    const rt = createRuntime(store, {});
    await expect(rt.run('nope')).rejects.toThrow('unknown action');
  });
});
