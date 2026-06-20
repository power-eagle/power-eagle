// @vitest-environment jsdom
import { expect } from 'vitest';
import React from 'react';
import { render, screen, cleanup } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { loadFeature, describeFeature } from '@amiceli/vitest-cucumber';
import { definePlugin, activatePlugin, type ActivatedPlugin } from '../src/sdui/activate';
import { w } from '../src/sdui/widget';
import type { Accessor } from '../src/sdui/state/reactive';
import { createWidgetRegistry, PluginView } from '../src/sdui/render/render';

const feature = await loadFeature('features/widgets.feature');

describeFeature(feature, ({ Scenario, AfterEachScenario }) => {
  AfterEachScenario(() => cleanup());

  Scenario('Typing into an input writes back to the bound state', ({ Given, When, Then, And }) => {
    const registry = createWidgetRegistry();
    let app: ActivatedPlugin<{ name: string }>;

    Given('a plugin whose view binds an input to state.name', async () => {
      const mod = definePlugin<{ name: string }>({
        manifest: { id: 'in', name: 'In', version: '1.0.0' },
        state: () => ({ name: '' }),
        view: (s, rt) =>
          w('input', {
            value: s.name,
            placeholder: 'name',
            onInput: (v) => rt.set((d) => { d.name = v as string; }),
          }),
      });
      app = await activatePlugin(mod);
      render(React.createElement(PluginView, { app, registry }));
    });
    When('the user types "hello" into the input', async () => {
      await userEvent.type(screen.getByPlaceholderText('name'), 'hello');
    });
    Then('state.name is "hello"', () => {
      expect(app.store.get().name).toBe('hello');
    });
    And('the input shows "hello"', () => {
      expect((screen.getByPlaceholderText('name') as HTMLInputElement).value).toBe('hello');
    });
  });

  Scenario('A list renders one node per item', ({ Given, When, Then }) => {
    const registry = createWidgetRegistry();
    let app: ActivatedPlugin<{ items: string[] }>;

    Given('a plugin whose view lists state.items as text rows', async () => {
      const mod = definePlugin<{ items: string[] }>({
        manifest: { id: 'l', name: 'L', version: '1.0.0' },
        state: () => ({ items: ['a', 'b', 'c'] }),
        view: (s) =>
          w('list', {
            empty: 'nothing',
            children: s.items().map((it) => w('text', { key: it, data: it })),
          }),
      });
      app = await activatePlugin(mod);
    });
    When('the plugin is rendered', () => {
      render(React.createElement(PluginView, { app, registry }));
    });
    Then('the list shows one row per item', () => {
      const list = document.querySelector('[data-w="list"]') as HTMLElement;
      expect(list).toBeTruthy();
      expect(list.querySelectorAll('span').length).toBe(3);
    });
  });

  Scenario('A list shows its empty state when there are no items', ({ Given, When, Then }) => {
    const registry = createWidgetRegistry();
    let app: ActivatedPlugin<{ items: string[] }>;

    Given('a plugin whose view lists an empty state.items with an empty message', async () => {
      const mod = definePlugin<{ items: string[] }>({
        manifest: { id: 'le', name: 'LE', version: '1.0.0' },
        state: () => ({ items: [] }),
        view: (s) =>
          w('list', {
            for: s.items,
            empty: w('text', { data: 'No items yet' }),
            render: (it: Accessor<unknown>) => w('text', { data: () => String(it()) }),
          }),
      });
      app = await activatePlugin(mod);
    });
    When('the plugin is rendered', () => {
      render(React.createElement(PluginView, { app, registry }));
    });
    Then('the list shows the empty message', () => {
      expect(screen.getByText('No items yet')).toBeTruthy();
    });
  });
});
