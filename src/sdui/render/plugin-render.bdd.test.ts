// @vitest-environment jsdom
import { expect } from 'vitest';
import React from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { loadFeature, describeFeature } from '@amiceli/vitest-cucumber';
import { definePlugin, activatePlugin, type ActivatedPlugin } from '../activate';
import { w } from '../widget';
import { createWidgetRegistry, PluginView } from './render';

const feature = await loadFeature('src/sdui/render/plugin-render.feature');

describeFeature(feature, ({ Scenario }) => {
  Scenario('An interaction updates the rendered UI', ({ Given, When, Then }) => {
    const registry = createWidgetRegistry();
    let app: ActivatedPlugin<{ count: number }>;

    Given('an activated counter plugin', async () => {
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
      app = await activatePlugin(mod);
      render(React.createElement(PluginView, { app, registry }));
      expect(screen.getByText('count: 0')).toBeTruthy();
    });

    When('the user clicks the increment button', async () => {
      await userEvent.click(screen.getByText('increment'));
    });

    Then('the counter label shows "count: 1"', async () => {
      expect(await screen.findByText('count: 1')).toBeTruthy();
    });
  });
});
