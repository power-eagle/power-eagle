import { describe, expect, it } from 'vitest';
import type { Dependency, ExportDescriptor, PackageManifest, RuntimeDocument } from '../../sdui/schema/model';
import type { DiscoveredPackage } from '../install/contribution-package';
import { buildExportRegistryGraph } from './dependency-graph';
import {
  EnablementPreferenceError, EnablementPreferences, reconcileEnablement, type EnablementPersistence,
} from './enablement';

class MemoryPersistence implements EnablementPersistence {
  value: string | null = null;
  read(): string | null { return this.value; }
  write(value: string): void { this.value = value; }
}

const emptyObject = { type: 'object' as const, properties: {}, required: [] };
function widget(id: string): ExportDescriptor {
  return {
    kind: 'widget', id,
    contract: { properties: emptyObject, defaults: {}, slots: {}, events: {}, themeHooks: [], example: { type: `fixture/${id}` } },
  };
}
function runtime(): ExportDescriptor { return { kind: 'runtime', id: 'main', screens: ['home'] }; }
function dependency(packageId: string, exportId: string, kind: Dependency['kind']): Dependency {
  return { package: packageId, export: exportId, kind, version: '^1.0.0' };
}
function discovered(id: string, exports: ExportDescriptor[], runtimeDependencies: Dependency[] = []): DiscoveredPackage {
  const root = `C:/enablement/${id}`;
  const hasRuntime = exports.some(item => item.kind === 'runtime');
  const manifest: PackageManifest = {
    format: 'power-eagle/package', formatVersion: 1, id, name: id, version: '1.0.0', description: 'fixture', sdk: '^1.0.0',
    contributions: {
      ...(hasRuntime ? { runtime: 'run.json' } : {}),
      ...(exports.some(item => item.kind === 'widget') ? { widgets: 'types.cjs' } : {}),
    },
    exports, dependencies: [], assets: [],
  };
  const document: RuntimeDocument | undefined = hasRuntime ? {
    format: 'power-eagle/runtime', formatVersion: 1, start: 'home', state: {}, components: {}, actions: {}, dependencies: runtimeDependencies,
    screens: { home: { params: emptyObject, state: {}, body: { type: 'Text', props: { text: id } } } },
  } : undefined;
  return { root, manifestPath: `${root}/manifest.json`, manifest, entries: {}, assets: {}, ...(document ? { runtime: document } : {}) };
}

function status(registry: ReturnType<typeof reconcileEnablement>, identity: string) {
  return registry.exports.find(item => item.identity === identity)!;
}

describe('persistent activation preferences', () => {
  it('uses host defaults only for packages without an explicit saved choice', () => {
    const persistence = new MemoryPersistence();
    const original = EnablementPreferences.open(persistence);
    original.setPackage('unrelated', false);
    const defaults = { 'power-eagle.paper-pop': false };
    const updated = EnablementPreferences.open(persistence, defaults);
    expect(updated.packageEnabled('power-eagle.paper-pop')).toBe(false);
    expect(updated.packageEnabled('unrelated')).toBe(false);
    expect(updated.packageEnabled('other')).toBe(true);
    updated.setPackage('power-eagle.paper-pop', true);
    expect(EnablementPreferences.open(persistence, defaults).packageEnabled('power-eagle.paper-pop')).toBe(true);
  });

  it('stores a versioned deterministic record and restores package/export choices', () => {
    const persistence = new MemoryPersistence();
    const preferences = EnablementPreferences.open(persistence);
    expect(preferences.packageEnabled('provider')).toBe(true);
    expect(preferences.exportEnabled('provider/secondary')).toBe(true);

    preferences.setExport('provider/secondary', false);
    preferences.setPackage('provider', false);
    preferences.setPackage('another', true);
    const restored = EnablementPreferences.open(persistence);

    expect(restored.packageEnabled('provider')).toBe(false);
    expect(restored.exportEnabled('provider/secondary')).toBe(false);
    expect(restored.snapshot()).toEqual({
      format: 'power-eagle/enablement', formatVersion: 1,
      packages: { another: true, provider: false }, exports: { 'provider/secondary': false },
    });
    persistence.value = '{"format":"legacy"}';
    expect(() => EnablementPreferences.open(persistence)).toThrow(EnablementPreferenceError);
  });

  it('preserves export preferences through package toggles and recovers dependents', () => {
    const provider = discovered('provider', [widget('primary'), widget('secondary')]);
    const consumer = discovered('consumer', [runtime()], [dependency('provider', 'primary', 'widget')]);
    const independent = discovered('independent', [runtime()]);
    const graph = buildExportRegistryGraph([consumer, independent, provider]);
    const persistence = new MemoryPersistence();
    let preferences = EnablementPreferences.open(persistence);
    preferences.setExport('provider/secondary', false);
    preferences.setPackage('provider', false);

    let registry = reconcileEnablement(graph, preferences);
    expect(status(registry, 'provider/primary').effectiveStatus).toBe('off');
    expect(status(registry, 'provider/secondary').effectiveStatus).toBe('off');
    expect(status(registry, 'consumer/main').effectiveStatus).toBe('failed');
    expect(status(registry, 'consumer/main').reason).toEqual(expect.objectContaining({ code: 'dependency-off', dependency: 'provider/primary' }));
    expect(status(registry, 'independent/main').effectiveStatus).toBe('active');

    preferences = EnablementPreferences.open(persistence);
    preferences.setPackage('provider', true);
    registry = reconcileEnablement(graph, preferences);
    expect(status(registry, 'provider/primary').effectiveStatus).toBe('active');
    expect(status(registry, 'provider/secondary').effectiveStatus).toBe('off');
    expect(status(registry, 'consumer/main').effectiveStatus).toBe('active');
    expect(registry.packages.get('provider')?.effectiveStatus).toBe('active');

    preferences.setExport('provider/primary', false);
    registry = reconcileEnablement(graph, preferences);
    expect(status(registry, 'consumer/main').reason).toEqual(expect.objectContaining({ code: 'dependency-off', dependency: 'provider/primary' }));
    preferences.setExport('provider/primary', true);
    registry = reconcileEnablement(graph, preferences);
    expect(status(registry, 'consumer/main').effectiveStatus).toBe('active');
    expect([...registry.active]).toEqual(expect.arrayContaining([
      expect.arrayContaining(['provider/primary']), expect.arrayContaining(['consumer/main']), expect.arrayContaining(['independent/main']),
    ]));
  });

  it('shows structural failure causes only while the failed export is desired', () => {
    const missing = discovered('consumer', [runtime()], [dependency('missing', 'service', 'service')]);
    const graph = buildExportRegistryGraph([missing]);
    const preferences = EnablementPreferences.open(new MemoryPersistence());

    expect(status(reconcileEnablement(graph, preferences), 'consumer/main').reason).toEqual(expect.objectContaining({ code: 'missing-dependency', dependency: 'missing/service' }));
    preferences.setExport('consumer/main', false);
    expect(status(reconcileEnablement(graph, preferences), 'consumer/main').reason?.code).toBe('export-off');
    preferences.setExport('consumer/main', true);
    expect(status(reconcileEnablement(graph, preferences), 'consumer/main').reason?.code).toBe('missing-dependency');
  });
});
