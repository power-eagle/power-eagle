// @vitest-environment jsdom
import { act, cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createElement } from 'react';
import { expect } from 'vitest';
import { describeFeature, loadFeature } from '@amiceli/vitest-cucumber';
import flow from '../examples/runtime-flow/document';
import { foundationRuntimeCatalog } from '../src/sdui/runtime/foundation';
import { RuntimeSession } from '../src/sdui/runtime/session';
import { RuntimeView } from '../src/sdui/runtime/view';

const feature = await loadFeature('features/declarative-language.feature');
describeFeature(feature, ({ Scenario, AfterEachScenario }) => {
  let session: RuntimeSession;
  const givenRuntime = async () => {
    session = new RuntimeSession(flow, foundationRuntimeCatalog);
    render(createElement(RuntimeView, { session }));
  };
  AfterEachScenario(async () => { cleanup(); await session?.dispose(); });

  Scenario('A sequence exposes its prior result to the next action', ({ Given, When, Then }) => {
    Given('the runtime flow example is rendered', givenRuntime);
    When('the user activates Increment', async () => userEvent.click(screen.getByRole('button', { name: 'Increment' })));
    Then('the count and sequence result are displayed', async () => {
      await waitFor(() => expect(screen.getByText('Count: 1')).toBeTruthy());
      expect(screen.getByText('Sequence result: 1')).toBeTruthy();
      expect(screen.getByText('Increment status: success')).toBeTruthy();
    });
  });

  Scenario('Navigation passes parameters and back restores the prior view', ({ Given, When, Then }) => {
    Given('the runtime flow example is rendered', givenRuntime);
    When('the user increments, opens details, and returns', async () => {
      await userEvent.click(screen.getByRole('button', { name: 'Increment' }));
      await waitFor(() => expect(screen.getByText('Count: 1')).toBeTruthy());
      await userEvent.click(screen.getByRole('button', { name: 'Open details' }));
      await waitFor(() => expect(screen.getByText('Opened at count 1')).toBeTruthy());
      await userEvent.click(screen.getByRole('button', { name: 'Back' }));
    });
    Then('the home screen still displays the incremented count', async () => {
      await waitFor(() => expect(screen.getByText('Count: 1')).toBeTruthy());
    });
  });

  Scenario('Empty repeated content replaces keyed items', ({ Given, When, Then }) => {
    Given('the runtime flow example is rendered', givenRuntime);
    When('the bound item collection becomes empty', () => act(() => session.globalState.write(['items'], [])));
    Then('the declared empty content is displayed', async () => {
      await waitFor(() => expect(screen.getByText('Nothing here')).toBeTruthy());
      expect(screen.queryByText('Declarative widgets')).toBeNull();
    });
  });
});
