import { describe, it, expect, vi } from 'vitest';
import * as nodeFs from 'node:fs';
import * as nodePath from 'node:path';
import * as nodeOs from 'node:os';
import { loadDiskPlugin } from './disk-plugin';
import { joinPath } from './fs-bridge';

// fs-bridge reaches the filesystem through the Eagle renderer's window.require
// bridge; under the node runner we back it with the real modules.
(globalThis as unknown as { window: { require: (m: string) => unknown } }).window = {
  require: (moduleName: string) => {
    if (moduleName === 'fs') return nodeFs;
    if (moduleName === 'path') return nodePath;
    if (moduleName === 'os') return nodeOs;
    throw new Error(`Unexpected module request: ${moduleName}`);
  },
};

function dirWithManifest(manifest: unknown): string {
  const dir = nodeFs.mkdtempSync(nodePath.join(nodeOs.tmpdir(), 'pe-disk-'));
  nodeFs.writeFileSync(nodePath.join(dir, 'manifest.json'), JSON.stringify(manifest));
  return dir;
}

describe('loadDiskPlugin', () => {
  it('imports the manifest entry and returns its default export as the module', async () => {
    const dir = dirWithManifest({ name: 'X', version: '1.0.0', description: 'd', id: 'x', main: 'index.js' });
    const pluginModule = { manifest: { id: 'x', name: 'X', version: '1.0.0' } };
    const importModule = vi.fn(async () => ({ default: pluginModule }));

    const loaded = await loadDiskPlugin(dir, { importModule });

    expect(loaded.manifest.id).toBe('x');
    expect(importModule).toHaveBeenCalledWith(joinPath(dir, 'index.js'));
  });

  it('throws when manifest.json declares no main entry', async () => {
    const dir = dirWithManifest({ name: 'X', version: '1.0.0', description: 'd', id: 'x' });
    const importModule = vi.fn(async () => ({ default: {} }));

    await expect(loadDiskPlugin(dir, { importModule })).rejects.toThrow(/main/u);
  });

  it('throws when the imported entry is not a plugin module', async () => {
    const dir = dirWithManifest({ name: 'X', version: '1.0.0', description: 'd', id: 'x', main: 'index.js' });
    const importModule = vi.fn(async () => ({ default: { notAPlugin: true } }));

    await expect(loadDiskPlugin(dir, { importModule })).rejects.toThrow(/valid plugin module/u);
  });
});
