import { afterEach, describe, expect, it, vi } from 'vitest';
import * as React from 'react';
import * as ReactDOM from 'react-dom';
import * as jsx from 'react/jsx-runtime';
import { createRequire } from 'node:module';
import { cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, relative, resolve } from 'node:path';
import { PluginCatalog } from '../workspaces/catalog';
import { WorkspaceStore } from '../workspaces/store';
import { InstancePreferences } from '../workspaces/preferences';
import { openWorkbenchAcquisition } from './workbench-acquisition';
import type { PackageRequest } from './saucepan-client';
import { Text } from '../../sdui/authoring/foundation';

const hostRequire = createRequire(import.meta.url);
const executable = process.env.POWER_EAGLE_TEST_SAUCEPAN;
const roots: string[] = [], catalogs: PluginCatalog[] = [];
afterEach(async () => {
  vi.restoreAllMocks();
  for (const catalog of catalogs.splice(0)) await catalog.dispose();
  for (const root of roots.splice(0)) {
    if (!relative(tmpdir(), root).startsWith('power-eagle-workbench-test-')) throw new Error('Unsafe test cleanup');
    rmSync(root, { recursive: true, force: true });
  }
});
async function fixture() {
  const root = mkdtempSync(join(tmpdir(), 'power-eagle-workbench-test-')); roots.push(root);
  const state = join(root, 'state'), source = join(root, 'source'), managerRoot = join(root, 'manager');
  mkdirSync(state); writeFileSync(join(state, '.power-eagle-state.json'), JSON.stringify({ format: 'power-eagle/state', formatVersion: 1 }));
  cpSync(resolve('examples/runtime-only'), source, { recursive: true });
  const store = new WorkspaceStore(state, hostRequire);
  const catalog = new PluginCatalog(InstancePreferences.open({ read: () => null, write: () => {} }), { hostRequire, sharedModules: { react: React, 'react-dom': ReactDOM, 'react/jsx-runtime': jsx } }, store);
  catalogs.push(catalog); await catalog.refresh();
  const acquisition = await openWorkbenchAcquisition(catalog, { binaryPath: executable, root: managerRoot });
  catalog.acquisition = acquisition;
  const request: PackageRequest = { source: { type: 'local', path: source }, selector: { type: 'local' } };
  return { root, store, source, catalog, acquisition, request, managerRoot };
}

function provider(source: string, activation: string) {
  const descriptor = { kind: 'widget', id: 'label', contract: { ...Text.contract, example: { type: 'example.notes/label', props: { text: 'test' } } } };
  writeFileSync(join(source, 'manifest.json'), JSON.stringify({ format: 'power-eagle/package', formatVersion: 1, id: 'example.notes', name: 'Provider fixture', version: '1.0.0',
    sdk: '^1.0.0', description: '', contributions: { widgets: 'types.cjs' }, exports: [descriptor], dependencies: [], assets: [] }));
  writeFileSync(join(source, 'types.cjs'), `module.exports = () => ({ format: 'power-eagle/provider', formatVersion: 1, kind: 'widget',
    exports: [{ descriptor: ${JSON.stringify(descriptor)}, implementation: () => null, activate: () => { ${activation} } }] });`);
}

describe.skipIf(!executable || !existsSync(executable))('workbench with real Saucepan', () => {
  it('probes without creating a store, installs, refreshes the same instance and preserves independent copies on removal', async () => {
    const f = await fixture();
    expect(f.acquisition.unavailable).toBeUndefined(); expect(existsSync(f.managerRoot)).toBe(false);
    await f.acquisition.setup();
    const first = await f.acquisition.install(f.request);
    const copy = await f.catalog.create('Independent copy', { instanceId: first.instanceId, revision: 1 });
    const sourceManifest = JSON.parse(readFileSync(join(f.source, 'manifest.json'), 'utf8'));
    sourceManifest.version = '1.0.1'; writeFileSync(join(f.source, 'manifest.json'), JSON.stringify(sourceManifest));
    const second = await f.acquisition.refresh(first.instanceId);
    expect(second.instanceId).toBe(first.instanceId); expect(second.currentRevision).toBe(2);
    expect(f.store.read().instances).toHaveLength(2);
    expect(f.catalog.snapshot().entries.find(item => item.instance.instanceId === first.instanceId)?.discovered.manifest.version).toBe('1.0.1');
    const reopened = new PluginCatalog(f.catalog.preferences, f.catalog.loadOptions, f.store); catalogs.push(reopened); await reopened.refresh();
    expect(reopened.snapshot().entries.find(item => item.instance.instanceId === first.instanceId)?.instance.acquisition).toEqual(second.acquisition);
    await f.acquisition.remove(first.instanceId);
    expect(f.store.read().instances.map(item => item.instanceId)).toEqual([copy.instanceId]);
    expect(existsSync(f.store.artifact(copy))).toBe(true); expect(existsSync(f.source)).toBe(true);
    expect(f.acquisition.app!.retainedReceipts()).toHaveLength(0);
  }, 30000);

  it('retains the prior revision on invalid source and rejects refresh over a separately selected revision', async () => {
    const f = await fixture(); await f.acquisition.setup();
    const first = await f.acquisition.install(f.request);
    writeFileSync(join(f.source, 'manifest.json'), '{}');
    await expect(f.acquisition.refresh(first.instanceId)).rejects.toThrow(/validation/);
    expect(f.store.read().instances[0].currentRevision).toBe(1);
    expect(f.acquisition.app!.retainedReceipts().some(item => item.pinUuid === first.acquisition!.pinUuid)).toBe(true);
    cpSync(resolve('examples/runtime-only'), f.source, { recursive: true });
    await f.acquisition.refresh(first.instanceId);
    await f.store.selectRevision(first.instanceId, 1);
    const acquire = vi.spyOn(f.acquisition.app!, 'acquirePersistent');
    await expect(f.acquisition.refresh(first.instanceId)).rejects.toThrow(/local edit/);
    expect(acquire).not.toHaveBeenCalled();
  }, 30000);

  it('restores prior activation and catalog after a candidate activation error', async () => {
    const f = await fixture(); await f.acquisition.setup();
    const first = await f.acquisition.install(f.request);
    vi.spyOn(f.catalog.controller, 'reconcile').mockRejectedValueOnce(new Error('candidate activation failed'));
    await expect(f.acquisition.refresh(first.instanceId)).rejects.toThrow(/candidate activation failed/);
    expect(f.store.read().instances[0]).toEqual(first);
    expect(f.catalog.snapshot().entries[0].instance).toEqual(first);
    expect(f.catalog.snapshot().claims.get(first.instanceId)?.status).toBe('active');
  }, 30000);

  it('keeps both receipts and the prior workspace when manager publication is uncertain', async () => {
    const f = await fixture(); await f.acquisition.setup();
    const first = await f.acquisition.install(f.request);
    const original = f.acquisition.app!.publish.bind(f.acquisition.app);
    vi.spyOn(f.acquisition.app!, 'publish').mockImplementationOnce(async receipt => { await original(receipt); throw new Error('lost publication response'); });
    await expect(f.acquisition.refresh(first.instanceId)).rejects.toThrow(/lost publication response/);
    expect(f.store.read().instances[0]).toEqual(first);
    expect(f.acquisition.app!.retainedReceipts()).toHaveLength(2);
  }, 30000);

  it('rolls back a real provider activation failure and can refresh successfully afterward', async () => {
    const f = await fixture(); provider(f.source, 'return () => {};'); await f.acquisition.setup();
    const first = await f.acquisition.install(f.request);
    provider(f.source, 'throw new Error("provider activation rejected");');
    await expect(f.acquisition.refresh(first.instanceId)).rejects.toThrow(/provider activation rejected/);
    expect(f.store.read().instances[0]).toEqual(first);
    expect(f.catalog.snapshot().claims.get(first.instanceId)?.status).toBe('active');
    provider(f.source, 'return () => {};');
    const next = await f.acquisition.refresh(first.instanceId);
    expect(next.currentRevision).toBe(3);
    expect(f.catalog.snapshot().claims.get(first.instanceId)?.status).toBe('active');
  }, 30000);

  it('does not release preview retention after a provider disposal failure or repeated close', async () => {
    const f = await fixture(); provider(f.source, 'return () => { throw new Error("provider disposal rejected"); };'); await f.acquisition.setup();
    const id = await f.acquisition.preview(f.request);
    await expect(f.acquisition.closePreview(id)).rejects.toThrow(/provider disposal rejected/);
    await expect(f.acquisition.closePreview(id)).rejects.toThrow(/remain retained/);
    expect(f.acquisition.app!.retainedReceipts()).toHaveLength(1);
    const state = JSON.parse(readFileSync(f.store.bounded('acquisition', 'saucepan.json'), 'utf8'));
    expect(Object.keys(state.readers)).toHaveLength(1);
    // This fixture intentionally retains uncertain consumers; cleanup removes only its disposable test root.
    catalogs.splice(catalogs.indexOf(f.catalog), 1);
    await expect(f.catalog.dispose()).rejects.toThrow(/remain retained/);
  }, 30000);

  it('keeps preview out of durable workspace and app registration, then releases it after close', async () => {
    const f = await fixture(); await f.acquisition.setup();
    const id = await f.acquisition.preview(f.request);
    expect(f.catalog.snapshot().entries[0].session).toBe(true);
    expect(f.store.read().instances).toHaveLength(0);
    const stateFile = f.store.bounded('acquisition', 'saucepan.json');
    expect(JSON.parse(readFileSync(stateFile, 'utf8')).app).toBeUndefined();
    await f.acquisition.closePreview(id);
    expect(f.catalog.snapshot().entries).toHaveLength(0);
    expect(f.acquisition.app!.retainedReceipts()).toHaveLength(0);
    expect(Object.keys(JSON.parse(readFileSync(stateFile, 'utf8')).readers)).toHaveLength(0);
  }, 30000);

  it('copies a preview into an independent workspace before session disposal', async () => {
    const f = await fixture(); await f.acquisition.setup();
    const id = await f.acquisition.preview(f.request);
    const copy = await f.catalog.create('Saved preview', { instanceId: id, revision: 1 });
    await f.acquisition.closePreview(id);
    expect(f.store.read().instances.map(item => item.instanceId)).toEqual([copy.instanceId]);
    expect(existsSync(f.store.artifact(copy))).toBe(true);
    expect(f.acquisition.app!.retainedReceipts()).toHaveLength(0);
  }, 30000);
});
