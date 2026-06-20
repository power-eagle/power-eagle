// @vitest-environment jsdom
import { describe, it, expect, afterEach } from 'vitest';
import React from 'react';
import { render, screen, cleanup } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { definePlugin, activatePlugin } from '../activate';
import { w } from '../widget';
import { createWidgetRegistry, PluginView } from './render';
import type { Widget } from '../types';

afterEach(cleanup);

describe('renderer behavior', () => {
  it('renders a plugin tree and updates the DOM on interaction', async () => {
    const mod = definePlugin({
      manifest: { id: 'counter', name: 'Counter', version: '1.0.0' },
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
            w('button', { children: 'increment', onPress: () => rt.run('inc') }),
          ],
        }),
    });

    const app = await activatePlugin(mod);
    const registry = createWidgetRegistry();
    render(React.createElement(PluginView, { app, registry }));

    expect(screen.getByText('count: 0')).toBeTruthy();
    await userEvent.click(screen.getByText('increment'));
    expect(await screen.findByText('count: 1')).toBeTruthy();
  });

  it('tolerates non-array children from a generated plugin (single child / bare string)', async () => {
    // A generated (untrusted) tree whose `children` are not arrays — the w
    // builder would normalize these, but disk/AI plugins may not.
    const mod = definePlugin({
      manifest: { id: 'gen', name: 'Gen', version: '1.0.0' },
      state: () => ({}),
      view: () =>
        ({
          type: 'col',
          props: {},
          children: { type: 'col', props: {}, children: 'bare string child' },
        }) as unknown as Widget,
    });

    const app = await activatePlugin(mod);
    render(React.createElement(PluginView, { app, registry: createWidgetRegistry() }));

    expect(await screen.findByText('bare string child')).toBeTruthy();
  });
});
