import { describe, it, expect } from 'vitest';
import { definePlugin, activatePlugin } from './activate';
import { w } from './widget';

describe('definePlugin + activatePlugin (integration)', () => {
  it('activates: view renders a tree, action mutates state, derived reflects it', async () => {
    const mod = definePlugin({
      manifest: { id: 't', name: 'T', version: '1.0.0' },
      state: () => ({ count: 0 }),
      derived: { label: (s) => `count: ${s.count}` },
      actions: {
        async inc(rt) {
          rt.set((d) => {
            d.count += 1;
          });
        },
      },
      view: (s, rt) =>
        w('col', {
          children: [
            w('text', { data: s.label }),
            w('button', { children: '+', onPress: () => rt.run('inc') }),
          ],
        }),
    });

    const app = await activatePlugin(mod);
    const tree = app.view();
    expect(tree.type).toBe('col');

    const labelAccessor = (tree.children![0].props as { data: () => string }).data;
    expect(labelAccessor()).toBe('count: 0');

    await app.runtime.run('inc');
    expect(app.store.get().count).toBe(1);
    expect(labelAccessor()).toBe('count: 1');
  });

  it('exposes the plugin definition theme on the activated plugin', async () => {
    const theme = { tokens: {}, widgets: { button: { base: { background: '#123456' } } } };
    const mod = definePlugin({
      manifest: { id: 'th', name: 'Th', version: '1.0.0' },
      state: () => ({}),
      theme,
      view: () => w('button', { children: 'x' }),
    });

    const app = await activatePlugin(mod);
    expect(app.theme).toEqual(theme);
  });

  it('runs onMount during activation', async () => {
    const mod = definePlugin({
      manifest: { id: 'm', name: 'M', version: '1.0.0' },
      state: () => ({ ready: false }),
      actions: {
        async boot(rt) {
          rt.set((d) => {
            d.ready = true;
          });
        },
      },
      onMount: (rt) => rt.run('boot'),
      view: () => w('text', { data: 'x' }),
    });

    const app = await activatePlugin(mod);
    expect(app.store.get().ready).toBe(true);
  });
});
