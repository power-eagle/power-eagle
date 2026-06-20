import { describe, it, expect, vi } from 'vitest';
import * as nodeFs from 'node:fs';
import * as nodePath from 'node:path';
import * as nodeOs from 'node:os';
import { mapInstalled, mergeAvailable, createHostService, initHostService } from './host-service';
import type { SaucepanEntry } from '../host/install/saucepan';
import { resolveSaucepanBinary } from '../host/install/saucepan-binary';

(globalThis as unknown as { window: { require: (m: string) => unknown } }).window = {
  require: (moduleName: string) => {
    if (moduleName === 'fs') return nodeFs;
    if (moduleName === 'path') return nodePath;
    if (moduleName === 'os') return nodeOs;
    throw new Error(`Unexpected module request: ${moduleName}`);
  },
};

function freshRoot(): string {
  return nodeFs.mkdtempSync(nodePath.join(nodeOs.tmpdir(), 'pe-svc-'));
}

const entry = (name: string, extra: Record<string, unknown> = {}): SaucepanEntry => ({
  source_type: 'github',
  sauce: { name, version: '1.0.0', description: 'd', ...extra },
});

// Fake saucepan process: argv is [root, ...subcommand].
function fakeRunner(installed: SaucepanEntry[], buckets: string[]) {
  return vi.fn((_bin: string, args: string[]) => {
    const cmd = args.slice(1).join(' ');
    const out =
      cmd === 'list --json' ? installed.map((e) => JSON.stringify(e)).join('\n')
        : cmd === 'bucket list --json' ? buckets.map((url) => JSON.stringify({ url })).join('\n')
          : '';
    return { ok: true, exitCode: 0, stdout: out, stderr: '' };
  });
}

describe('mapInstalled', () => {
  it('prefers the manifest id from sauce extra, falling back to the name', () => {
    const mapped = mapInstalled([entry('cool-name', { id: 'cool-id' }), entry('plain')]);
    expect(mapped[0]).toMatchObject({ id: 'cool-id', name: 'cool-name', source: 'github' });
    expect(mapped[1].id).toBe('plain');
  });

  it('marks an installed plugin launchable only when a built-in backs it', () => {
    const mapped = mapInstalled([entry('file-creator', { id: 'file-creator' }), entry('other')]);
    expect(mapped.find((p) => p.id === 'file-creator')?.launchable).toBe(true);
    expect(mapped.find((p) => p.id === 'other')?.launchable).toBe(false);
  });
});

describe('mergeAvailable', () => {
  it('lists built-ins first and drops installed entries that duplicate a built-in id', () => {
    const merged = mergeAvailable([
      { id: 'file-creator', name: 'dup', version: '9', source: 'github', launchable: true },
      { id: 'fresh', name: 'Fresh', version: '1', source: 'github', launchable: false },
    ]);
    const ids = merged.map((p) => p.id);
    expect(ids).toContain('file-creator');
    expect(ids).toContain('recent-libraries');
    expect(ids).toContain('fresh');
    expect(ids.filter((id) => id === 'file-creator')).toHaveLength(1);
    expect(merged.find((p) => p.id === 'file-creator')?.source).toBe('builtin');
  });
});

describe('createHostService', () => {
  it('lists built-ins merged with installed plugins from saucepan', () => {
    const root = freshRoot();
    const runner = fakeRunner([entry('installed-tool', { id: 'installed-tool' })], ['/b.json']);
    const service = createHostService({ root, runner });

    const ids = service.listAvailable().map((p) => p.id);
    expect(ids).toEqual(expect.arrayContaining(['file-creator', 'recent-libraries', 'installed-tool']));
    expect(service.listBuckets()).toContain('/b.json');
    expect(service.getLaunchable('file-creator')?.manifest.name).toBe('File Creator');
    expect(service.getLaunchable('installed-tool')).toBeUndefined();

    service.install('owner/repo');
    service.addBucket('/new.json');
    const calls = runner.mock.calls.map(([, args]) => args.slice(1).join(' '));
    expect(calls).toContain('install owner/repo');
    expect(calls).toContain('bucket add /new.json');
  });
});

describe('initHostService', () => {
  it('ensures a cached binary + root, then serves available plugins', async () => {
    const cacheDir = freshRoot();
    const root = freshRoot();
    // Pre-place the cached binary so ensure short-circuits (no download).
    nodeFs.writeFileSync(resolveSaucepanBinary(cacheDir, 'win32', 'x64'), 'fake');
    const runner = fakeRunner([], []);

    const service = await initHostService({ root, cacheDir, platform: 'win32', arch: 'x64', runner });

    expect(nodeFs.existsSync(nodePath.join(root, 'saucepan.toml'))).toBe(true);
    expect(service.listAvailable().map((p) => p.id)).toContain('file-creator');
  });
});
