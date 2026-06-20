// @vitest-environment jsdom
import { expect } from 'vitest';
import React from 'react';
import { render, screen, cleanup } from '@testing-library/react';
import { loadFeature, describeFeature } from '@amiceli/vitest-cucumber';
import { PluginRuntimeView } from '../src/app/plugin-runtime-view';
import { getBuiltin, type AnyPluginModule } from '../src/plugins/builtins';
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

  Scenario('Rendering a resolved built-in plugin shows its view', ({ Given, When, Then }) => {
    Given('the host resolves and renders the built-in plugin "file-creator"', () => {
      const module = getBuiltin('file-creator');
      expect(module).toBeTruthy();
      render(
        React.createElement(PluginRuntimeView, {
          module: module as AnyPluginModule,
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

  Scenario('An unknown built-in id resolves to no module', ({ Given, Then }) => {
    let resolved: AnyPluginModule | undefined;
    Given('the host resolves the built-in plugin "no-such-plugin"', () => {
      resolved = getBuiltin('no-such-plugin');
    });
    Then('no plugin module is resolved', () => {
      expect(resolved).toBeUndefined();
    });
  });
});
