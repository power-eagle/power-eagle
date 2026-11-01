// @vitest-environment jsdom
import { cleanup, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createElement } from 'react';
import { expect, vi } from 'vitest';
import { describeFeature, loadFeature } from '@amiceli/vitest-cucumber';
import App from '../src/app/App';
import { createEagleCapabilities } from '../src/host/eagle-capabilities';

const feature = await loadFeature('features/workbench.feature');
describeFeature(feature, ({ Scenario, AfterEachScenario }) => {
  let user = userEvent.setup();
  let host = createEagleCapabilities();
  let values = new Map<string, string>();
  const open = async () => {
    user = userEvent.setup(); host = createEagleCapabilities(); values = new Map();
    host.library.history = vi.fn(async () => []);
    Object.defineProperty(window, 'localStorage', { configurable: true, value: {
      getItem: (key: string) => values.get(key) ?? null,
      setItem: (key: string, value: string) => values.set(key, value),
    } });
    render(createElement(App, { capabilities: host }));
    await screen.findByRole('button', { name: 'Increment' });
  };
  const countOne = async () => { await open(); await user.click(screen.getByRole('button', { name: 'Increment' })); await screen.findByText('Count: 1'); };
  const inspectKeyboard = async (name: string) => {
    screen.getByRole('button', { name: `Select package ${name}` }).focus();
    await user.keyboard('{Shift>}{F10}{/Shift}');
    const menu = await screen.findByRole('menuitem', { name: 'Inspect plugin…' });
    expect(document.activeElement).toBe(menu); await user.keyboard('{Enter}');
    await screen.findByRole('region', { name: 'Plugin details' });
  };
  AfterEachScenario(() => { cleanup(); vi.restoreAllMocks(); });

  Scenario('Filter sources without changing the running tool', ({ Given, When, Then }) => {
    Given('Runtime flow is open with a count of one', countOne);
    When('the source list is filtered to Clipboard and cleared', async () => {
      await user.type(screen.getByRole('searchbox', { name: 'Filter plugins' }), 'clipboard');
      expect(screen.queryByRole('button', { name: 'Select package Runtime flow' })).toBeNull();
      expect(screen.getByText('Count: 1')).toBeTruthy();
      await user.click(screen.getByRole('button', { name: 'Clear plugin filter' }));
    });
    Then('Runtime flow remains selected with its count intact', () => {
      expect(screen.getByRole('button', { name: 'Select package Runtime flow' }).getAttribute('aria-current')).toBe('page');
      expect(within(screen.getByRole('region', { name: 'Stage' })).getByText('Count: 1')).toBeTruthy();
    });
  });
  Scenario('Inspect another plugin using the keyboard and return', ({ Given, When, Then }) => {
    Given('Runtime flow is open with a count of one', countOne);
    When('Recent Libraries is inspected using the keyboard', async () => inspectKeyboard('Recent Libraries'));
    Then('its details are shown without starting its runtime', () => {
      expect(screen.getByRole('button', { name: 'Select package Recent Libraries' }).getAttribute('aria-current')).toBe('page');
      expect(screen.queryByRole('button', { name: 'Increment' })).toBeNull();
      expect(host.library.history).not.toHaveBeenCalled();
      expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Close plugin details' }));
    });
    When('Escape closes inspection', async () => user.keyboard('{Escape}'));
    Then('Runtime flow resumes with its count and source-row focus', () => {
      expect(screen.getByText('Count: 1')).toBeTruthy();
      expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Select package Runtime flow' }));
      expect(host.library.history).not.toHaveBeenCalled();
    });
  });
  Scenario('Recover a runtime whose required action is disabled', ({ Given, When, Then }) => {
    Given('File Creator is open', async () => { await open(); await user.click(screen.getByRole('button', { name: 'Select package File Creator' })); await screen.findByRole('button', { name: 'Create file' }); });
    When('its required create action is disabled in inspection', async () => {
      await inspectKeyboard('File Creator');
      await user.click(screen.getByRole('tab', { name: 'actions' }));
      await user.click(screen.getByRole('switch', { name: 'Disable export power-eagle.file-creator/create' }));
      await user.click(screen.getByRole('tab', { name: 'runtime' }));
    });
    Then('the runtime reports the disabled dependency and other sources remain usable', () => {
      expect(within(screen.getByRole('region', { name: 'File Creator activation' })).getByText('Required export power-eagle.file-creator/create is off')).toBeTruthy();
      expect(screen.getByRole('button', { name: 'Select package Runtime flow' })).toBeTruthy();
      expect(screen.queryByRole('button', { name: 'Create file' })).toBeNull();
    });
    When('the required export is enabled through recovery', async () => { await user.click(screen.getByRole('button', { name: 'Enable required export' })); await user.click(screen.getByRole('button', { name: 'Close plugin details' })); });
    Then('File Creator becomes available again and the choice survives reopening', async () => {
      await screen.findByRole('button', { name: 'Create file' });
      cleanup(); render(createElement(App, { capabilities: host }));
      await user.click(await screen.findByRole('button', { name: 'Select package File Creator' }));
      await waitFor(() => expect(screen.getByRole('button', { name: 'Create file' })).toBeTruthy());
    });
  });
});
