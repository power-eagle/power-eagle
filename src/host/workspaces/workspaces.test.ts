import { describe, expect, it } from 'vitest';
import { ActivationController } from '../activation/controller';
import type { LoadedContribution } from '../install/contribution-package';
import type { Dependency, ExportDescriptor } from '../../sdui/schema/model';
import { newPluginInstance, parseWorkspaceCatalog, pluginInstanceSchema } from './model';
import { InstancePreferences } from './preferences';
import { instanceRegistrations, resolveInstanceClaims, type InstancePackage } from './claims';

const descriptor: ExportDescriptor = { kind: 'service', id: 'value', methods: { get: { input: { type: 'null' }, output: { type: 'string' } } } };
function preferences() {
  let raw: string | null = null;
  const storage = { read: () => raw, write: (next: string) => { raw = next; } };
  return { storage, prefs: InstancePreferences.open(storage) };
}
function plugin(id: string, dependencies: Dependency[] = []): InstancePackage {
  const instance = newPluginInstance(id, { kind: 'local', sourceId: id });
  instance.instanceId = id; instance.namespace = id;
  const manifest = {
    format: 'power-eagle/package' as const, formatVersion: 1 as const, id, name: id,
    version: '1.0.0', description: '', sdk: '^1.0.0', contributions: { services: 'services.cjs' },
    exports: [descriptor], dependencies, assets: [],
  };
  return { instance, discovered: { root: id, manifestPath: `${id}/manifest.json`, manifest, entries: { services: 'services.cjs' }, assets: {} } };
}
function clone(source: InstancePackage): InstancePackage {
  const instance = newPluginInstance(`${source.instance.name} copy`, { kind: 'local', sourceId: 'copy' }, source.instance);
  return { instance, discovered: { ...source.discovered, root: instance.instanceId } };
}
function dependency(namespace: string): Dependency { return { package: namespace, export: 'value', kind: 'service', version: '^1.0.0' }; }

describe('plugin workspace identities', () => {
  it('allocates independent blank namespaces and copied revisions with explicit provenance', () => {
    const original = plugin('original');
    const copy = clone(original);
    expect(copy.instance.instanceId).not.toBe(original.instance.instanceId);
    expect(copy.instance.namespace).toBe('original');
    expect(copy.instance.forkOf).toEqual({ instanceId: 'original', revision: 1 });
    expect(newPluginInstance('Blank', { kind: 'local', sourceId: 'local' }).namespace).not.toBe('original');
    expect(pluginInstanceSchema.safeParse({ ...copy.instance, currentRevision: 5 }).success).toBe(false);
    expect(pluginInstanceSchema.safeParse({ ...copy.instance, namespaceConflict: undefined }).success).toBe(false);
    const catalog = { format: 'power-eagle/workspace-catalog', formatVersion: 1, order: ['original'], instances: [original.instance] };
    expect(parseWorkspaceCatalog(catalog).instances).toHaveLength(1);
    expect(() => parseWorkspaceCatalog({ ...catalog, instances: [original.instance, original.instance] })).toThrow(/unique/);
    expect(() => parseWorkspaceCatalog({ ...catalog, formatVersion: 2 })).toThrow(/incompatible/);
  });

  it('persists independent export preferences and rejects legacy formats or failed writes', () => {
    const { storage, prefs } = preferences();
    prefs.setInstance('copy', true); prefs.setExport('copy', 'value', false);
    const restored = InstancePreferences.open(storage);
    expect(restored.enabled('copy', false)).toBe(true);
    expect(restored.exportEnabled('copy', 'value')).toBe(false);
    expect(restored.exportEnabled('original', 'value')).toBe(true);
    expect(() => InstancePreferences.open({ read: () => '{"format":"power-eagle/enablement"}', write: () => {} })).toThrow(/reset preferences/);
    const failed = InstancePreferences.open({ read: () => null, write: () => { throw new Error('disk full'); } });
    expect(() => failed.setInstance('copy', false)).toThrow('disk full');
    expect(failed.enabled('copy')).toBe(true);
  });
});

describe('exclusive ordered namespace claims', () => {
  it('uses user order, restores originals on disablement, and never fills disabled export holes', () => {
    const source = plugin('source'); const copy = clone(source); const { prefs } = preferences();
    const consumer = plugin('consumer', [dependency('source')]);
    const packages = [source, copy, consumer];
    const ids = ['source', copy.instance.instanceId, 'consumer'];
    prefs.setInstance(copy.instance.instanceId, true);
    let result = resolveInstanceClaims(packages, ids, prefs);
    expect(result.owners.get('source')?.instance.instanceId).toBe('source');
    expect(result.claims.get(copy.instance.instanceId)).toMatchObject({ status: 'off', desired: true, owner: 'source' });
    result = resolveInstanceClaims(packages, [copy.instance.instanceId, 'consumer', 'source'], prefs);
    expect(result.owners.get('source')?.instance.instanceId).toBe(copy.instance.instanceId);
    expect([...result.registry.active.keys()]).toEqual(['source/value', 'consumer/value']);
    prefs.setExport(copy.instance.instanceId, 'value', false);
    result = resolveInstanceClaims(packages, [copy.instance.instanceId, 'consumer', 'source'], prefs);
    expect(result.registry.active.size).toBe(0);
    expect(result.claims.get('consumer')?.status).toBe('failed');
    prefs.setInstance(copy.instance.instanceId, false);
    expect(resolveInstanceClaims(packages, ids, prefs).registry.active.size).toBe(2);
  });

  it('allows orphaned declared forks but rejects unintended duplicates, cross-namespace claims and cycles', () => {
    const source = plugin('source'); const copy = clone(source); const { prefs } = preferences();
    prefs.setInstance(copy.instance.instanceId, true);
    expect(resolveInstanceClaims([copy], [copy.instance.instanceId], prefs).owners.size).toBe(1);
    const unrelated = plugin('unrelated'); unrelated.instance.namespace = 'source'; unrelated.discovered = source.discovered;
    expect(resolveInstanceClaims([source, unrelated], ['source', 'unrelated'], prefs).owners.size).toBe(0);
    const other = plugin('other');
    copy.instance.forkOf!.instanceId = 'other'; copy.instance.namespaceConflict!.sourceInstanceId = 'other';
    expect(resolveInstanceClaims([copy, other], [copy.instance.instanceId, 'other'], prefs).claims.get(copy.instance.instanceId)?.status).toBe('failed');
    copy.instance.forkOf!.instanceId = copy.instance.instanceId;
    expect(() => resolveInstanceClaims([copy], [copy.instance.instanceId], prefs)).toThrow();
  });

  it('does not fall through incompatible winners and retains dependency cycle diagnostics', () => {
    const source = plugin('source'); const copy = clone(source); const consumer = plugin('consumer', [dependency('source')]);
    copy.discovered = { ...copy.discovered, manifest: { ...copy.discovered.manifest, version: '2.0.0' } };
    const { prefs } = preferences(); prefs.setInstance(copy.instance.instanceId, true);
    const result = resolveInstanceClaims([source, copy, consumer], [copy.instance.instanceId, 'source', 'consumer'], prefs);
    expect(result.claims.get('consumer')?.reason).toContain('version');
    expect(result.owners.get('source')?.instance.instanceId).toBe(copy.instance.instanceId);
    const a = plugin('a', [dependency('b')]); const b = plugin('b', [dependency('a')]);
    expect(resolveInstanceClaims([a, b], ['b', 'a'], prefs).registry.active.size).toBe(0);
  });

  it('honors priority among independent providers but activates dependencies first', () => {
    const a = plugin('a', [dependency('b')]); const b = plugin('b'); const z = plugin('z');
    const result = resolveInstanceClaims([a, b, z], ['z', 'a', 'b'], preferences().prefs);
    expect([...result.registry.active.keys()]).toEqual(['z/value', 'b/value', 'a/value']);
  });

  it('revokes old handles and replaces dependents while preserving unrelated instances', async () => {
    const source = plugin('source'); const copy = clone(source); const consumer = plugin('consumer', [dependency('source')]); const unrelated = plugin('unrelated');
    const events: string[] = [];
    const loaded = (name: string, fails = false): LoadedContribution[] => [{
      contribution: 'services', kind: 'service', entry: 'services.cjs', exports: [{
        descriptor, implementation: { methods: { get: () => name } },
        activate: context => { events.push(`${name}:on`); context.use(() => { events.push(`${name}:off`); }); if (fails) throw new Error('broken'); },
      }],
    }];
    const originalReg = instanceRegistrations(source, loaded('source'));
    const cloneReg = instanceRegistrations(copy, loaded('copy'));
    const stable = [...instanceRegistrations(consumer, loaded('consumer')), ...instanceRegistrations(unrelated, loaded('unrelated'))];
    const packages = [source, copy, consumer, unrelated]; const { prefs } = preferences();
    prefs.setInstance(copy.instance.instanceId, true);
    const controller = new ActivationController();
    const context = { signal: new AbortController().signal, use: () => () => {} };
    await controller.reconcile(resolveInstanceClaims(packages, ['source', copy.instance.instanceId, 'consumer', 'unrelated'], prefs).registry, [...originalReg, ...stable]);
    const stale = controller.service('source/value');
    events.length = 0;
    const next = resolveInstanceClaims(packages, [copy.instance.instanceId, 'source', 'consumer', 'unrelated'], prefs);
    await controller.reconcile(next.registry, [...cloneReg, ...stable]);
    expect(events).toEqual(['consumer:off', 'source:off', 'copy:on', 'consumer:on']);
    await expect(stale.invoke('get', null, context)).rejects.toThrow(/no longer active/i);
    await expect(controller.service('source/value').invoke('get', null, context)).resolves.toBe('copy');
    const failed = await controller.reconcile(next.registry, [...instanceRegistrations(copy, loaded('broken', true)), ...stable]);
    expect([...failed.snapshot.all.keys()]).toEqual(['unrelated/value']);
    expect(failed.failures.get('source/value')?.message).toContain('broken');
    await controller.dispose();
  });
});
