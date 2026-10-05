// @vitest-environment jsdom
import { cleanup, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import App from './App';

const values = new Map<string, string>();
const storage: Storage = {
  get length() { return values.size; },
  clear: () => values.clear(),
  getItem: key => values.get(key) ?? null,
  key: index => [...values.keys()][index] ?? null,
  removeItem: key => { values.delete(key); },
  setItem: (key, value) => { values.set(key, value); },
};

beforeEach(() => {
  storage.clear();
  Object.defineProperty(window, 'localStorage', { configurable: true, value: storage });
});
afterEach(cleanup);

describe('workbench activation stage', () => {
  it('replaces an off runtime with inspection and restores it through persisted recovery', async () => {
    const user = userEvent.setup();
    render(<App />);
    expect(screen.getByText('Count: 0')).toBeTruthy();

    await user.click(screen.getByRole('switch', { name: 'Disable package Runtime flow' }));
    const inspector = screen.getByRole('region', { name: 'Runtime flow activation' });
    expect(within(inspector).getByText('Package example.runtime-flow is disabled')).toBeTruthy();
    expect(JSON.parse(window.localStorage.getItem('power-eagle.enablement.v1') ?? '{}')).toMatchObject({
      format: 'power-eagle/enablement', formatVersion: 1, packages: { 'example.runtime-flow': false },
    });

    await user.click(within(inspector).getByRole('button', { name: 'Enable package' }));
    expect(screen.getByText('Count: 0')).toBeTruthy();
  });
});
