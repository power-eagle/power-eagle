// @vitest-environment jsdom
import { StrictMode } from 'react';
import { cleanup, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import App from './App';
import { PAPER_POP_IDENTITY } from '../plugins/paper-pop';
import { THEME_STORAGE_KEY } from './workbench-theme';

const values = new Map<string, string>();
const storage: Storage = {
  get length() { return values.size; }, clear: () => values.clear(),
  getItem: key => values.get(key) ?? null, key: index => [...values.keys()][index] ?? null,
  removeItem: key => { values.delete(key); }, setItem: (key, value) => { values.set(key, value); },
};
beforeEach(() => {
  storage.clear();
  Object.defineProperty(window, 'localStorage', { configurable: true, value: storage });
});
afterEach(() => { cleanup(); vi.restoreAllMocks(); });
const theme = () => screen.getByRole('main').getAttribute('data-theme');

it('starts with Paper Pop off, switches without remounting the tool, and persists choices across launches', async () => {
  const user = userEvent.setup();
  const app = render(<StrictMode><App /></StrictMode>);
  expect(theme()).toBe('blueprint');
  await user.click(screen.getByRole('switch', { name: 'Enable package Paper Pop' }));
  await user.selectOptions(screen.getByRole('combobox', { name: 'Theme' }), PAPER_POP_IDENTITY);
  await waitFor(() => expect(theme()).toBe(PAPER_POP_IDENTITY));
  expect(screen.getByRole('main').style.getPropertyValue('--background')).toBe('#fff9ef');
  await user.click(screen.getByRole('button', { name: 'Increment' }));
  await user.selectOptions(screen.getByRole('combobox', { name: 'Theme' }), '');
  expect(theme()).toBe('blueprint');
  expect(screen.getByText('Count: 1')).toBeTruthy();
  expect(screen.getByRole('main').style.getPropertyValue('--background')).toBe('');
  await user.selectOptions(screen.getByRole('combobox', { name: 'Theme' }), PAPER_POP_IDENTITY);
  expect(screen.getByText('Count: 1')).toBeTruthy();
  expect(theme()).toBe(PAPER_POP_IDENTITY);
  await user.selectOptions(screen.getByRole('combobox', { name: 'Theme' }), '');
  app.unmount();
  const restored = render(<App />);
  expect(theme()).toBe('blueprint');
  expect(JSON.parse(storage.getItem(THEME_STORAGE_KEY)!)).toMatchObject({ identity: '' });
  expect(screen.getByRole('switch', { name: 'Disable package Paper Pop' })).toBeTruthy();
  await user.selectOptions(screen.getByRole('combobox', { name: 'Theme' }), PAPER_POP_IDENTITY);
  restored.unmount();
  render(<App />);
  await waitFor(() => expect(theme()).toBe(PAPER_POP_IDENTITY));
});

it('revokes styling on package or export disablement and restores the remembered selection', async () => {
  const user = userEvent.setup();
  render(<App />);
  await user.click(screen.getByRole('switch', { name: 'Enable package Paper Pop' }));
  await user.selectOptions(screen.getByRole('combobox', { name: 'Theme' }), PAPER_POP_IDENTITY);
  await waitFor(() => expect(theme()).toBe(PAPER_POP_IDENTITY));
  await user.click(screen.getByRole('button', { name: 'Increment' }));
  const sources = within(screen.getByRole('navigation', { name: 'Package sources' }));
  await user.click(sources.getByRole('switch', { name: 'Disable package Paper Pop' }));
  expect(theme()).toBe('blueprint');
  expect(screen.getByText('Count: 1')).toBeTruthy();
  await user.click(sources.getByRole('switch', { name: 'Enable package Paper Pop' }));
  await waitFor(() => expect(theme()).toBe(PAPER_POP_IDENTITY));
  expect(screen.getByText('Count: 1')).toBeTruthy();
  await user.click(screen.getByRole('button', { name: 'Select package Paper Pop' }));
  await user.click(sources.getByRole('button', { name: 'Select styling contribution from Paper Pop' }));
  await user.click(sources.getByRole('switch', { name: `Disable export ${PAPER_POP_IDENTITY}` }));
  expect(theme()).toBe('blueprint');
  await user.click(sources.getByRole('switch', { name: `Enable export ${PAPER_POP_IDENTITY}` }));
  await waitFor(() => expect(theme()).toBe(PAPER_POP_IDENTITY));
});

it('keeps the chosen theme active when saving the preference fails', async () => {
  const user = userEvent.setup();
  render(<App />);
  await user.click(screen.getByRole('switch', { name: 'Enable package Paper Pop' }));
  await user.selectOptions(screen.getByRole('combobox', { name: 'Theme' }), PAPER_POP_IDENTITY);
  await waitFor(() => expect(theme()).toBe(PAPER_POP_IDENTITY));
  vi.spyOn(storage, 'setItem').mockImplementation(() => { throw new Error('quota'); });
  await user.selectOptions(screen.getByRole('combobox', { name: 'Theme' }), '');
  await user.selectOptions(screen.getByRole('combobox', { name: 'Theme' }), PAPER_POP_IDENTITY);
  expect(theme()).toBe(PAPER_POP_IDENTITY);
  expect(screen.getByText('Preference not saved')).toBeTruthy();
  expect(screen.queryByText('Using Blueprint')).toBeNull();
});
