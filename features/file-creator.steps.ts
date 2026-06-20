// @vitest-environment jsdom
import { expect, vi } from 'vitest';
import React from 'react';
import { render, screen, within, cleanup } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { loadFeature, describeFeature } from '@amiceli/vitest-cucumber';
import { activatePlugin, type ActivatedPlugin } from '../src/sdui/activate';
import { createWidgetRegistry, PluginView } from '../src/sdui/render/render';
import { fileCreator, type FileCreatorState } from '../src/plugins/file-creator';
import type { EagleHost } from '../src/plugins/eagle';

const feature = await loadFeature('features/file-creator.feature');

function fakeEagle(): EagleHost & { createFile: ReturnType<typeof vi.fn> } {
  return {
    createFile: vi.fn(async () => true),
    getRecentLibraries: async () => [],
    switchLibrary: async () => {},
    notify: async () => {},
  };
}

async function mount(eagle: EagleHost): Promise<ActivatedPlugin<FileCreatorState>> {
  const app = await activatePlugin(fileCreator, eagle as unknown as Record<string, unknown>);
  render(React.createElement(PluginView, { app, registry: createWidgetRegistry() }));
  return app;
}

describeFeature(feature, ({ Scenario, AfterEachScenario }) => {
  AfterEachScenario(() => cleanup());

  Scenario('Adding an extension shows a new card', ({ Given, When, Then }) => {
    Given('an activated file-creator plugin rendered in the host', async () => {
      await mount(fakeEagle());
    });
    When('the user enters extension "md" and clicks Add Extension', async () => {
      await userEvent.clear(screen.getByPlaceholderText('Extension'));
      await userEvent.type(screen.getByPlaceholderText('Extension'), 'md');
      await userEvent.click(screen.getByText('Add Extension'));
    });
    Then('a card for ".md" is shown', () => {
      expect(screen.getByText('.md')).toBeTruthy();
    });
  });

  Scenario('Removing an extension removes its card', ({ Given, When, Then }) => {
    Given('an activated file-creator plugin rendered in the host', async () => {
      await mount(fakeEagle());
    });
    When('the user removes the ".txt" extension', async () => {
      const card = screen.getByText('.txt').closest('[data-w="row"]') as HTMLElement;
      await userEvent.click(within(card).getByText('Remove'));
    });
    Then('no card for ".txt" is shown', () => {
      expect(screen.queryByText('.txt')).toBeNull();
    });
  });

  Scenario('Creating a file invokes the host with the name and extension', ({ Given, When, Then }) => {
    const eagle = fakeEagle();
    Given('an activated file-creator plugin rendered in the host', async () => {
      await mount(eagle);
    });
    When('the user enters file name "notes" and extension "md" and clicks Create File', async () => {
      await userEvent.type(screen.getByPlaceholderText('File name'), 'notes');
      await userEvent.clear(screen.getByPlaceholderText('Extension'));
      await userEvent.type(screen.getByPlaceholderText('Extension'), 'md');
      await userEvent.click(screen.getByText('Create File'));
    });
    Then('the host createFile is called with "notes" and "md"', () => {
      expect(eagle.createFile).toHaveBeenCalledWith(
        expect.objectContaining({ fileName: 'notes', extension: 'md' }),
      );
    });
  });
});
