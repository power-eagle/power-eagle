// @vitest-environment jsdom
import { expect } from 'vitest';
import React from 'react';
import { render, screen, cleanup } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { loadFeature, describeFeature } from '@amiceli/vitest-cucumber';
import { activatePlugin, type ActivatedPlugin } from '../src/sdui/activate';
import { createWidgetRegistry, PluginView } from '../src/sdui/render/render';
import { recentLibraries, type RecentLibrariesState } from '../src/plugins/recent-libraries';
import type { EagleHost } from '../src/plugins/eagle';

const feature = await loadFeature('features/recent-libraries.feature');

const TWO_LIBRARIES = ['/lib/Foo.library', '/lib/Projects.library'];

function fakeEagle(): EagleHost {
  return {
    createFile: async () => true,
    getRecentLibraries: async () => [...TWO_LIBRARIES],
    switchLibrary: async () => {},
    notify: async () => {},
  };
}

async function mount(): Promise<ActivatedPlugin<RecentLibrariesState>> {
  const app = await activatePlugin(recentLibraries, fakeEagle() as unknown as Record<string, unknown>);
  render(React.createElement(PluginView, { app, registry: createWidgetRegistry() }));
  return app;
}

describeFeature(feature, ({ Scenario, AfterEachScenario }) => {
  AfterEachScenario(() => cleanup());

  Scenario('Mounting loads recent libraries from the host', ({ Given, When, Then }) => {
    Given('an activated recent-libraries plugin whose host has two libraries', async () => {
      await mount();
    });
    When('the plugin is rendered', () => {
      // rendered inside mount()
    });
    Then('both library names are shown', () => {
      expect(screen.getByText('Foo')).toBeTruthy();
      expect(screen.getByText('Projects')).toBeTruthy();
    });
  });

  Scenario('Filtering narrows the visible libraries', ({ Given, When, Then }) => {
    Given('an activated recent-libraries plugin whose host has two libraries', async () => {
      await mount();
    });
    When('the user filters by "foo"', async () => {
      await userEvent.type(screen.getByPlaceholderText('Filter libraries...'), 'foo');
    });
    Then('only the matching library is shown', () => {
      expect(screen.getByText('Foo')).toBeTruthy();
      expect(screen.queryByText('Projects')).toBeNull();
    });
  });

  Scenario('Clearing invalid removes invalid libraries', ({ Given, When, Then }) => {
    Given('an activated recent-libraries plugin whose host has two libraries', async () => {
      await mount();
    });
    When('the user clicks Clear Invalid', async () => {
      await userEvent.click(screen.getByText('Clear Invalid'));
    });
    Then('the invalid library is removed', () => {
      expect(screen.queryByText('Projects')).toBeNull();
      expect(screen.getByText('Foo')).toBeTruthy();
    });
  });
});
