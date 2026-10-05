import { afterEach, describe, expect, it, vi } from 'vitest';
import { createRequire } from 'node:module';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { WorkspaceStore, blankDocument } from './store';
import { foundationRuntimeCatalog } from '../../sdui/runtime/foundation';
import { InstancePreferences } from './preferences';
import { resolveInstanceClaims } from './claims';
import { discoverContributionPackage } from '../install/contribution-package';
import { PluginCatalog } from './catalog';
import * as React from 'react';
import * as ReactDOM from 'react-dom';
import * as jsx from 'react/jsx-runtime';

const hostRequire = createRequire(import.meta.url);
const roots: string[] = [];
function setup() {
  mkdirSync('.artifacts', { recursive: true });
  const root = mkdtempSync(resolve('.artifacts/store-test-')); roots.push(root);
  writeFileSync(join(root, '.power-eagle-state.json'), JSON.stringify({ format: 'power-eagle/state', formatVersion: 1 }));
  return new WorkspaceStore(root, hostRequire);
}
afterEach(() => { vi.restoreAllMocks(); roots.splice(0).forEach(root => rmSync(root, { recursive: true, force: true })); });
const validation = { widgets: Object.fromEntries(Object.entries(foundationRuntimeCatalog.widgets).map(([id, value]) => [id, value.contract])) };

describe('durable workspace publication', () => {
  it('refreshes one instance catalog, hands off copies and contains unreadable artifacts', async () => {
    const store = setup(); const original = await store.create('Original');
    const unrelated = await store.create('Unrelated');
    const prefs = InstancePreferences.open({ read: () => null, write: () => {} });
    const catalog = new PluginCatalog(prefs, { hostRequire, sharedModules: { react: React, 'react-dom': ReactDOM, 'react/jsx-runtime': jsx } }, store);
    await catalog.refresh();
    const untouched = catalog.controller.snapshot.runtime.get(`${unrelated.namespace}/main`);
    const copy = await catalog.create('Copy', { instanceId: original.instanceId, revision: 1 });
    await catalog.setEnabled(copy.instanceId, true);
    expect(catalog.snapshot().claims.get(copy.instanceId)?.owner).toBe(original.instanceId);
    await catalog.move(copy.instanceId, original.instanceId);
    expect(catalog.snapshot().owners.get(copy.namespace)?.instance.instanceId).toBe(copy.instanceId);
    expect(catalog.controller.snapshot.runtime.get(`${unrelated.namespace}/main`)).toBe(untouched);
    await catalog.refresh();
    expect(catalog.snapshot().entries).toHaveLength(3);
    await catalog.dispose();
    rmSync(join(store.artifact(original), 'run.json'));
    const reloaded = new PluginCatalog(prefs, catalog.loadOptions, store);
    await reloaded.refresh();
    expect(reloaded.snapshot().entries.find(item => item.instance.instanceId === original.instanceId)?.failure).toContain('run.json');
    expect(reloaded.controller.snapshot.runtime.has(`${unrelated.namespace}/main`)).toBe(true);
    await reloaded.dispose();
  });
  it('creates and restores independent ordered instances, defaults and selected-revision provenance', async () => {
    const store = setup();
    const original = await store.create('Original');
    const untouched = readFileSync(join(store.artifact(original), 'run.json'), 'utf8');
    const copy = await store.create('Original copy', { instanceId: original.instanceId, revision: 1 });
    const blank = await store.create('Blank');
    expect(store.read().order).toEqual([original.instanceId, copy.instanceId, blank.instanceId]);
    expect(copy.forkOf).toEqual({ instanceId: original.instanceId, revision: 1 });
    const prefs = InstancePreferences.open({ read: () => null, write: () => {} });
    const catalog = store.read();
    const claims = resolveInstanceClaims(catalog.instances.map(instance => ({ instance, discovered: discoverContributionPackage(store.artifact(instance), hostRequire) })), catalog.order, prefs);
    expect(claims.claims.get(copy.instanceId)?.desired).toBe(false);
    expect(claims.claims.get(blank.instanceId)?.desired).toBe(true);
    const order = [blank.instanceId, copy.instanceId, original.instanceId];
    await store.reorder(order);
    expect(new WorkspaceStore(roots[0], hostRequire).read().order).toEqual(order);
    expect(readFileSync(join(store.artifact(original), 'run.json'), 'utf8')).toBe(untouched);
  });

  it('retains old artifacts and catalog on failed publication, invalid input and cancellation', async () => {
    const store = setup(); await store.create('Original');
    const before = store.read();
    const abort = new AbortController(); abort.abort();
    await expect(store.create('Cancelled', undefined, { signal: abort.signal })).rejects.toThrow();
    await expect(store.create(' ')).rejects.toThrow();
    const write = vi.spyOn(store, 'atomicWrite').mockImplementation(() => { throw new Error('disk full'); });
    await expect(store.create('Failed')).rejects.toThrow('disk full');
    write.mockRestore();
    expect(store.read()).toEqual(before);
    expect(store.fs.readdirSync(join(store.root, 'instances')).filter(id => existsSync(join(store.root, 'instances', id, 'revisions/1')))).toHaveLength(1);
    await expect(store.reorder([])).rejects.toThrow('Catalog order');
    expect(() => store.bounded('../elsewhere')).toThrow('escapes');
  });

  it('serializes concurrent publication and preserves immutable monotonic revisions based on older versions', async () => {
    const store = setup();
    const first = store.create('First');
    await expect(store.create('Concurrent')).rejects.toThrow('busy');
    const instance = await first;
    const second = await store.create('Retry');
    expect(second.instanceId).not.toBe(instance.instanceId);
    const v2 = await store.revise(instance.instanceId, 1, blankDocument(), validation);
    const v3 = await store.revise(instance.instanceId, 1, blankDocument(), validation);
    expect(v2.currentRevision).toBe(2); expect(v3.revisions.map(item => item.id)).toEqual([1, 2, 3]);
    expect(v3.revisions[2].basedOn).toBe(1);
    expect(existsSync(join(store.artifact(v3, 1), 'run.json'))).toBe(true);
    await expect(store.revise(instance.instanceId, 3, { invalid: true }, validation)).rejects.toThrow();
    expect(store.read().instances.find(item => item.instanceId === instance.instanceId)?.currentRevision).toBe(3);
  });

  it('registers external artifacts exactly once, snapshots provider-only clones and never mutates the origin', async () => {
    const store = setup(); const source = join(roots[0], 'external'); mkdirSync(source);
    const manifest = { format: 'power-eagle/package', formatVersion: 1, id: 'example.style', name: 'Style', version: '1.0.0', description: '', sdk: '^1.0.0', contributions: { styling: 'style.cjs' }, exports: [{ id: 'style', kind: 'styling', targets: ['power-eagle/shell'], tokens: { type: 'object', properties: {}, required: [] } }], dependencies: [], assets: [] };
    writeFileSync(join(source, 'manifest.json'), JSON.stringify(manifest)); writeFileSync(join(source, 'style.cjs'), 'module.exports = () => {};');
    const original = await store.register(source, { kind: 'acquired', sourceId: 'source' });
    expect((await store.register(source, original.origin)).instanceId).toBe(original.instanceId);
    const copy = await store.create('Style copy', { instanceId: original.instanceId, revision: 1 });
    expect(discoverContributionPackage(store.artifact(copy), hostRequire).runtime).toBeUndefined();
    expect(readFileSync(join(source, 'manifest.json'), 'utf8')).toBe(JSON.stringify(manifest));
    expect(store.read().instances).toHaveLength(2);
  });
});
