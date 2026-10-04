import { describe, expect, it } from 'vitest';
import type { Dependency, ExportDescriptor, Json, PackageManifest, RuntimeDocument } from '../../sdui/schema/model';
import { ActivationScope } from '../../sdui/runtime/lifecycle';
import { foundationRuntimeCatalog } from '../../sdui/runtime/foundation';
import { RuntimeSession } from '../../sdui/runtime/session';
import type { ServiceImplementation } from '../../sdui/sdk/provider';
import type { DiscoveredPackage } from '../install/contribution-package';
import { ActivationController, RevokedServiceHandleError, type ActivationRegistration } from './controller';
import { buildExportRegistryGraph } from './dependency-graph';
import { EnablementPreferences, reconcileEnablement, type EnablementPersistence } from './enablement';

class MemoryPersistence implements EnablementPersistence {
  value: string | null = null;
  read(): string | null { return this.value; }
  write(value: string): void { this.value = value; }
}

const emptyObject = { type: 'object' as const, properties: {}, required: [] };
const nullSchema = { type: 'null' as const };
const stringSchema = { type: 'string' as const };

function widget(id: string): ExportDescriptor {
  return {
    kind: 'widget', id,
    contract: { properties: emptyObject, defaults: {}, slots: {}, events: {}, themeHooks: [], example: { type: `fixture/${id}` } },
  };
}
function runtime(): ExportDescriptor { return { kind: 'runtime', id: 'main', screens: ['home'] }; }
function service(id: string): ExportDescriptor {
  return { kind: 'service', id, methods: { ping: { input: nullSchema, output: stringSchema }, watch: { input: nullSchema, output: stringSchema } } };
}
function dependency(packageId: string, exportId: string, kind: Dependency['kind']): Dependency {
  return { package: packageId, export: exportId, kind, version: '^1.0.0' };
}

function discovered(id: string, exports: ExportDescriptor[], runtimeDependencies: Dependency[] = [], document?: RuntimeDocument): DiscoveredPackage {
  const root = `C:/activation/${id}`;
  const hasRuntime = exports.some(item => item.kind === 'runtime');
  const manifest: PackageManifest = {
    format: 'power-eagle/package', formatVersion: 1, id, name: id, version: '1.0.0', description: 'fixture', sdk: '^1.0.0',
    contributions: {
      ...(hasRuntime ? { runtime: 'run.json' } : {}),
      ...(exports.some(item => item.kind === 'widget') ? { widgets: 'types.cjs' } : {}),
      ...(exports.some(item => item.kind === 'service') ? { services: 'services.cjs' } : {}),
    },
    exports, dependencies: [], assets: [],
  };
  const fallback: RuntimeDocument | undefined = hasRuntime ? {
    format: 'power-eagle/runtime', formatVersion: 1, start: 'home', state: {}, components: {}, actions: {}, dependencies: runtimeDependencies,
    screens: { home: { params: emptyObject, state: {}, body: { type: 'Text', props: { text: id } } } },
  } : undefined;
  return { root, manifestPath: `${root}/manifest.json`, manifest, entries: {}, assets: {}, ...((document ?? fallback) ? { runtime: document ?? fallback } : {}) };
}

function effective(packages: DiscoveredPackage[], preferences = EnablementPreferences.open(new MemoryPersistence())) {
  return reconcileEnablement(buildExportRegistryGraph(packages), preferences);
}

function serviceValue(method?: ServiceImplementation['methods'][string]): ServiceImplementation {
  const invoke = method ?? (() => 'pong');
  return { methods: { ping: invoke, watch: invoke } };
}

function callContext(scope = new ActivationScope('test-call')) {
  return { scope, context: { signal: scope.signal, use: (disposer: () => void | Promise<void>) => scope.use(disposer) } };
}

describe('transactional contribution activation', () => {
  it('rolls back a partially activated provider group while publishing an unrelated export', async () => {
    const partial = discovered('partial', [service('first'), service('second')]);
    const unrelated = discovered('unrelated', [widget('badge')]);
    const events: string[] = [];
    const registrations: ActivationRegistration[] = [
      {
        identity: 'partial/first', packageId: 'partial', group: 'partial:services', kind: 'service', value: serviceValue(),
        activate: context => { events.push('first:activate'); context.use(() => { events.push('first:dispose'); }); },
      },
      {
        identity: 'partial/second', packageId: 'partial', group: 'partial:services', kind: 'service', value: serviceValue(),
        activate: () => { events.push('second:activate'); throw new Error('second failed'); },
      },
      {
        identity: 'unrelated/badge', packageId: 'unrelated', group: 'unrelated:widgets', kind: 'widget', value: {},
        activate: () => { events.push('badge:activate'); return () => { events.push('badge:dispose'); }; },
      },
    ];
    const controller = new ActivationController();
    const result = await controller.reconcile(effective([partial, unrelated]), registrations);

    expect([...result.snapshot.all.keys()]).toEqual(['unrelated/badge']);
    expect(result.failures.get('partial/first')?.message).toContain('second failed');
    expect(result.failures.get('partial/second')?.message).toContain('second failed');
    expect(events).toEqual(['first:activate', 'second:activate', 'first:dispose', 'badge:activate']);
    expect(() => controller.service('partial/first')).toThrow(RevokedServiceHandleError);
    await controller.dispose();
    expect(events[events.length - 1]).toBe('badge:dispose');
  });

  it('revokes stale service handles and disposes dependents before providers across repeated toggles', async () => {
    const provider = discovered('provider', [service('clock')]);
    const consumer = discovered('consumer', [runtime()], [dependency('provider', 'clock', 'service')]);
    const persistence = new MemoryPersistence();
    const preferences = EnablementPreferences.open(persistence);
    const graph = buildExportRegistryGraph([consumer, provider]);
    const events: string[] = [];
    let providerLive = 0;
    let consumerLive = 0;
    const registrations: ActivationRegistration[] = [
      {
        identity: 'provider/clock', packageId: 'provider', group: 'provider:services', kind: 'service', value: serviceValue(),
        activate: () => { providerLive += 1; events.push('provider:activate'); return () => { providerLive -= 1; events.push('provider:dispose'); }; },
      },
      {
        identity: 'consumer/main', packageId: 'consumer', group: 'consumer:runtime', kind: 'runtime', value: consumer.runtime,
        activate: () => { consumerLive += 1; events.push('consumer:activate'); return () => { consumerLive -= 1; events.push('consumer:dispose'); }; },
      },
    ];
    const controller = new ActivationController();
    await controller.reconcile(reconcileEnablement(graph, preferences), registrations);
    const stale = controller.service('provider/clock');
    const firstCall = callContext();
    await expect(stale.invoke('ping', null, firstCall.context)).resolves.toBe('pong');
    await firstCall.scope.dispose();

    preferences.setPackage('provider', false);
    await controller.reconcile(reconcileEnablement(graph, preferences), registrations);
    expect(events.slice(-2)).toEqual(['consumer:dispose', 'provider:dispose']);
    expect([providerLive, consumerLive]).toEqual([0, 0]);
    const staleCall = callContext();
    await expect(stale.invoke('ping', null, staleCall.context)).rejects.toBeInstanceOf(RevokedServiceHandleError);
    await staleCall.scope.dispose();

    preferences.setPackage('provider', true);
    await controller.reconcile(reconcileEnablement(graph, preferences), registrations);
    expect([providerLive, consumerLive]).toEqual([1, 1]);
    const fresh = controller.service('provider/clock');
    const freshCall = callContext();
    await expect(fresh.invoke('ping', null, freshCall.context)).resolves.toBe('pong');
    await freshCall.scope.dispose();
    await expect(stale.invoke('ping', null, callContext().context)).rejects.toBeInstanceOf(RevokedServiceHandleError);

    preferences.setPackage('provider', false);
    await controller.reconcile(reconcileEnablement(graph, preferences), registrations);
    preferences.setPackage('provider', true);
    await controller.reconcile(reconcileEnablement(graph, preferences), registrations);
    expect([providerLive, consumerLive]).toEqual([1, 1]);
    await controller.dispose();
    expect([providerLive, consumerLive]).toEqual([0, 0]);
  });

  it('disposes view resources on replacement without stopping the provider service', async () => {
    const serviceDescriptor = service('watcher');
    const document: RuntimeDocument = {
      format: 'power-eagle/runtime', formatVersion: 1, start: 'home', state: {}, components: {},
      dependencies: [dependency('provider', 'watcher', 'service')],
      actions: { watch: { kind: 'call', target: 'provider/watcher', method: 'watch', args: null } },
      screens: {
        home: { params: emptyObject, state: {}, body: { type: 'Text', props: { text: 'Home' } } },
        detail: { params: emptyObject, state: {}, body: { type: 'Text', props: { text: 'Detail' } } },
      },
    };
    const provider = discovered('provider', [serviceDescriptor]);
    const consumer = discovered('consumer', [{ kind: 'runtime', id: 'main', screens: ['home', 'detail'] }], document.dependencies, document);
    let providerLive = 0;
    let viewResources = 0;
    const implementation = serviceValue((_args, context) => {
      viewResources += 1;
      context.use(() => { viewResources -= 1; });
      return 'watching';
    });
    const registrations: ActivationRegistration[] = [
      {
        identity: 'provider/watcher', packageId: 'provider', group: 'provider:services', kind: 'service', value: implementation,
        activate: () => { providerLive += 1; return () => { providerLive -= 1; }; },
      },
      { identity: 'consumer/main', packageId: 'consumer', group: 'consumer:runtime', kind: 'runtime', value: document },
    ];
    const controller = new ActivationController();
    await controller.reconcile(effective([consumer, provider]), registrations);
    const handle = controller.service('provider/watcher');
    const catalog = {
      ...foundationRuntimeCatalog,
      exports: { 'provider/watcher': { version: '1.0.0', descriptor: serviceDescriptor } },
    };
    const session = new RuntimeSession(document, catalog, {
      calls: {
        'provider/watcher': {
          input: nullSchema, output: stringSchema,
          invoke: (args: Json, context) => handle.invoke(context.method ?? 'watch', args, context),
        },
      },
    });

    await expect(session.run('watch')).resolves.toBe('watching');
    expect([providerLive, viewResources]).toEqual([1, 1]);
    await session.navigation.navigate('replace', 'detail', {});
    expect([providerLive, viewResources]).toEqual([1, 0]);
    await expect(session.run('watch')).resolves.toBe('watching');
    expect([providerLive, viewResources]).toEqual([1, 1]);
    await session.dispose();
    expect([providerLive, viewResources]).toEqual([1, 0]);
    await controller.dispose();
    expect(providerLive).toBe(0);
  });
});
