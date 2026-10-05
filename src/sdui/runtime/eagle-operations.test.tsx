// @vitest-environment jsdom
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { AssetRecord, EagleCapabilities, FolderRecord, LibraryHistoryRecord, TagRecord } from '../../host/eagle-capabilities';
import { EAGLE_WIDGET_ACTIONS_ID, eagleWidgetActionManifest, eagleWidgetCalls, flattenFolders } from '../../plugins/eagle-widget-actions';
import { call, defineDocument, ref, set } from '../authoring';
import { Column } from '../authoring/layout';
import { ImportQueue, LibraryPicker, MetadataEditor, importResultListSchema } from '../authoring/eagle';
import { builtinCatalogEntries } from '../catalog/builtins';
import type { Json } from '../schema/model';
import { validatePackage, validateRuntime } from '../schema/validate';
import { foundationRuntimeCatalog } from './foundation';
import { RuntimeSession, type RuntimeCatalog } from './session';
import { RuntimeView } from './view';

const sessions: RuntimeSession[] = [];
afterEach(async () => {
  cleanup();
  await Promise.all(sessions.splice(0).map(session => session.dispose()));
});

const asset: AssetRecord = {
  id: 'asset-one', name: 'Original', extension: 'png', width: 640, height: 480,
  url: 'eagle://asset-one', annotation: '', tags: [], folderIds: [], rating: 0,
  fileUrl: 'file:///one.png', thumbnailUrl: 'file:///one-thumb.png', modifiedAt: 1,
};
const folders: FolderRecord[] = [{
  id: 'root', name: 'Root', description: '', parentId: null,
  children: [{ id: 'child', name: 'Child', description: 'Nested', parentId: 'root', children: [] }],
}];
const tags: TagRecord[] = [{ name: 'design', count: 2, color: '#ffad32', groups: ['topic'] }];
const libraries: LibraryHistoryRecord[] = [
  { id: 'one', name: 'Reference', path: 'C:\\Reference.library', status: 'available' },
  { id: 'two', name: 'Missing', path: 'D:\\Missing.library', status: 'missing', reason: 'Directory does not exist' },
];

function host(overrides: Partial<EagleCapabilities> = {}): EagleCapabilities {
  return {
    assets: {
      list: vi.fn(async () => [asset]), select: vi.fn(async () => true),
      updateMetadata: vi.fn(async (_id, patch) => ({ ...asset, ...patch })),
      importPath: vi.fn(async () => 'path-asset'), importUrl: vi.fn(async () => 'url-asset'),
    },
    folders: { list: vi.fn(async () => folders), open: vi.fn(async () => undefined) },
    tags: { list: vi.fn(async () => tags) },
    library: {
      current: vi.fn(async () => ({ name: 'Reference', path: 'C:\\Reference.library', modificationTime: 1 })),
      history: vi.fn(async () => libraries), switch: vi.fn(async path => ({ path })),
    },
    ...overrides,
  } as EagleCapabilities;
}

function catalog(): RuntimeCatalog {
  return {
    ...foundationRuntimeCatalog,
    exports: Object.fromEntries(eagleWidgetActionManifest.exports.map(descriptor => [
      `${EAGLE_WIDGET_ACTIONS_ID}/${descriptor.id}`, { version: eagleWidgetActionManifest.version, descriptor },
    ])),
  };
}

const emptyObject = { type: 'object' as const, properties: {}, required: [] };

describe('Eagle operation widgets and actions', () => {
  it('publishes valid contracts and preserves typed folder, tag, and library host data', async () => {
    expect(validatePackage(eagleWidgetActionManifest).success).toBe(true);
    for (const type of ['FolderTree', 'TagPicker', 'LibraryPicker', 'MetadataEditor', 'ImportQueue']) {
      expect(foundationRuntimeCatalog.widgets[type]).toBeDefined();
      expect(builtinCatalogEntries.find(entry => entry.type === type)).toMatchObject({ family: 'eagle', availability: 'active' });
    }
    expect(flattenFolders(folders)).toEqual([
      { id: 'root', name: 'Root', description: '', parentId: '' },
      { id: 'child', name: 'Child', description: 'Nested', parentId: 'root' },
    ]);
    const calls = eagleWidgetCalls(host());
    const context = { signal: new AbortController().signal, use: vi.fn() };
    await expect(calls[`${EAGLE_WIDGET_ACTIONS_ID}/folders`].invoke(null, context)).resolves.toEqual(flattenFolders(folders));
    await expect(calls[`${EAGLE_WIDGET_ACTIONS_ID}/tags`].invoke('', context)).resolves.toEqual(tags);
    await expect(calls[`${EAGLE_WIDGET_ACTIONS_ID}/libraries`].invoke(null, context)).resolves.toEqual([
      { ...libraries[0], reason: '' }, libraries[1],
    ]);
  });

  it('submits typed metadata and keeps library cancellation separate from explicit switching', async () => {
    const updateMetadata = vi.fn(async (_id: string, patch: Record<string, unknown>) => ({ ...asset, ...patch }));
    const switchLibrary = vi.fn(async (path: string) => ({ path }));
    const capabilities = host({
      assets: { ...host().assets, updateMetadata },
      library: { ...host().library, switch: switchLibrary },
    });
    const document = defineDocument({
      format: 'power-eagle/runtime', formatVersion: 1, start: 'home', components: {},
      dependencies: ['updateMetadata', 'switchLibrary'].map(exportId => ({
        package: EAGLE_WIDGET_ACTIONS_ID, version: '^1.0.0', export: exportId, kind: 'action' as const,
      })),
      state: {
        library: { schema: { type: 'string' }, initial: '' },
        message: { schema: { type: 'string' }, initial: '' },
      },
      actions: {}, screens: { home: { params: emptyObject, state: {}, body: Column.node({ gap: 8 }, { slots: { children: [
        LibraryPicker.node({
          label: 'Libraries', libraries: libraries.map(item => ({ ...item, reason: item.reason ?? '' })),
          selection: ref('state', 'library'),
        }, { events: {
          selectionChange: set('library', ref('event')),
          cancel: set('message', 'Library choice cancelled'),
          confirm: {
            ...call(`${EAGLE_WIDGET_ACTIONS_ID}/switchLibrary`, ref('event')),
            success: set('message', 'Library opened'), error: set('message', ref('error', 'message')),
          },
        } }),
        MetadataEditor.node({ assetId: asset.id, name: asset.name }, { events: {
          submit: {
            ...call(`${EAGLE_WIDGET_ACTIONS_ID}/updateMetadata`, ref('event')),
            success: set('message', 'Metadata saved'), error: set('message', ref('error', 'message')),
          },
          cancel: set('message', 'Metadata edit cancelled'),
        } }),
      ] } }) } },
    });
    expect(validateRuntime(document, {
      widgets: Object.fromEntries(Object.entries(catalog().widgets).map(([id, item]) => [id, item.contract])),
      exports: catalog().exports,
    }).success).toBe(true);
    const session = new RuntimeSession(document, catalog(), { calls: eagleWidgetCalls(capabilities) });
    sessions.push(session);
    const user = userEvent.setup();
    render(<RuntimeView session={session} />);

    await user.click(screen.getAllByRole('button', { name: 'Cancel' })[0]);
    expect(session.globalState.read(['message'])).toBe('Library choice cancelled');
    expect(switchLibrary).not.toHaveBeenCalled();

    await user.click(screen.getByRole('radio', { name: /Reference/u }));
    await user.click(screen.getByRole('button', { name: 'Open library' }));
    await waitFor(() => expect(switchLibrary).toHaveBeenCalledWith('C:\\Reference.library', expect.any(AbortSignal)));

    const name = screen.getByRole('textbox', { name: 'Asset name' });
    await user.clear(name);
    await user.type(name, 'Renamed');
    await user.type(screen.getByRole('textbox', { name: 'Asset tags' }), 'design, blue');
    await user.clear(screen.getByRole('spinbutton', { name: 'Asset rating' }));
    await user.type(screen.getByRole('spinbutton', { name: 'Asset rating' }), '5');
    await user.click(screen.getByRole('button', { name: 'Save metadata' }));
    await waitFor(() => expect(updateMetadata).toHaveBeenCalledWith('asset-one', {
      name: 'Renamed', annotation: '', tags: ['design', 'blue'], folderIds: [], rating: 5,
    }));
  });

  it('reports mixed import outcomes and renders each actual result', async () => {
    const importUrl = vi.fn(async () => { throw new Error('remote rejected'); });
    const calls = eagleWidgetCalls(host({ assets: { ...host().assets, importUrl } }));
    const context = { signal: new AbortController().signal, use: vi.fn() };
    const requests = [
      { id: 'path', source: 'C:\\one.png', kind: 'path' },
      { id: 'url', source: 'https://example.test/two.png', kind: 'url' },
    ] satisfies Json;
    const results = await calls[`${EAGLE_WIDGET_ACTIONS_ID}/importMany`].invoke(requests, context) as Json;
    expect(results).toEqual([
      { ...requests[0], status: 'success', assetId: 'path-asset', message: '' },
      { ...requests[1], status: 'error', assetId: '', message: 'remote rejected' },
    ]);
    const document = defineDocument({
      format: 'power-eagle/runtime', formatVersion: 1, start: 'home', dependencies: [], state: {}, components: {}, actions: {},
      screens: { home: { params: emptyObject, state: {}, body: ImportQueue.node({ label: 'Imports', items: results as never }) } },
    });
    const session = new RuntimeSession(document, foundationRuntimeCatalog);
    sessions.push(session);
    render(<RuntimeView session={session} />);
    expect(screen.getByText('success: path-asset')).toBeTruthy();
    expect(screen.getByText('error: remote rejected')).toBeTruthy();
  });

  it('aborts the action scope and prevents a late import completion after disposal', async () => {
    let release!: (value: string) => void;
    const pending = new Promise<string>(resolve => { release = resolve; });
    const importPath = vi.fn(() => pending);
    const document = defineDocument({
      format: 'power-eagle/runtime', formatVersion: 1, start: 'home', components: {},
      dependencies: [{ package: EAGLE_WIDGET_ACTIONS_ID, version: '^1.0.0', export: 'importMany', kind: 'action' }],
      state: { results: { schema: importResultListSchema, initial: [] } },
      actions: { start: {
        ...call(`${EAGLE_WIDGET_ACTIONS_ID}/importMany`, [{ id: 'late', source: 'C:\\late.png', kind: 'path' }]),
        success: set('results', ref('result')),
      } },
      screens: { home: { params: emptyObject, state: {}, body: ImportQueue.node({ label: 'Imports', items: ref('state', 'results') }) } },
    });
    const session = new RuntimeSession(document, catalog(), { calls: eagleWidgetCalls(host({ assets: { ...host().assets, importPath } })) });
    const run = session.run('start');
    const signal = session.navigation.current.activation.signal;
    await session.dispose();
    expect(signal.aborted).toBe(true);
    release('late-asset');
    await expect(run).rejects.toMatchObject({ name: 'AbortError' });
  });
});
