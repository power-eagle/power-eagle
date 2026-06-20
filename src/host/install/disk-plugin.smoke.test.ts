import { describe, it, expect } from 'vitest';
import * as nodeFs from 'node:fs';
import * as nodePath from 'node:path';
import * as nodeOs from 'node:os';
import { loadDiskPlugin, nativeImport } from './disk-plugin';
import { activatePlugin } from '../../sdui/activate';

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

// The shipped example plugin, loaded exactly as an installed one would be:
// manifest.json -> nativeImport (real file:// dynamic import) -> default export.
const exampleDir = nodePath.join(process.cwd(), 'examples', 'hello-note');

describe('disk-plugin smoke test (examples/hello-note)', () => {
  it('loads the example via the real file:// importer and activates a renderable view', async () => {
    const module = await loadDiskPlugin(exampleDir, { importModule: nativeImport });
    expect(module.manifest.id).toBe('hello-note');

    const app = await activatePlugin(module, {}, {});
    expect(app.view).toBeTruthy();
    expect(app.view?.().type).toBe('col');
  });
});
