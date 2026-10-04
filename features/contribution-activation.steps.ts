import { expect } from 'vitest';
import { describeFeature, loadFeature } from '@amiceli/vitest-cucumber';
import type { Dependency, ExportDescriptor, Json, PackageManifest, RuntimeDocument } from '../src/sdui/schema/model';
import { ActivationScope } from '../src/sdui/runtime/lifecycle';
import { foundationRuntimeCatalog } from '../src/sdui/runtime/foundation';
import { RuntimeSession } from '../src/sdui/runtime/session';
import type { ServiceImplementation, StylingImplementation } from '../src/sdui/sdk/provider';
import type { DiscoveredPackage } from '../src/host/install/contribution-package';
import {
  ActivationController, RevokedServiceHandleError, type ActivationRegistration, type ActivationResult,
} from '../src/host/activation/controller';
import { buildExportRegistryGraph, type ExportRegistryGraph } from '../src/host/activation/dependency-graph';
import {
  EnablementPreferences, reconcileEnablement, type EffectiveRegistry, type EnablementPersistence,
} from '../src/host/activation/enablement';
import { composeStyle, type ActiveStyling, type ComposedStyle } from '../src/host/activation/styling';

class MemoryPersistence implements EnablementPersistence {
  value: string | null = null;
  read(): string | null { return this.value; }
  write(value: string): void { this.value = value; }
}

const emptyObject = { type: 'object' as const, properties: {}, required: [] };
const nullSchema = { type: 'null' as const };
const stringSchema = { type: 'string' as const };

function widget(id: string, packageId = 'ui'): ExportDescriptor {
  return {
    kind: 'widget', id,
    contract: {
      properties: emptyObject, defaults: {}, slots: {}, events: {}, themeHooks: ['surface'],
      example: { type: `${packageId}/${id}` },
    },
  };
}

function styling(id = 'theme', targets = ['ui/button']): ExportDescriptor {
  return { kind: 'styling', id, tokens: emptyObject, targets };
}

function runtime(id = 'main', screens = ['home']): ExportDescriptor {
  return { kind: 'runtime', id, screens };
}

function service(id: string): ExportDescriptor {
  return { kind: 'service', id, methods: { ping: { input: nullSchema, output: stringSchema }, watch: { input: nullSchema, output: stringSchema } } };
}

function dependency(packageId: string, exportId: string, kind: Dependency['kind']): Dependency {
  return { package: packageId, export: exportId, kind, version: '^1.0.0' };
}

function discovered(
  id: string,
  exports: ExportDescriptor[],
  runtimeDependencies: Dependency[] = [],
  document?: RuntimeDocument,
): DiscoveredPackage {
  const root = `C:/activation-feature/${id}`;
  const hasRuntime = exports.some(item => item.kind === 'runtime');
  const manifest: PackageManifest = {
    format: 'power-eagle/package', formatVersion: 1, id, name: id, version: '1.0.0', description: 'fixture', sdk: '^1.0.0',
    contributions: {
      ...(hasRuntime ? { runtime: 'run.json' } : {}),
      ...(exports.some(item => item.kind === 'widget') ? { widgets: 'types.cjs' } : {}),
      ...(exports.some(item => item.kind === 'styling') ? { styling: 'styling.cjs' } : {}),
      ...(exports.some(item => item.kind === 'service') ? { services: 'services.cjs' } : {}),
    },
    exports, dependencies: [], assets: [],
  };
  const fallback: RuntimeDocument | undefined = hasRuntime ? {
    format: 'power-eagle/runtime', formatVersion: 1, start: 'home', state: {}, components: {}, actions: {},
    dependencies: runtimeDependencies,
    screens: { home: { params: emptyObject, state: {}, body: { type: 'Text', props: { text: id } } } },
  } : undefined;
  return {
    root, manifestPath: `${root}/manifest.json`, manifest, entries: {}, assets: {},
    ...((document ?? fallback) ? { runtime: document ?? fallback } : {}),
  };
}

function serviceValue(value: string | ServiceImplementation['methods'][string] = 'pong'): ServiceImplementation {
  const invoke: ServiceImplementation['methods'][string] = typeof value === 'string' ? () => value : value;
  return { methods: { ping: invoke, watch: invoke } };
}

function active(packages: DiscoveredPackage[], preferences = EnablementPreferences.open(new MemoryPersistence())): EffectiveRegistry {
  return reconcileEnablement(buildExportRegistryGraph(packages), preferences);
}

function callScope(): { scope: ActivationScope; context: { signal: AbortSignal; use(disposer: () => void | Promise<void>): void } } {
  const scope = new ActivationScope('feature-call');
  return { scope, context: { signal: scope.signal, use: disposer => scope.use(disposer) } };
}

function activeStyle(identity: string, implementation: StylingImplementation): ActiveStyling {
  return { identity, targets: ['ui/button'], implementation };
}

const feature = await loadFeature('features/contribution-activation.feature');
describeFeature(feature, ({ Scenario, AfterEachScenario }) => {
  const cleanup: Array<() => Promise<void>> = [];
  const trackController = (controller: ActivationController): ActivationController => {
    cleanup.push(() => controller.dispose());
    return controller;
  };
  const trackSession = (session: RuntimeSession): RuntimeSession => {
    cleanup.push(() => session.dispose());
    return session;
  };

  AfterEachScenario(async () => {
    for (const dispose of cleanup.splice(0).reverse()) await dispose();
  });

  Scenario('Resolve a runtime after its widget and styling providers', ({ Given, When, Then }) => {
    let packages: DiscoveredPackage[] = [];
    let graph: ExportRegistryGraph;
    Given('a runtime depends on compatible widget and styling exports', () => {
      const application = discovered('app', [runtime()], [
        dependency('ui', 'button', 'widget'), dependency('theme', 'theme', 'styling'),
      ]);
      packages = [application, discovered('theme', [styling()]), discovered('ui', [widget('button')])];
    });
    When('the contribution dependency graph is built', () => { graph = buildExportRegistryGraph(packages); });
    Then('both providers precede the runtime in activation order', () => {
      expect(graph.available.has('app/main')).toBe(true);
      expect(graph.activationOrder.indexOf('theme/theme')).toBeLessThan(graph.activationOrder.indexOf('app/main'));
      expect(graph.activationOrder.indexOf('ui/button')).toBeLessThan(graph.activationOrder.indexOf('app/main'));
    });
  });

  Scenario('Isolate a dependency cycle', ({ Given, When, Then }) => {
    let packages: DiscoveredPackage[] = [];
    let graph: ExportRegistryGraph;
    Given('two runtimes form a dependency cycle beside an unrelated runtime', () => {
      packages = [
        discovered('a', [runtime()], [dependency('b', 'main', 'runtime')]),
        discovered('b', [runtime()], [dependency('a', 'main', 'runtime')]),
        discovered('independent', [runtime()]),
      ];
    });
    When('the contribution dependency graph is built', () => { graph = buildExportRegistryGraph(packages); });
    Then('the cycle is diagnosed and the unrelated runtime remains available', () => {
      expect(graph.exports.filter(item => ['a/main', 'b/main'].includes(item.identity)).every(item =>
        item.diagnostics.some(diagnostic => diagnostic.code === 'dependency-cycle'))).toBe(true);
      expect(graph.available.has('independent/main')).toBe(true);
    });
  });

  Scenario('Preserve individual choices through package toggles and reload', ({ Given, When, Then }) => {
    const persistence = new MemoryPersistence();
    const graph = buildExportRegistryGraph([discovered('ui', [widget('primary'), widget('secondary')])]);
    let preferences: EnablementPreferences;
    let registry: EffectiveRegistry;
    Given('one widget export is disabled', () => {
      preferences = EnablementPreferences.open(persistence);
      preferences.setExport('ui/primary', false);
    });
    When('its package is disabled, enabled, and preferences are reopened', () => {
      preferences.setPackage('ui', false);
      preferences.setPackage('ui', true);
      preferences = EnablementPreferences.open(persistence);
      registry = reconcileEnablement(graph, preferences);
    });
    Then('that widget stays off while its sibling is active', () => {
      expect(registry.exports.find(item => item.identity === 'ui/primary')?.effectiveStatus).toBe('off');
      expect(registry.exports.find(item => item.identity === 'ui/secondary')?.effectiveStatus).toBe('active');
    });
  });

  Scenario('Revoke and restore an active service dependency', ({ Given, When, Then }) => {
    const persistence = new MemoryPersistence();
    const preferences = EnablementPreferences.open(persistence);
    const provider = discovered('provider', [service('clock')]);
    const consumer = discovered('consumer', [runtime()], [dependency('provider', 'clock', 'service')]);
    const unrelated = discovered('unrelated', [runtime()]);
    const graph = buildExportRegistryGraph([consumer, provider, unrelated]);
    const events: string[] = [];
    const registrations: ActivationRegistration[] = [
      {
        identity: 'provider/clock', packageId: 'provider', group: 'provider:services', kind: 'service', value: serviceValue(),
        activate: () => { events.push('provider:activate'); return () => { events.push('provider:dispose'); }; },
      },
      {
        identity: 'consumer/main', packageId: 'consumer', group: 'consumer:runtime', kind: 'runtime', value: consumer.runtime,
        activate: () => { events.push('consumer:activate'); return () => { events.push('consumer:dispose'); }; },
      },
      { identity: 'unrelated/main', packageId: 'unrelated', group: 'unrelated:runtime', kind: 'runtime', value: unrelated.runtime },
    ];
    let controller: ActivationController;
    let stale: ReturnType<ActivationController['service']>;
    let unrelatedStayedActive = false;
    let disabledReason: string | undefined;
    let result: ActivationResult;

    Given('a runtime is active with a required service and an unrelated runtime', async () => {
      controller = trackController(new ActivationController());
      await controller.reconcile(reconcileEnablement(graph, preferences), registrations);
      stale = controller.service('provider/clock');
    });
    When('the required service is disabled and enabled again', async () => {
      preferences.setExport('provider/clock', false);
      const disabled = reconcileEnablement(graph, preferences);
      disabledReason = disabled.exports.find(item => item.identity === 'consumer/main')?.reason?.code;
      const whileDisabled = await controller.reconcile(disabled, registrations);
      unrelatedStayedActive = whileDisabled.snapshot.runtime.has('unrelated/main');
      preferences.setExport('provider/clock', true);
      result = await controller.reconcile(reconcileEnablement(graph, preferences), registrations);
    });
    Then('stale handles fail and enabled consumers recover in dependency order', async () => {
      const staleCall = callScope();
      await expect(stale.invoke('ping', null, staleCall.context)).rejects.toBeInstanceOf(RevokedServiceHandleError);
      await staleCall.scope.dispose();
      const freshCall = callScope();
      await expect(controller.service('provider/clock').invoke('ping', null, freshCall.context)).resolves.toBe('pong');
      await freshCall.scope.dispose();
      expect(disabledReason).toBe('dependency-off');
      expect(unrelatedStayedActive).toBe(true);
      expect(result.snapshot.runtime.has('consumer/main')).toBe(true);
      expect(events.slice(-2)).toEqual(['provider:activate', 'consumer:activate']);
    });
  });

  Scenario('Replace a view without stopping its service', ({ Given, When, Then }) => {
    const descriptor = service('watcher');
    const document: RuntimeDocument = {
      format: 'power-eagle/runtime', formatVersion: 1, start: 'home', state: {}, components: {},
      dependencies: [dependency('provider', 'watcher', 'service')],
      actions: { watch: { kind: 'call', target: 'provider/watcher', method: 'watch', args: null } },
      screens: {
        home: { params: emptyObject, state: {}, body: { type: 'Text', props: { text: 'Home' } } },
        detail: { params: emptyObject, state: {}, body: { type: 'Text', props: { text: 'Detail' } } },
      },
    };
    const provider = discovered('provider', [descriptor]);
    const consumer = discovered('consumer', [runtime('main', ['home', 'detail'])], document.dependencies, document);
    let providerLive = 0;
    let viewResources = 0;
    let controller: ActivationController;
    let session: RuntimeSession;

    Given('a view owns a resource created through an active package service', async () => {
      controller = trackController(new ActivationController());
      const registrations: ActivationRegistration[] = [
        {
          identity: 'provider/watcher', packageId: 'provider', group: 'provider:services', kind: 'service',
          value: serviceValue((_args, context) => {
            viewResources += 1;
            context.use(() => { viewResources -= 1; });
            return 'watching';
          }),
          activate: () => { providerLive += 1; return () => { providerLive -= 1; }; },
        },
        { identity: 'consumer/main', packageId: 'consumer', group: 'consumer:runtime', kind: 'runtime', value: document },
      ];
      await controller.reconcile(active([consumer, provider]), registrations);
      const handle = controller.service('provider/watcher');
      session = trackSession(new RuntimeSession(document, {
        ...foundationRuntimeCatalog,
        exports: { 'provider/watcher': { version: '1.0.0', descriptor } },
      }, {
        calls: {
          'provider/watcher': {
            input: nullSchema, output: stringSchema,
            invoke: (args: Json, context) => handle.invoke(context.method ?? 'watch', args, context),
          },
        },
      }));
      await session.run('watch');
      expect([providerLive, viewResources]).toEqual([1, 1]);
    });
    When('the runtime replaces that view', async () => {
      await session.navigation.navigate('replace', 'detail', {});
    });
    Then('the view resource is disposed and the package service stays active', async () => {
      expect([providerLive, viewResources]).toEqual([1, 0]);
      const call = callScope();
      await expect(controller.service('provider/watcher').invoke('ping', null, call.context)).resolves.toBe('watching');
      expect([providerLive, viewResources]).toEqual([1, 1]);
      await call.scope.dispose();
      expect([providerLive, viewResources]).toEqual([1, 0]);
    });
  });

  Scenario('Toggle a provider without accumulating resources', ({ Given, When, Then }) => {
    const provider = discovered('provider', [service('clock')]);
    const graph = buildExportRegistryGraph([provider]);
    const preferences = EnablementPreferences.open(new MemoryPersistence());
    let live = 0;
    let activations = 0;
    let disposals = 0;
    let controller: ActivationController;
    const registrations: ActivationRegistration[] = [{
      identity: 'provider/clock', packageId: 'provider', group: 'provider:services', kind: 'service', value: serviceValue(),
      activate: () => {
        live += 1;
        activations += 1;
        return () => { live -= 1; disposals += 1; };
      },
    }];
    Given('a provider has one live resource', async () => {
      controller = trackController(new ActivationController());
      await controller.reconcile(reconcileEnablement(graph, preferences), registrations);
      expect(live).toBe(1);
    });
    When('the provider is disabled and enabled repeatedly', async () => {
      for (let index = 0; index < 2; index += 1) {
        preferences.setPackage('provider', false);
        await controller.reconcile(reconcileEnablement(graph, preferences), registrations);
        preferences.setPackage('provider', true);
        await controller.reconcile(reconcileEnablement(graph, preferences), registrations);
      }
    });
    Then('every completed lifetime is disposed once and one resource remains live', () => {
      expect({ live, activations, disposals }).toEqual({ live: 1, activations: 3, disposals: 2 });
    });
  });

  Scenario('Roll back a provider activation failure', ({ Given, When, Then }) => {
    const partial = discovered('partial', [service('first'), service('second')]);
    const unrelated = discovered('unrelated', [widget('badge', 'unrelated')]);
    const events: string[] = [];
    let registrations: ActivationRegistration[] = [];
    let controller: ActivationController;
    let result: ActivationResult;
    Given('one export in a provider group throws during activation', () => {
      registrations = [
        {
          identity: 'partial/first', packageId: 'partial', group: 'partial:services', kind: 'service', value: serviceValue(),
          activate: context => { events.push('first:activate'); context.use(() => { events.push('first:dispose'); }); },
        },
        {
          identity: 'partial/second', packageId: 'partial', group: 'partial:services', kind: 'service', value: serviceValue(),
          activate: () => { events.push('second:activate'); throw new Error('second failed'); },
        },
        { identity: 'unrelated/badge', packageId: 'unrelated', group: 'unrelated:widgets', kind: 'widget', value: {} },
      ];
    });
    When('the contribution registrations are reconciled', async () => {
      controller = trackController(new ActivationController());
      result = await controller.reconcile(active([partial, unrelated]), registrations);
    });
    Then('the group is hidden, prepared resources are disposed, and unrelated exports remain active', () => {
      expect(result.snapshot.all.has('partial/first')).toBe(false);
      expect(result.snapshot.all.has('partial/second')).toBe(false);
      expect(result.snapshot.widget.has('unrelated/badge')).toBe(true);
      expect(result.failures.get('partial/first')?.message).toContain('second failed');
      expect(events).toEqual(['first:activate', 'second:activate', 'first:dispose']);
    });
  });

  Scenario('Reload changed provider code', ({ Given, When, Then }) => {
    const provider = discovered('provider', [service('clock')]);
    const registry = active([provider]);
    const events: string[] = [];
    let controller: ActivationController;
    let stale: ReturnType<ActivationController['service']>;
    let updated: ActivationRegistration;
    Given('a service provider is active with its original implementation', async () => {
      controller = trackController(new ActivationController());
      const original: ActivationRegistration = {
        identity: 'provider/clock', packageId: 'provider', group: 'provider:services', kind: 'service', value: serviceValue('original'),
        activate: () => { events.push('original:activate'); return () => { events.push('original:dispose'); }; },
      };
      await controller.reconcile(registry, [original]);
      stale = controller.service('provider/clock');
      updated = {
        ...original, value: serviceValue('updated'),
        activate: () => { events.push('updated:activate'); return () => { events.push('updated:dispose'); }; },
      };
    });
    When('its registration is replaced with an updated implementation', async () => {
      await controller.reconcile(registry, [updated]);
    });
    Then('new handles use the update and the old scope and handle are revoked', async () => {
      const oldCall = callScope();
      await expect(stale.invoke('ping', null, oldCall.context)).rejects.toBeInstanceOf(RevokedServiceHandleError);
      await oldCall.scope.dispose();
      const newCall = callScope();
      await expect(controller.service('provider/clock').invoke('ping', null, newCall.context)).resolves.toBe('updated');
      await newCall.scope.dispose();
      expect(events).toEqual(['original:activate', 'original:dispose', 'updated:activate']);
    });
  });

  Scenario('Count distinct declared consumers', ({ Given, When, Then }) => {
    let packages: DiscoveredPackage[] = [];
    let graph: ExportRegistryGraph;
    Given('two packages directly require one export and another export is unused', () => {
      const provider = discovered('provider', [service('shared'), widget('unused', 'provider')]);
      const first = discovered('first', [runtime()], [dependency('provider', 'shared', 'service')]);
      const second = discovered('second', [runtime()], [dependency('provider', 'shared', 'service')]);
      packages = [second, provider, first];
    });
    When('contribution usage is inspected', () => { graph = buildExportRegistryGraph(packages); });
    Then('the provider is used by both package identities and the other export is unused', () => {
      expect(graph.exports.find(item => item.identity === 'provider/shared')?.directConsumers).toEqual(['first', 'second']);
      expect(graph.exports.find(item => item.identity === 'provider/unused')?.directConsumers).toEqual([]);
    });
  });

  Scenario('Remove a disabled optional theme', ({ Given, When, Then }) => {
    const theme = activeStyle('theme/optional', {
      tokens: { accent: 'theme' }, variants: {}, overrides: { 'ui/button': { background: 'theme', padding: 4 } },
    });
    const input = {
      widget: 'ui/button', host: { tokens: { accent: 'host' }, style: { color: 'host', padding: 1 } },
      packageThemes: [{ identity: 'theme/optional', order: 10 }], nodeStyle: { color: 'node' },
    } as const;
    let selected: ComposedStyle;
    let disabled: ComposedStyle;
    Given('an optional package theme and an explicit node color are selected', () => {
      selected = composeStyle(new Map([['theme/optional', theme]]), input);
    });
    When('the optional theme becomes unavailable', () => {
      disabled = composeStyle(new Map(), input);
    });
    Then('its values disappear while host defaults and the node color remain', () => {
      expect(selected).toEqual({
        tokens: { accent: 'theme' }, style: { color: 'node', padding: 4, background: 'theme' }, applied: ['theme/optional'],
      });
      expect(disabled).toEqual({ tokens: { accent: 'host' }, style: { color: 'node', padding: 1 }, applied: [] });
    });
  });

  Scenario('Keep styling independent from discovery order', ({ Given, When, Then }) => {
    const packageFirst = activeStyle('theme/first', {
      tokens: { accent: 'first' }, variants: {}, overrides: { 'ui/button': { color: 'first' } },
    });
    const packageLast = activeStyle('theme/last', {
      tokens: { accent: 'last' }, variants: { dense: { padding: 4 } }, overrides: { 'ui/button': { color: 'last' } },
    });
    const view = activeStyle('theme/view', {
      tokens: { accent: 'view' }, variants: {}, overrides: { 'ui/button': { color: 'view' } },
    });
    const input = {
      widget: 'ui/button', host: { tokens: { accent: 'host' }, style: { color: 'host' } },
      packageThemes: [
        { identity: 'theme/last', order: 20, variants: ['dense'] },
        { identity: 'theme/first', order: 10 },
      ],
      viewThemes: [{ identity: 'theme/view', order: 10 }], nodeStyle: { border: 'node' },
    } as const;
    let normal: ComposedStyle;
    let reversed: ComposedStyle;
    Given('selected themes have explicit package and view ordering', () => {
      normal = composeStyle(new Map([
        ['theme/first', packageFirst], ['theme/last', packageLast], ['theme/view', view],
      ]), input);
    });
    When('their catalog discovery order changes', () => {
      reversed = composeStyle(new Map([
        ['theme/view', view], ['theme/last', packageLast], ['theme/first', packageFirst],
      ]), input);
    });
    Then('the composed tokens and styles remain identical', () => {
      expect(reversed).toEqual(normal);
      expect(normal).toEqual({
        tokens: { accent: 'view' }, style: { color: 'view', padding: 4, border: 'node' },
        applied: ['theme/first', 'theme/last', 'theme/view'],
      });
    });
  });
});
