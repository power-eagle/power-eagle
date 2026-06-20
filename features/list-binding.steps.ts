// @vitest-environment jsdom
import { expect } from 'vitest';
import React from 'react';
import { render, screen, within, cleanup } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { loadFeature, describeFeature } from '@amiceli/vitest-cucumber';
import { definePlugin, activatePlugin, type ActivatedPlugin } from '../src/sdui/activate';
import { w } from '../src/sdui/widget';
import type { Accessor } from '../src/sdui/state/reactive';
import { createWidgetRegistry, PluginView } from '../src/sdui/render/render';

const feature = await loadFeature('features/list-binding.feature');

interface Item { id: string; label: string }
type S = { items: Item[]; picked: string };

function render_(app: ActivatedPlugin<S>): void {
  render(React.createElement(PluginView, { app, registry: createWidgetRegistry() }));
}

describeFeature(feature, ({ Scenario, AfterEachScenario }) => {
  AfterEachScenario(() => cleanup());

  Scenario('A for/render list renders one row per item using item data', ({ Given, When, Then }) => {
    let app: ActivatedPlugin<S>;
    Given('a plugin that lists two items with for/render', async () => {
      app = await activatePlugin(definePlugin<S>({
        manifest: { id: 'l1', name: 'L1', version: '1.0.0' },
        state: () => ({ items: [{ id: 'a', label: 'Apple' }, { id: 'b', label: 'Banana' }], picked: '' }),
        view: (s) =>
          w('list', {
            for: s.items,
            empty: w('text', { data: 'none' }),
            render: (item: Accessor<unknown>) =>
              w('row', { children: [w('text', { data: () => (item() as Item).label })] }),
          }),
      }));
    });
    When('the plugin is rendered', () => render_(app));
    Then("each item's label is shown", () => {
      expect(screen.getByText('Apple')).toBeTruthy();
      expect(screen.getByText('Banana')).toBeTruthy();
    });
  });

  Scenario('The empty widget shows when the collection is empty', ({ Given, When, Then }) => {
    let app: ActivatedPlugin<S>;
    Given('a plugin that lists an empty collection with an empty widget', async () => {
      app = await activatePlugin(definePlugin<S>({
        manifest: { id: 'l2', name: 'L2', version: '1.0.0' },
        state: () => ({ items: [], picked: '' }),
        view: (s) =>
          w('list', {
            for: s.items,
            empty: w('text', { data: 'nothing here' }),
            render: (item: Accessor<unknown>) => w('text', { data: () => (item() as Item).label }),
          }),
      }));
    });
    When('the plugin is rendered', () => render_(app));
    Then('the empty widget is shown', () => {
      expect(screen.getByText('nothing here')).toBeTruthy();
    });
  });

  Scenario('A per-item action receives the bound item', ({ Given, When, Then }) => {
    let app: ActivatedPlugin<S>;
    Given('a plugin that lists two items each with a pick action', async () => {
      app = await activatePlugin(definePlugin<S>({
        manifest: { id: 'l3', name: 'L3', version: '1.0.0' },
        state: () => ({ items: [{ id: 'a', label: 'Apple' }, { id: 'b', label: 'Banana' }], picked: '' }),
        actions: {
          pick(rt, it) {
            rt.set((d) => { d.picked = (it as Item).id; });
          },
        },
        view: (s, rt) =>
          w('list', {
            for: s.items,
            render: (item: Accessor<unknown>) =>
              w('row', {
                children: [
                  w('text', { data: () => (item() as Item).label }),
                  w('button', { children: 'pick', onPress: () => rt.run('pick', item()) }),
                ],
              }),
          }),
      }));
    });
    When('the user picks the second item', async () => {
      render_(app);
      const row = screen.getByText('Banana').closest('[data-w="row"]') as HTMLElement;
      await userEvent.click(within(row).getByText('pick'));
    });
    Then("the picked id is the second item's id", () => {
      expect(app.store.get().picked).toBe('b');
    });
  });
});
