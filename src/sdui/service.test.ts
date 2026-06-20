import { describe, it, expect } from 'vitest';
import { definePlugin, activatePlugin } from './activate';
import { w } from './widget';

interface Greeter {
  greet(name: string): string;
}

const greeterService = definePlugin({
  manifest: { id: 'greeter', name: 'Greeter', version: '1.0.0', service: true },
  provides: () => ({ greet: (name: string) => `hi ${name}` }),
});

describe('service plugins', () => {
  it('exposes the provided surface and has no view when manifest.service is set', async () => {
    const app = await activatePlugin(greeterService);
    expect(app.manifest.service).toBe(true);
    expect((app.provides as Greeter).greet('ada')).toBe('hi ada');
    expect(app.view).toBeUndefined();
  });

  it('lets a UI plugin resolve a service surface via rt.service(id)', async () => {
    const svc = await activatePlugin(greeterService);
    const services = { greeter: svc.provides };

    const ui = definePlugin<{ msg: string }>({
      manifest: { id: 'u', name: 'U', version: '1.0.0' },
      state: () => ({ msg: '' }),
      actions: {
        hello(rt) {
          rt.set((d) => {
            d.msg = rt.service<Greeter>('greeter').greet('bob');
          });
        },
      },
      view: () => w('text', { data: 'x' }),
    });

    const app = await activatePlugin(ui, {}, services);
    await app.runtime.run('hello');
    expect(app.store.get().msg).toBe('hi bob');
  });

  it('throws when resolving an unknown service id', async () => {
    const ui = definePlugin({
      manifest: { id: 'u2', name: 'U2', version: '1.0.0' },
      state: () => ({}),
      view: () => w('text', { data: 'x' }),
    });
    const app = await activatePlugin(ui, {}, {});
    expect(() => app.runtime.service('nope')).toThrow(/unknown service/iu);
  });
});
