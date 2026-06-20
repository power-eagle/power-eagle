// @vitest-environment jsdom
import { expect } from 'vitest';
import React from 'react';
import { render, screen, cleanup } from '@testing-library/react';
import { loadFeature, describeFeature } from '@amiceli/vitest-cucumber';
import { definePlugin, activatePlugin, type ActivatedPlugin } from '../src/sdui/activate';
import { w } from '../src/sdui/widget';
import { createWidgetRegistry, PluginView, ThemeContext } from '../src/sdui/render/render';
import type { Theme } from '../src/sdui/types';

const feature = await loadFeature('features/theme.feature');

function styleAttr(label: string): string {
  return (screen.getByText(label).closest('button') as HTMLElement).getAttribute('style') ?? '';
}

async function renderUnder(theme: Theme, app: ActivatedPlugin<Record<string, unknown>>): Promise<void> {
  render(
    React.createElement(
      ThemeContext.Provider,
      { value: theme },
      React.createElement(PluginView, { app, registry: createWidgetRegistry() }),
    ),
  );
}

describeFeature(feature, ({ Scenario, AfterEachScenario }) => {
  AfterEachScenario(() => cleanup());

  Scenario('A loaded theme styles a widget via a token', ({ Given, And, When, Then }) => {
    let app: ActivatedPlugin<Record<string, unknown>>;
    let theme: Theme;

    Given('a plugin with a single button', async () => {
      const mod = definePlugin<Record<string, unknown>>({
        manifest: { id: 'b', name: 'B', version: '1.0.0' },
        state: () => ({}),
        view: () => w('button', { children: 'Go' }),
      });
      app = await activatePlugin(mod);
    });
    And('a theme that sets the button background to a color token', () => {
      theme = { tokens: { color: { brand: '#0066ff' } }, widgets: { button: { base: { background: 'color.brand' } } } };
    });
    When('the plugin is rendered under the theme', async () => {
      await renderUnder(theme, app);
    });
    Then('the rendered button carries the token-resolved background', () => {
      expect(styleAttr('Go')).toMatch(/#0066ff|rgb\(0,\s*102,\s*255\)/iu);
    });
  });

  Scenario('A per-instance style overrides the theme', ({ Given, And, When, Then }) => {
    let app: ActivatedPlugin<Record<string, unknown>>;
    let theme: Theme;

    Given('a plugin whose button carries a per-instance background override', async () => {
      const mod = definePlugin<Record<string, unknown>>({
        manifest: { id: 'bi', name: 'BI', version: '1.0.0' },
        state: () => ({}),
        view: () => w('button', { children: 'Go', theme: { background: '#abcdef' } }),
      });
      app = await activatePlugin(mod);
    });
    And('a theme that sets a different button background', () => {
      theme = { tokens: {}, widgets: { button: { base: { background: '#111111' } } } };
    });
    When('the plugin is rendered under the theme', async () => {
      await renderUnder(theme, app);
    });
    Then('the rendered button shows the per-instance background', () => {
      expect(styleAttr('Go')).toMatch(/#abcdef|rgb\(171,\s*205,\s*239\)/iu);
    });
  });
});
