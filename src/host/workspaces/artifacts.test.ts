import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { createRequire } from 'node:module';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, existsSync, rmSync, symlinkSync } from 'node:fs';
import { join, resolve } from 'node:path';
import * as React from 'react';
import * as ReactDOM from 'react-dom';
import * as jsx from 'react/jsx-runtime';
import { buildBuiltinArtifacts } from '../../sdui/tooling/builtin-packages';
import { discoverContributionPackage, loadCompiledContributions } from '../install/contribution-package';
import { ActivationController } from '../activation/controller';
import type { EagleCapabilities } from '../eagle-capabilities';
import { newPluginInstance } from './model';
import { InstancePreferences } from './preferences';
import { instanceRegistrations, resolveInstanceClaims } from './claims';
import { createArtifactSession, effectiveRuntimeEnvironment } from './runtime';
import { snapshotArtifact } from './artifact-copy';
import { validateRuntime } from '../../sdui/schema/validate';

const hostRequire = createRequire(import.meta.url);
const sharedModules = { react: React, 'react-dom': ReactDOM, 'react/jsx-runtime': jsx };
mkdirSync('.artifacts', { recursive: true });
const root = mkdtempSync(resolve('.artifacts/artifact-test-'));
const output = join(root, 'builtins');
const capabilities = {
  assets: { list: vi.fn(async () => []), select: vi.fn(async () => true) },
  library: { history: vi.fn(async () => []), current: vi.fn(async () => ({ path: '', name: '', modificationTime: 0 })) },
  clipboard: { readText: vi.fn(async () => 'copied'), writeText: vi.fn(async () => {}) },
} as unknown as EagleCapabilities;
const load = (root: string) => {
  const discovered = discoverContributionPackage(root, hostRequire);
  return { discovered, loaded: loadCompiledContributions(discovered, { hostRequire, sharedModules, host: { eagle: capabilities } }) };
};
beforeAll(async () => { await buildBuiltinArtifacts(process.cwd(), output); }, 60000);
afterAll(() => { if (root.startsWith(resolve('.artifacts') + '\\') || root.startsWith(resolve('.artifacts') + '/')) rmSync(root, { recursive: true, force: true }); });

describe('materialized built-in artifacts', () => {
  it('discovers and loads every contribution, including provider-only and runtime-only packages', async () => {
    const ids = JSON.parse(readFileSync(join(output, 'index.json'), 'utf8')) as string[];
    expect(ids).toHaveLength(7);
    for (const id of ids) {
      const { discovered, loaded } = load(join(output, id));
      const instance = newPluginInstance(discovered.manifest.name, { kind: 'built-in', sourceId: id });
      instance.namespace = id;
      const item = { instance, discovered };
      const prefs = InstancePreferences.open({ read: () => null, write: () => {} });
      prefs.setInstance(instance.instanceId, true);
      const { registry } = resolveInstanceClaims([item], [instance.instanceId], prefs);
      const controller = new ActivationController();
      expect((await controller.reconcile(registry, instanceRegistrations(item, loaded))).failures.size).toBe(0);
      if (discovered.runtime) {
        const session = createArtifactSession(discovered, registry, controller);
        await session.initialize(); expect(session.resolve()).toBeTruthy(); await session.dispose();
        const invalid = validateRuntime({ ...discovered.runtime, initialize: ['missing'] }, { widgets: {}, exports: {} });
        expect(invalid.diagnostics.some(item => item.path === '/initialize/0')).toBe(true);
      } else expect(loaded.length).toBeGreaterThan(0);
      await controller.dispose();
    }
    expect(capabilities.assets.list).toHaveBeenCalledOnce();
    expect(capabilities.library.history).toHaveBeenCalledOnce();
  });

  it('loads a relocated clone and revokes action adapters after explicit promotion', async () => {
    const original = load(join(output, 'power-eagle.file-creator'));
    const sourceInstance = newPluginInstance('File Creator', { kind: 'built-in', sourceId: 'builtin' });
    sourceInstance.namespace = original.discovered.manifest.id;
    const source = { instance: sourceInstance, discovered: original.discovered };
    const destination = join(root, 'copy');
    await snapshotArtifact(source.discovered.root, destination, root, hostRequire);
    const cloned = load(destination);
    const copy = { instance: newPluginInstance('Copy', { kind: 'local', sourceId: 'copy' }, source.instance), discovered: cloned.discovered };
    const prefs = InstancePreferences.open({ read: () => null, write: () => {} });
    prefs.setInstance(copy.instance.instanceId, true);
    const controller = new ActivationController();
    const registrations = (owner: typeof source) => instanceRegistrations(owner, owner === source ? original.loaded : cloned.loaded);
    const first = resolveInstanceClaims([source, copy], [source.instance.instanceId, copy.instance.instanceId], prefs);
    await controller.reconcile(first.registry, registrations(source));
    const oldCall = effectiveRuntimeEnvironment(first.registry, controller).calls['power-eagle.file-creator/normalizeExtension'];
    const second = resolveInstanceClaims([source, copy], [copy.instance.instanceId, source.instance.instanceId], prefs);
    await controller.reconcile(second.registry, registrations(copy));
    const context = { signal: new AbortController().signal, use: () => () => {} };
    await expect(oldCall.invoke('md', context)).rejects.toThrow('changed owner');
    const session = createArtifactSession(copy.discovered, second.registry, controller);
    await session.initialize(); expect(session.resolve()).toBeTruthy();
    await session.dispose(); await controller.dispose();
  });

  it('copies private modules, assets and licenses without modifying source or host history', async () => {
    const source = join(root, 'mixed');
    await snapshotArtifact(join(output, 'power-eagle.file-creator'), source, root, hostRequire);
    mkdirSync(join(source, 'node_modules/private'), { recursive: true });
    writeFileSync(join(source, 'node_modules/private/index.js'), 'module.exports = { counter: 0 };');
    writeFileSync(join(source, 'LICENSE'), 'license');
    writeFileSync(join(source, 'picture.svg'), '<svg/>');
    const manifest = JSON.parse(readFileSync(join(source, 'manifest.json'), 'utf8'));
    manifest.assets.push('picture.svg');
    writeFileSync(join(source, 'manifest.json'), JSON.stringify(manifest));
    mkdirSync(join(source, '.power-eagle-workspace'));
    writeFileSync(join(source, '.power-eagle-workspace/conversation.json'), 'private');
    const destination = join(root, 'mixed-copy');
    const copy = await snapshotArtifact(source, destination, root, hostRequire);
    expect(readFileSync(copy.assets['picture.svg'], 'utf8')).toBe('<svg/>');
    expect(readFileSync(join(destination, 'LICENSE'), 'utf8')).toBe('license');
    expect(existsSync(join(destination, '.power-eagle-workspace'))).toBe(false);
    const requireSource = createRequire(join(source, 'manifest.json'));
    const requireCopy = createRequire(join(destination, 'manifest.json'));
    expect(requireSource('private')).not.toBe(requireCopy('private'));
    requireCopy('private').counter = 9;
    expect(requireSource('private').counter).toBe(0);
    expect(readFileSync(join(source, 'picture.svg'), 'utf8')).toBe('<svg/>');
  });

  it('rejects escaping links, incomplete artifacts, size limits and cancellation with bounded cleanup', async () => {
    const source = join(output, 'example.runtime-flow');
    const destination = join(root, 'failed-copy');
    const abort = new AbortController();
    await expect(snapshotArtifact(source, destination, root, hostRequire, { signal: abort.signal, progress: () => abort.abort() })).rejects.toThrow();
    expect(existsSync(destination)).toBe(false);
    await expect(snapshotArtifact(source, destination, root, hostRequire, { maxBytes: 1 })).rejects.toThrow('size limits');
    expect(existsSync(destination)).toBe(false);
    await expect(snapshotArtifact(source, resolve(root, '..', 'outside'), root, hostRequire)).rejects.toThrow('independent path');
    const linked = join(root, 'linked');
    await snapshotArtifact(source, linked, root, hostRequire);
    symlinkSync(output, join(linked, 'escape'), 'junction');
    await expect(snapshotArtifact(linked, destination, root, hostRequire)).rejects.toThrow('linked path');
    expect(existsSync(destination)).toBe(false);
    rmSync(join(linked, 'run.json'));
    await expect(snapshotArtifact(linked, destination, root, hostRequire)).rejects.toThrow();
    expect(existsSync(destination)).toBe(false);
  });
});
