// @vitest-environment jsdom
import { act, cleanup, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { createRequire } from 'node:module';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { WorkspaceStore, blankDocument } from '../host/workspaces/store';
import { PluginCatalog } from '../host/workspaces/catalog';
import { InstancePreferences } from '../host/workspaces/preferences';
import { sharedModules } from './plugin-catalog';
import App from './App';

const hostRequire = createRequire(import.meta.url);
let root: string;
let catalog: PluginCatalog;
beforeEach(async () => {
  Object.defineProperty(window, 'localStorage', { configurable: true, value: { getItem: () => null, setItem: () => {} } });
  mkdirSync('.artifacts', { recursive: true }); root = mkdtempSync(resolve('.artifacts/workspace-ui-'));
  writeFileSync(join(root, '.power-eagle-state.json'), JSON.stringify({ format: 'power-eagle/state', formatVersion: 1 }));
  const store = new WorkspaceStore(root, hostRequire);
  await store.create('Original'); await store.create('Second');
  catalog = new PluginCatalog(InstancePreferences.open({ read: () => null, write: () => {} }), { hostRequire, sharedModules }, store);
  await catalog.refresh();
});
afterEach(async () => { cleanup(); await catalog.dispose(); vi.restoreAllMocks(); rmSync(root, { recursive: true, force: true }); });

it('creates once, clears a hiding filter, selects the new plugin and restores focus on cancellation', async () => {
  const user = userEvent.setup(); render(<App catalog={catalog} />);
  await user.type(screen.getByRole('searchbox', { name: 'Filter plugins' }), 'absent');
  await user.click(screen.getByRole('button', { name: 'New plugin' }));
  expect(document.activeElement).toBe(screen.getByRole('menuitem', { name: 'Blank plugin' }));
  await user.keyboard('{Enter}');
  await user.clear(screen.getByLabelText('Name your plugin')); await user.type(screen.getByLabelText('Name your plugin'), 'Fresh');
  await user.dblClick(screen.getByRole('button', { name: 'Create' }));
  expect(await screen.findByRole('button', { name: 'Select package Fresh' })).toBeTruthy();
  expect(catalog.snapshot().entries.filter(item => item.instance.name === 'Fresh')).toHaveLength(1);
  expect(screen.getByRole('searchbox', { name: 'Filter plugins' }).getAttribute('value')).toBe('');
  expect(screen.getByRole('button', { name: 'Select package Fresh' }).getAttribute('aria-current')).toBe('page');
  await user.click(screen.getByRole('button', { name: 'New plugin' })); await user.keyboard('{Enter}{Escape}');
  expect(document.activeElement).toBe(screen.getByRole('button', { name: 'New plugin' }));
  expect(catalog.snapshot().entries).toHaveLength(3);
});

it('captures the source before selection changes, starts disabled and promotes an explicitly enabled copy', async () => {
  const user = userEvent.setup(); render(<App catalog={catalog} />);
  const source = catalog.snapshot().entries[0].instance;
  await user.click(screen.getByRole('button', { name: 'New plugin' })); await user.keyboard('{ArrowDown}{Enter}');
  await user.click(screen.getByRole('button', { name: 'Select package Second' }));
  await user.click(screen.getByRole('button', { name: 'Create' }));
  await screen.findByRole('button', { name: 'Select package Original copy' });
  const copy = catalog.snapshot().entries.find(item => item.instance.name === 'Original copy')!.instance;
  expect(copy.forkOf?.instanceId).toBe(source.instanceId);
  expect(catalog.snapshot().order.slice(0, 2)).toEqual([source.instanceId, copy.instanceId]);
  const sources = within(screen.getByRole('navigation', { name: 'Package sources' }));
  await user.click(sources.getByRole('switch', { name: 'Enable package Original copy' }));
  expect(await screen.findByText('Namespace owned by Original')).toBeTruthy();
  await user.type(screen.getByRole('searchbox', { name: 'Filter plugins' }), 'copy');
  expect(screen.getByRole('button', { name: 'Move above owner' }).hasAttribute('disabled')).toBe(true);
  await user.click(screen.getByRole('button', { name: 'Clear plugin filter' }));
  await user.click(screen.getByRole('button', { name: 'Move above owner' }));
  await waitFor(() => expect(catalog.snapshot().owners.get(source.namespace)?.instance.instanceId).toBe(copy.instanceId));
  expect(catalog.snapshot().entries).toHaveLength(3);
  await user.click(screen.getByRole('button', { name: 'Move Original copy down' }));
  await waitFor(() => expect(catalog.snapshot().owners.get(source.namespace)?.instance.instanceId).toBe(source.instanceId));
});

it('contains failed creation and cancels copying before publication', async () => {
  const user = userEvent.setup(); render(<App catalog={catalog} />);
  const create = vi.spyOn(catalog, 'create').mockRejectedValueOnce(new Error('disk full'));
  await user.click(screen.getByRole('button', { name: 'New plugin' })); await user.keyboard('{Enter}');
  await user.click(screen.getByRole('button', { name: 'Create' }));
  expect(await screen.findByRole('alert')).toBeTruthy();
  expect(screen.getByText('disk full')).toBeTruthy(); expect(catalog.snapshot().entries).toHaveLength(2);
  create.mockImplementationOnce(async (_name, _source, options) => new Promise((_resolve, reject) => {
    options?.signal?.addEventListener('abort', () => reject(new Error('cancelled')), { once: true });
  }));
  await user.click(screen.getByRole('button', { name: 'Create' }));
  await user.click(screen.getByRole('button', { name: 'Cancel' }));
  expect(screen.queryByRole('form', { name: 'Blank plugin' })).toBeNull();
  expect(catalog.snapshot().entries).toHaveLength(2);
});

it('keeps background Agent output with its plugin and restores drafts and selected revisions', async () => {
  const user = userEvent.setup();
  let finish!: (value: string) => void;
  const model = vi.fn(() => new Promise<string>(resolve => { finish = resolve; }));
  render(<App catalog={catalog} model={model} />);
  await user.type(screen.getByRole('textbox', { name: 'Describe this plugin' }), 'Make a greeting');
  await user.click(screen.getByRole('button', { name: 'Send' }));
  await waitFor(() => expect(model).toHaveBeenCalledOnce());
  await user.click(screen.getByRole('button', { name: 'Select package Second' }));
  await user.type(screen.getByRole('textbox', { name: 'Describe this plugin' }), 'Second draft');
  const output = blankDocument(); output.screens.home.body = { type: 'Text', props: { text: 'Hello from Original' } };
  await act(async () => finish(JSON.stringify(output)));
  await waitFor(() => expect(catalog.snapshot().entries[0].instance.currentRevision).toBe(2));
  expect(screen.getByRole('button', { name: 'Select package Second' }).getAttribute('aria-current')).toBe('page');
  expect((screen.getByRole('textbox', { name: 'Describe this plugin' }) as HTMLTextAreaElement).value).toBe('Second draft');
  expect(screen.queryByText('Hello from Original')).toBeNull();
  await user.click(screen.getByRole('button', { name: 'Select package Original' }));
  expect(await screen.findByText('Hello from Original')).toBeTruthy();
  expect(screen.getByRole('button', { name: 'v2' }).getAttribute('aria-pressed')).toBe('true');
  await user.click(screen.getByRole('button', { name: 'v1' }));
  await waitFor(() => expect(screen.queryByText('Hello from Original')).toBeNull());
  await user.click(screen.getByRole('button', { name: 'Select package Second' }));
  expect((screen.getByRole('textbox', { name: 'Describe this plugin' }) as HTMLTextAreaElement).value).toBe('Second draft');
});

