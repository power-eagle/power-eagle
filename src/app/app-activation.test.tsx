// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createEagleCapabilities, type LibraryHistoryRecord } from '../host/eagle-capabilities';
import { StrictMode } from 'react';
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
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

async function inspect(name: string, user: ReturnType<typeof userEvent.setup>) {
  fireEvent.contextMenu(screen.getByRole('button', { name: `Select package ${name}` }));
  await user.click(screen.getByRole('menuitem', { name: 'Inspect plugin…' }));
}

describe('workbench activation stage', () => {
  it('keeps the running tool and its state while the source list is filtered', async () => {
    const user = userEvent.setup();
    render(<App />);
  await screen.findByRole('main');
    await user.click(await screen.findByRole('button', { name: 'Increment' }));
    await user.type(screen.getByRole('searchbox', { name: 'Filter plugins' }), 'clipboard');
    expect(screen.queryByRole('button', { name: 'Select package Runtime flow' })).toBeNull();
    expect(screen.getByText('Count: 1')).toBeTruthy();
    await user.click(screen.getByRole('button', { name: 'Clear plugin filter' }));
    expect(screen.getByRole('button', { name: 'Select package Runtime flow' }).getAttribute('aria-current')).toBe('page');
    expect(screen.getByText('Count: 1')).toBeTruthy();
  });

  it('retains the live screen and state while inspecting another plugin without starting it', async () => {
    const user = userEvent.setup();
    const host = createEagleCapabilities();
    host.library.history = vi.fn(async () => []);
    render(<App capabilities={host} />);
    await user.click(await screen.findByRole('button', { name: 'Increment' }));
    await user.click(screen.getByRole('button', { name: 'Open details' }));
    await screen.findByText('Opened at count 1');
    await inspect('Recent Libraries', user);
    expect(screen.getByRole('region', { name: 'Plugin details' })).toBeTruthy();
    expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Close plugin details' }));
    expect(screen.queryByRole('button', { name: 'Back' })).toBeNull();
    expect(screen.getByRole('button', { name: 'Select package Recent Libraries' }).getAttribute('aria-current')).toBe('page');
    expect(host.library.history).not.toHaveBeenCalled();
    expect(screen.getAllByRole('tab').map(tab => tab.textContent)).toEqual(['runtime', 'actions']);
    await user.click(screen.getByRole('tab', { name: 'actions' }));
    expect(screen.getByRole('switch', { name: 'Disable export power-eagle.recent-libraries/history' })).toBeTruthy();
    expect(screen.getByRole('switch', { name: 'Disable export power-eagle.recent-libraries/switch' })).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Open screen home' })).toBeNull();
    await user.keyboard('{ArrowLeft}{Escape}');
    expect(screen.getByRole('region', { name: 'Stage' })).toBeTruthy();
    expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Select package Runtime flow' }));
    expect(screen.getByText('Opened at count 1')).toBeTruthy();
    await user.click(screen.getByRole('button', { name: 'Back' }));
    expect(await screen.findByText('Count: 1')).toBeTruthy();
    expect(host.library.history).not.toHaveBeenCalled();
  });

  it('opens screens explicitly and ordinary selection exits inspection', async () => {
    const user = userEvent.setup();
    render(<App />);
    await user.click(await screen.findByRole('button', { name: 'Increment' }));
    await user.click(screen.getByRole('button', { name: 'Open details' }));
    await screen.findByText('Opened at count 1');
    await inspect('Runtime flow', user);
    await user.click(screen.getByRole('button', { name: 'Open screen home' }));
    expect(screen.queryByRole('region', { name: 'Plugin details' })).toBeNull();
    expect(await screen.findByText('Count: 1')).toBeTruthy();
    await inspect('Runtime flow', user);
    await user.click(screen.getByRole('button', { name: 'Select package File Creator' }));
    expect(await screen.findByRole('textbox', { name: /File name/ })).toBeTruthy();
    expect(screen.queryByRole('region', { name: 'Plugin details' })).toBeNull();
    await user.click(screen.getByRole('button', { name: 'Select package Runtime flow' }));
    expect(await screen.findByText('Count: 0')).toBeTruthy();
  });

  it('keeps an in-flight runtime mounted while details is open', async () => {
    const user = userEvent.setup();
    const host = createEagleCapabilities();
    let finish!: (records: LibraryHistoryRecord[]) => void;
    host.library.history = vi.fn(() => new Promise<LibraryHistoryRecord[]>(resolve => { finish = resolve; }));
    render(<App capabilities={host} />);
    await screen.findByRole('main');
    await user.click(screen.getByRole('button', { name: 'Select package Recent Libraries' }));
    await inspect('File Creator', user);
    await act(async () => finish([{ id: 'one', name: 'Design', path: 'C:/Design.library', status: 'available' }]));
    expect(screen.queryByRole('button', { name: 'Open Design' })).toBeNull();
    await user.click(screen.getByRole('button', { name: 'Close plugin details' }));
    expect(await screen.findByRole('button', { name: 'Open Design' })).toBeTruthy();
    expect(host.library.history).toHaveBeenCalledTimes(1);
  });

  it('invalidates a disabled live runtime and restores close focus when its row is filtered out', async () => {
    const user = userEvent.setup();
    render(<App />);
    await user.click(await screen.findByRole('button', { name: 'Increment' }));
    await inspect('Runtime flow', user);
    const details = within(screen.getByRole('region', { name: 'Plugin details' }));
    await user.click(details.getByRole('switch', { name: 'Disable package Runtime flow' }));
    await user.type(screen.getByRole('searchbox', { name: 'Filter plugins' }), 'file');
    await user.click(screen.getByRole('button', { name: 'Close plugin details' }));
    expect(document.activeElement).toBe(screen.getByRole('searchbox', { name: 'Filter plugins' }));
    expect(screen.queryByRole('button', { name: 'Increment' })).toBeNull();
    await user.click(screen.getByRole('button', { name: 'Enable package' }));
    expect(await screen.findByText('Count: 0')).toBeTruthy();
  });

  it('opens real built-in controls and routes their operations through the supplied host', async () => {
    const user = userEvent.setup();
    const host = createEagleCapabilities();
    host.files.createText = vi.fn(async () => ({ status: 'created' as const, path: 'C:/notes.md' }));
    host.library.history = vi.fn(async () => [{ id: 'one', name: 'Design', path: 'C:/Design.library', status: 'available' as const }]);
    host.library.switch = vi.fn(async path => ({ path, switched: true }));
    host.assets.list = vi.fn(async () => []);
    render(<App capabilities={host} />);
    await screen.findByRole('main');

    await user.click(screen.getByRole('button', { name: 'Select package File Creator' }));
    await user.type(await screen.findByRole('textbox', { name: /File name/u }), 'notes');
    await user.click(screen.getByRole('button', { name: 'Use .md' }));
    await user.click(screen.getByRole('button', { name: 'Create file' }));
    await waitFor(() => expect(host.files.createText).toHaveBeenCalledWith('notes.md', '# notes\n\n'));
    expect(await screen.findByText('Created C:/notes.md')).toBeTruthy();

    await user.click(screen.getByRole('button', { name: 'Select package Recent Libraries' }));
    const filter = await screen.findByRole('searchbox', { name: 'Filter by name or path' });
    await user.type(filter, 'absent');
    expect(await screen.findByText('No matching libraries')).toBeTruthy();
    await user.clear(filter);
    await user.click(await screen.findByRole('button', { name: 'Open Design' }));
    await waitFor(() => expect(host.library.switch).toHaveBeenCalledWith('C:/Design.library', expect.any(AbortSignal)));
    expect(await screen.findByText('Opened C:/Design.library')).toBeTruthy();
    expect(screen.queryByRole('region', { name: 'Recent Libraries activation' })).toBeNull();

    await inspect('Recent Libraries', user);
    await user.click(screen.getByRole('tab', { name: 'actions' }));
    expect(screen.getByRole('region', { name: 'Recent Libraries activation' })).toBeTruthy();
    await user.click(screen.getByRole('button', { name: 'Select package Asset Browser' }));
    expect(await screen.findByText('Loaded 0 Eagle assets.')).toBeTruthy();
    expect(host.assets.list).toHaveBeenCalled();
  });

  it('does not publish a pending view after switching tools and starts a fresh session on return', async () => {
    const user = userEvent.setup();
    const host = createEagleCapabilities();
    let finish!: (value: LibraryHistoryRecord[]) => void;
    host.library.history = vi.fn(() => new Promise<LibraryHistoryRecord[]>(resolve => { finish = resolve; }));
    render(<StrictMode><App capabilities={host} /></StrictMode>);
    await screen.findByRole('main');
    await user.click(screen.getByRole('button', { name: 'Select package Recent Libraries' }));
    expect(screen.getByText('Opening Recent Libraries…').getAttribute('role')).toBe('status');
    await user.click(screen.getByRole('button', { name: 'Select package File Creator' }));
    await act(async () => finish([]));
    expect(await screen.findByRole('textbox', { name: /File name/u })).toBeTruthy();
    expect(screen.queryByRole('searchbox', { name: 'Filter by name or path' })).toBeNull();
    await user.click(screen.getByRole('button', { name: 'Select package Recent Libraries' }));
    await act(async () => finish([]));
    expect(await screen.findByRole('searchbox', { name: 'Filter by name or path' })).toBeTruthy();
    expect(host.library.history).toHaveBeenCalledTimes(4);
  });

  it('revokes a built-in runtime when its action is disabled and recovers into its usable view', async () => {
    const user = userEvent.setup();
    const host = createEagleCapabilities();
    host.library.history = vi.fn(async () => []);
    render(<App capabilities={host} />);
    await screen.findByRole('main');
    await user.click(screen.getByRole('button', { name: 'Select package Recent Libraries' }));
    await screen.findByRole('searchbox', { name: 'Filter by name or path' });
    await inspect('Recent Libraries', user);
    await user.click(screen.getByRole('tab', { name: 'actions' }));
    await user.click(screen.getByRole('switch', { name: 'Disable export power-eagle.recent-libraries/history' }));
    await user.click(screen.getByRole('tab', { name: 'runtime' }));
    const inspector = within(screen.getByRole('region', { name: 'Recent Libraries activation' }));
    expect(screen.queryByRole('searchbox', { name: 'Filter by name or path' })).toBeNull();
    await user.click(inspector.getByRole('button', { name: /Enable required export/u }));
    await user.click(screen.getByRole('button', { name: 'Close plugin details' }));
    expect(await screen.findByRole('searchbox', { name: 'Filter by name or path' })).toBeTruthy();
  });

  it('keeps in-view navigation and the source selection in sync without resetting runtime state', async () => {
    const user = userEvent.setup();
    render(<App />);
  await screen.findByRole('main');
    await user.click(await screen.findByRole('button', { name: 'Increment' }));
    await user.click(screen.getByRole('button', { name: 'Open details' }));
    expect(await screen.findByText('Opened at count 1')).toBeTruthy();
    expect(screen.getByText('built-in · revision 1 · detail')).toBeTruthy();
    await user.click(screen.getByRole('button', { name: 'Back' }));
    expect(await screen.findByText('Count: 1')).toBeTruthy();
    expect(screen.getByText('built-in · revision 1 · home')).toBeTruthy();
  });

  it('replaces an off runtime with inspection and restores it through persisted recovery', async () => {
    const user = userEvent.setup();
    render(<App />);
  await screen.findByRole('main');
    expect(screen.getByText('Count: 0')).toBeTruthy();

    await user.click(screen.getByRole('switch', { name: 'Disable package Runtime flow' }));
    expect(screen.getByRole('region', { name: 'Runtime flow summary' })).toBeTruthy();
    expect(screen.getAllByText('Plugin is disabled').length).toBeGreaterThan(0);
    expect(JSON.parse(window.localStorage.getItem('power-eagle.instances.v1') ?? '{}')).toMatchObject({
      format: 'power-eagle/instance-preferences', formatVersion: 1, instances: { 'builtin.example.runtime-flow': false },
    });

    await user.click(screen.getByRole('button', { name: 'Enable package' }));
    expect(screen.getByText('Count: 0')).toBeTruthy();
  });
});
