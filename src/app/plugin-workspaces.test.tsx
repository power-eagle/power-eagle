// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
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
import { foundationRuntimeCatalog } from '../sdui/runtime/foundation';
import type { AgentProviders } from '../host/workspaces/agent-types';

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
afterEach(async () => { cleanup(); await catalog.dispose(); vi.restoreAllMocks(); vi.unstubAllGlobals(); rmSync(root, { recursive: true, force: true }); });

it('configures providers beside the conversation, restores details and focus, and persists independent preferences', async () => {
  const providers: AgentProviders = { available: async () => true, discover: vi.fn(async () => [{ id: 'a', label: 'Model A', isDefault: true, efforts: ['low', 'high'] }]), generate: async () => JSON.stringify(blankDocument()) };
  const user = userEvent.setup(); render(<App catalog={catalog} model={providers} />);
  const original = catalog.snapshot().entries[0].instance.instanceId;
  await user.type(screen.getByLabelText('Describe this plugin'), 'Keep draft');
  await user.click(screen.getByRole('button', { name: 'Agent settings' }));
  expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Close agent settings' }));
  expect(screen.getByText(/chat model is managed in Eagle/)).toBeTruthy();
  await user.selectOptions(screen.getByLabelText('Provider'), 'codex');
  await screen.findByText('Model A');
  await user.selectOptions(screen.getByLabelText('Model'), 'a');
  await user.selectOptions(screen.getByLabelText('Effort'), 'high');
  await waitFor(() => expect(catalog.store!.read().conversations[original].settings.codex).toEqual({ model: 'a', effort: 'high' }));
  await user.click(screen.getByRole('button', { name: 'Close agent settings' }));
  expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Agent settings' }));
  expect((screen.getByLabelText('Describe this plugin') as HTMLTextAreaElement).value).toBe('Keep draft');
  const source = screen.getByRole('button', { name: 'Select package Original' });
  fireEvent.contextMenu(source); await user.click(screen.getByRole('menuitem', { name: 'Inspect plugin…' }));
  await user.click(screen.getByRole('button', { name: 'Agent settings' }));
  expect(screen.queryByRole('button', { name: 'Close plugin details' })).toBeNull();
  await user.keyboard('{Escape}');
  expect(screen.getByRole('button', { name: 'Close plugin details' })).toBeTruthy();
  expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Agent settings' }));
  await user.click(screen.getByRole('button', { name: 'Agent settings' }));
  await user.click(screen.getByRole('button', { name: 'Select package Second' }));
  expect(screen.queryByLabelText('Provider')).toBeNull();
  expect(screen.getByRole('button', { name: 'Agent settings' }).textContent).toContain('Eagle supplied');
  await user.click(source);
  expect(screen.getByRole('button', { name: 'Agent settings' }).textContent).toContain('Codex');
});

it('retains a failed request, renders its error once and edits or retries without deleting history', async () => {
  const model = vi.fn().mockRejectedValueOnce(Error('Connection failed')).mockResolvedValue(JSON.stringify(blankDocument()));
  const user = userEvent.setup(); render(<App catalog={catalog} model={model} />);
  await user.type(screen.getByLabelText('Describe this plugin'), 'Make a label'); await user.click(screen.getByRole('button', { name: 'Send' }));
  await screen.findByRole('button', { name: 'Retry request 1' });
  expect(screen.getAllByText('Connection failed')).toHaveLength(1); expect(screen.queryByText('Remove from history')).toBeNull();
  await user.type(screen.getByLabelText('Describe this plugin'), 'Another draft');
  await user.click(screen.getByRole('button', { name: 'Edit request 1' }));
  expect((screen.getByLabelText('Describe this plugin') as HTMLTextAreaElement).value).toBe('Another draft');
  await user.click(screen.getByRole('button', { name: 'Replace draft' }));
  await waitFor(() => expect((screen.getByLabelText('Describe this plugin') as HTMLTextAreaElement).value).toBe('Make a label'));
  expect(model).toHaveBeenCalledTimes(1);
  await user.click(screen.getByRole('button', { name: 'Retry request 1' }));
  await screen.findByRole('button', { name: 'Open revision 2' });
  expect(screen.getAllByText('Connection failed')).toHaveLength(1);
  expect(catalog.store!.read().conversations[catalog.snapshot().order[0]].turns).toHaveLength(2);
});

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
  await user.click(screen.getByRole('button', { name: 'Inspect plugin…' }));
  const inspector = within(screen.getByRole('region', { name: 'Original copy activation' }));
  await user.click(inspector.getByRole('switch', { name: 'Enable package Original copy' }));
  expect(catalog.snapshot().claims.get(source.instanceId)?.desired).toBe(true);
  expect(await screen.findByText('Namespace owned by Original')).toBeTruthy();
  await user.type(screen.getByRole('searchbox', { name: 'Filter plugins' }), 'copy');
  expect(screen.getByRole('button', { name: 'Move above owner' }).hasAttribute('disabled')).toBe(true);
  await user.click(screen.getByRole('button', { name: 'Clear plugin filter' }));
  await user.click(screen.getByRole('button', { name: 'Move above owner' }));
  await waitFor(() => expect(catalog.snapshot().owners.get(source.namespace)?.instance.instanceId).toBe(copy.instanceId));
  expect(catalog.snapshot().entries).toHaveLength(3);
  const open = vi.fn<typeof eagle.contextMenu.open>().mockResolvedValue();
  vi.stubGlobal('eagle', { contextMenu: { open } });
  await user.pointer({ target: screen.getByRole('button', { name: 'Select package Original copy' }), keys: '[MouseRight]' });
  const moveDown = open.mock.calls[0][0].find(item => item.id === 'move-down')!;
  expect(moveDown.enabled).toBe(true);
  await act(async () => moveDown.click!());
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


it('keeps inspection visible across a live revision change and returns to the new revision', async () => {
  const user = userEvent.setup();
  const original = catalog.snapshot().entries[0].instance;
  const newer = blankDocument(); newer.screens.home.body = { type: 'Text', props: { text: 'Revised runtime' } };
  await catalog.store!.revise(original.instanceId, 1, newer, { widgets: Object.fromEntries(Object.entries(foundationRuntimeCatalog.widgets).map(([id, widget]) => [id, widget.contract])) });
  await catalog.store!.selectRevision(original.instanceId, 1);
  await catalog.refresh();
  render(<App catalog={catalog} />);
  await user.click(screen.getByRole('button', { name: 'Select package Original' }));
  fireEvent.contextMenu(screen.getByRole('button', { name: 'Select package Original' }));
  await user.click(screen.getByRole('menuitem', { name: 'Inspect plugin…' }));
  await user.click(screen.getByRole('button', { name: 'v2' }));
  await waitFor(() => expect(catalog.snapshot().entries[0].instance.currentRevision).toBe(2));
  expect(screen.getByRole('region', { name: 'Plugin details' })).toBeTruthy();
  await user.click(screen.getByRole('button', { name: 'Close plugin details' }));
  expect(await screen.findByText('Revised runtime')).toBeTruthy();
  expect(screen.getByText('local · revision 2 · home')).toBeTruthy();
});
