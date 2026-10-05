import { describe, expect, it, vi } from 'vitest';
import type { HostFilesystem } from './install/fs-bridge';
import type { EaglePluginHost } from './eagle-capabilities';
import { createEagleCapabilities, observeEagleCapabilities } from './eagle-capabilities';

function filesystem(kinds: Record<string, ReturnType<HostFilesystem['kind']> | Error> = {}): HostFilesystem {
  return {
    join: (...parts) => parts.join('/'), resolve: (...parts) => parts.join('/'), dirname: path => path.split('/').slice(0, -1).join('/'),
    basename: path => {
      const parts = path.replace(/\\/g, '/').split('/');
      return parts[parts.length - 1] ?? '';
    },
    samePath: (left, right) => left === right,
    home: () => '/home/ada', exists: path => kinds[path] !== undefined,
    kind: path => { const value = kinds[path]; if (value instanceof Error) throw value; return value; },
    ensureDirectory: vi.fn(), removeTree: vi.fn(), readBytes: vi.fn(), readText: vi.fn(),
    writeBytes: vi.fn(), writeText: vi.fn(), makeExecutable: vi.fn(),
  };
}

function item(overrides: Record<string, unknown> = {}) {
  return {
    id: 'asset-1', name: 'Preview', ext: 'png', width: 320, height: 180, url: 'https://example.test',
    annotation: '', tags: ['design'], folders: ['folder-1'], star: 3, fileURL: 'file:///preview.png',
    thumbnailURL: 'file:///thumbnail.png', modifiedAt: 42, save: vi.fn(async () => true), ...overrides,
  };
}

function host(overrides: Partial<EaglePluginHost> = {}): EaglePluginHost {
  const asset = item();
  return {
    item: {
      get: vi.fn(async () => [asset]), getById: vi.fn(async () => asset), select: vi.fn(async () => true),
      addFromPath: vi.fn(async () => 'path-item'), addFromURL: vi.fn(async () => 'url-item'),
    },
    folder: { getAll: vi.fn(async () => []), open: vi.fn(async () => undefined) },
    tag: { get: vi.fn(async () => []) },
    library: { info: vi.fn(async () => ({ name: 'Current', path: 'C:\\Current.library', modificationTime: 42 })) },
    clipboard: { readText: vi.fn(() => 'copied'), writeText: vi.fn() },
    notification: { show: vi.fn(async () => undefined) },
    dialog: { showSaveDialog: vi.fn(async options => ({ canceled: false, filePath: `C:\\created\\${options.defaultPath}` })) },
    ...overrides,
  };
}

function webApi(history: string[] = []) {
  return { library: { history: vi.fn(async () => history), switch: vi.fn(async (path: string) => ({ path, switched: true })) } };
}

describe('typed Eagle capabilities', () => {
  it('maps Eagle objects to inert records and saves metadata through the Item API', async () => {
    const eagle = host();
    const capabilities = createEagleCapabilities({ host: eagle, filesystem: filesystem(), webApi: webApi() });

    await expect(capabilities.assets.list({ isSelected: true })).resolves.toEqual([
      expect.objectContaining({ id: 'asset-1', extension: 'png', folderIds: ['folder-1'], rating: 3 }),
    ]);
    const updated = await capabilities.assets.updateMetadata('asset-1', {
      name: 'Updated', annotation: 'Reviewed', tags: ['ready'], folderIds: ['folder-2'], rating: 5,
    });
    expect(updated).toMatchObject({ name: 'Updated', annotation: 'Reviewed', tags: ['ready'], folderIds: ['folder-2'], rating: 5 });
    const target = await eagle.item!.getById('asset-1');
    expect(target.save).toHaveBeenCalledOnce();
  });

  it('rejects false host results and propagates rejected host calls', async () => {
    const failedItem = item({ save: vi.fn(async () => false) });
    const eagle = host({
      item: {
        get: vi.fn(async () => [failedItem]), getById: vi.fn(async () => failedItem), select: vi.fn(async () => false),
        addFromPath: vi.fn(async () => { throw new Error('import rejected'); }), addFromURL: vi.fn(async () => 'unused'),
      },
    });
    const capabilities = createEagleCapabilities({ host: eagle, filesystem: filesystem(), webApi: webApi() });

    await expect(capabilities.assets.select(['asset-1'])).rejects.toMatchObject({ capability: 'eagle', operation: 'assets.select' });
    await expect(capabilities.assets.updateMetadata('asset-1', { name: 'Nope' })).rejects.toMatchObject({ operation: 'assets.updateMetadata' });
    await expect(capabilities.assets.importPath('C:\\bad.png')).rejects.toThrow('import rejected');
  });

  it('returns actual clipboard values and exposes missing hosts clearly', async () => {
    const capabilities = createEagleCapabilities({ host: host(), filesystem: filesystem(), webApi: webApi() });
    await expect(capabilities.clipboard.readText()).resolves.toBe('copied');
    await expect(capabilities.clipboard.writeText('new value')).resolves.toBeUndefined();

    const missing = createEagleCapabilities({ host: {}, filesystem: filesystem(), webApi: webApi() });
    await expect(missing.clipboard.readText()).rejects.toMatchObject({
      capability: 'clipboard', operation: 'readText', code: 'unavailable',
    });
  });

  it('writes only after an accepted save dialog and reports cancellation', async () => {
    const fs = filesystem();
    const accepted = createEagleCapabilities({ host: host(), filesystem: fs, webApi: webApi() });
    await expect(accepted.files.createText('notes.md', '# Notes')).resolves.toEqual({
      status: 'created', path: 'C:\\created\\notes.md',
    });
    expect(fs.writeText).toHaveBeenCalledWith('C:\\created\\notes.md', '# Notes');

    const cancelledHost = host({ dialog: { showSaveDialog: vi.fn(async () => ({ canceled: true })) } });
    const cancelled = createEagleCapabilities({ host: cancelledHost, filesystem: fs, webApi: webApi() });
    await expect(cancelled.files.createText('ignored.txt', '')).resolves.toEqual({ status: 'cancelled' });
    expect(fs.writeText).toHaveBeenCalledTimes(1);
  });

  it('derives library validity from directory evidence and never edits history metadata', async () => {
    const paths = ['C:\\Available.library', 'C:\\Missing.library', 'C:\\Denied.library'];
    const fs = filesystem({
      [paths[0]]: 'directory', [paths[1]]: undefined, [paths[2]]: new Error('access denied'),
    });
    const api = webApi(paths);
    const capabilities = createEagleCapabilities({ host: host(), filesystem: fs, webApi: api });

    await expect(capabilities.library.history()).resolves.toEqual([
      expect.objectContaining({ name: 'Available', path: paths[0], status: 'available' }),
      expect.objectContaining({ name: 'Missing', path: paths[1], status: 'missing' }),
      expect.objectContaining({ name: 'Denied', path: paths[2], status: 'inaccessible' }),
    ]);
    expect(fs.readText).not.toHaveBeenCalled();
    expect(fs.writeText).not.toHaveBeenCalled();
    expect(fs.removeTree).not.toHaveBeenCalled();
  });

  it('returns the Web API switch result and never fabricates success after rejection', async () => {
    const api = webApi();
    const capabilities = createEagleCapabilities({ host: host(), filesystem: filesystem(), webApi: api });
    await expect(capabilities.library.switch('C:\\Target.library')).resolves.toEqual({ path: 'C:\\Target.library', switched: true });
    api.library.switch.mockRejectedValueOnce(new Error('switch refused'));
    await expect(capabilities.library.switch('C:\\Broken.library')).rejects.toMatchObject({
      capability: 'library', operation: 'switch', code: 'failed',
    });
  });

  it('observes support without calling a host operation', () => {
    const eagle = host();
    const support = observeEagleCapabilities(eagle, (() => undefined) as unknown as NodeRequire);
    expect(support).toEqual({
      pluginApi: true, nodeBridge: true, assets: true, folders: true, tags: true,
      library: true, clipboard: true, filePicker: false, saveDialog: true,
    });
    expect(eagle.item!.get).not.toHaveBeenCalled();
    expect(eagle.library!.info).not.toHaveBeenCalled();
  });
});
