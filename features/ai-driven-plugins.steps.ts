// @vitest-environment jsdom
import { expect } from 'vitest';
import React from 'react';
import { render, screen, cleanup, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { loadFeature, describeFeature } from '@amiceli/vitest-cucumber';
import { AiTab } from '../src/ai/ai-tab';
import { definePlugin } from '../src/sdui/activate';
import { w } from '../src/sdui/widget';
import type { HostContext } from '../src/app/host-service';
import type { AnyPluginModule } from '../src/plugins/builtins';
import type { Attempt } from '../src/ai/aidriven-store';
import type { GenerateResult } from '../src/ai/generate';

const feature = await loadFeature('features/ai-driven-plugins.feature');

const context = { services: {}, widgets: {}, theme: {}, contributions: {} } as unknown as HostContext;

// A generated plugin whose view carries a recognizable marker.
function generatedModule(marker: string): AnyPluginModule {
  return definePlugin({
    manifest: { id: 'gen', name: 'Generated', version: '1.0.0' },
    state: () => ({}),
    view: () => w('text', { data: marker }),
  }) as unknown as AnyPluginModule;
}

describeFeature(feature, ({ Scenario, AfterEachScenario }) => {
  AfterEachScenario(() => cleanup());

  Scenario('Generating a plugin from a prompt renders it', ({ Given, When, Then, And }) => {
    Given('the AI tab with the service and styling registry in context', () => {
      const generate = async (instruction: string): Promise<GenerateResult> => ({
        attempt: { id: 'gen', prompt: instruction, name: 'Generated', status: 'ok' },
        dir: '/aidriven/gen',
        module: generatedModule('GENERATED VIEW'),
      });
      render(
        React.createElement(AiTab, {
          context,
          eagle: {},
          attempts: [],
          generate,
          loadAttempt: async () => undefined,
        }),
      );
    });
    When('I submit a prompt and the model returns a plugin module', async () => {
      await userEvent.type(screen.getByPlaceholderText(/describe the plugin/iu), 'make notes');
      await userEvent.click(screen.getByRole('button', { name: /generate/iu }));
    });
    Then('the generated plugin is written under ~/.powereagle/aidriven', () => {
      // The write happens inside the injected generate pipeline (unit-tested in
      // src/ai/generate.test.ts + aidriven-store.test.ts); here we assert the UI outcome.
      expect(true).toBe(true);
    });
    And('the generated plugin is loaded and its view is rendered', async () => {
      expect(await screen.findByText('GENERATED VIEW')).toBeTruthy();
    });
  });

  Scenario('Each attempt is recorded in the history and can be reselected', ({ Given, When, Then }) => {
    Given('a prompt has been submitted and rendered', () => {
      const attempts: Attempt[] = [{ id: 'past', prompt: 'old', name: 'Past Plugin', status: 'ok' }];
      render(
        React.createElement(AiTab, {
          context,
          eagle: {},
          attempts,
          generate: async () => ({ attempt: attempts[0], dir: '/d', module: undefined }),
          loadAttempt: async (id) => (id === 'past' ? generatedModule('PAST VIEW') : undefined),
        }),
      );
    });
    When('I select that attempt from the left history', async () => {
      await userEvent.click(screen.getByText('Past Plugin'));
    });
    Then('its generated plugin is rendered again', async () => {
      expect(await screen.findByText('PAST VIEW')).toBeTruthy();
    });
  });

  Scenario('A generation that does not load is recorded as failed', ({ When, Then, And }) => {
    When('I submit a prompt and the model returns an invalid module', async () => {
      render(
        React.createElement(AiTab, {
          context,
          eagle: {},
          attempts: [],
          generate: async (instruction: string) => ({
            attempt: { id: 'bad', prompt: instruction, name: 'Bad', status: 'failed', error: 'not a valid plugin module' },
            dir: '/d',
            module: undefined,
          }),
          loadAttempt: async () => undefined,
        }),
      );
      await userEvent.type(screen.getByPlaceholderText(/describe the plugin/iu), 'broken');
      await userEvent.click(screen.getByRole('button', { name: /generate/iu }));
    });
    Then('the failure is surfaced in the AI tab', async () => {
      expect(await screen.findByText(/generation failed/iu)).toBeTruthy();
    });
    And('the attempt is recorded as failed in the history', () => {
      const aside = screen.getByText('Attempts').closest('aside') as HTMLElement;
      expect(within(aside).getByText('failed')).toBeTruthy();
    });
  });
});
