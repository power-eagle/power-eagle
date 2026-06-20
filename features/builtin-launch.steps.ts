// @vitest-environment jsdom
import { expect } from 'vitest';
import React from 'react';
import { render, screen, cleanup } from '@testing-library/react';
import { loadFeature, describeFeature } from '@amiceli/vitest-cucumber';
import { BuiltinPluginView } from '../src/app/builtin-plugin-view';
import type { EagleHost } from '../src/plugins/eagle';

const feature = await loadFeature('features/builtin-launch.feature');

function fakeEagle(): EagleHost {
  return {
    createFile: async () => true,
    getRecentLibraries: async () => [],
    switchLibrary: async () => {},
    notify: async () => {},
  };
}

describeFeature(feature, ({ Scenario, AfterEachScenario }) => {
  AfterEachScenario(() => cleanup());

  Scenario('Launching a built-in plugin renders its view', ({ Given, When, Then }) => {
    Given('the host launches the built-in plugin "file-creator"', () => {
      render(
        React.createElement(BuiltinPluginView, {
          pluginId: 'file-creator',
          eagle: fakeEagle() as unknown as Record<string, unknown>,
        }),
      );
    });
    When('the plugin view settles', () => {
      // resolved by the findByText below
    });
    Then('the File Creator view is shown', async () => {
      expect(await screen.findByText('File Creator')).toBeTruthy();
    });
  });

  Scenario('Launching an unknown built-in shows a not-found message', ({ Given, When, Then }) => {
    Given('the host launches the built-in plugin "no-such-plugin"', () => {
      render(
        React.createElement(BuiltinPluginView, {
          pluginId: 'no-such-plugin',
          eagle: fakeEagle() as unknown as Record<string, unknown>,
        }),
      );
    });
    When('the plugin view settles', () => {
      // synchronous unknown-plugin branch
    });
    Then('an unknown-plugin message is shown', () => {
      expect(screen.getByText(/unknown plugin/iu)).toBeTruthy();
    });
  });
});
