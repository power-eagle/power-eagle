import { describe, expect, it } from 'vitest';
import type { Dependency, ExportDescriptor, PackageManifest, RuntimeDocument } from '../../sdui/schema/model';
import type { DiscoveredPackage } from '../install/contribution-package';
import { buildExportRegistryGraph } from './dependency-graph';

const emptyObject = { type: 'object' as const, properties: {}, required: [] };

function widget(id: string): ExportDescriptor {
  return {
    kind: 'widget', id,
    contract: {
      properties: { type: 'object', properties: {}, required: [] }, defaults: {}, slots: {}, events: {}, themeHooks: [],
      example: { type: `fixture/${id}` },
    },
  };
}

function runtime(id = 'main'): ExportDescriptor { return { kind: 'runtime', id, screens: ['home'] }; }
function styling(id: string, target: string): ExportDescriptor {
  return { kind: 'styling', id, tokens: emptyObject, targets: [target] };
}

function contributionEntries(exports: ExportDescriptor[]): PackageManifest['contributions'] {
  const entries: PackageManifest['contributions'] = {};
  exports.forEach(item => {
    if (item.kind === 'runtime') entries.runtime = 'run.json';
    if (item.kind === 'widget') entries.widgets = 'types.cjs';
    if (item.kind === 'styling') entries.styling = 'styling.cjs';
    if (item.kind === 'action') entries.actions = 'actions.cjs';
    if (item.kind === 'service') entries.services = 'services.cjs';
  });
  return entries;
}

function discovered(
  id: string,
  exports: ExportDescriptor[],
  options: { version?: string; dependencies?: Dependency[]; runtimeDependencies?: Dependency[]; source?: string } = {},
): DiscoveredPackage {
  const root = `C:/registry/${options.source ?? id}`;
  const manifest: PackageManifest = {
    format: 'power-eagle/package', formatVersion: 1, id, name: id, version: options.version ?? '1.0.0', description: 'fixture', sdk: '^1.0.0',
    contributions: contributionEntries(exports), exports, dependencies: options.dependencies ?? [], assets: [],
  };
  const runtimeDocument: RuntimeDocument | undefined = exports.some(item => item.kind === 'runtime') ? {
    format: 'power-eagle/runtime', formatVersion: 1, start: 'home', state: {}, components: {}, actions: {},
    dependencies: options.runtimeDependencies ?? [],
    screens: { home: { params: emptyObject, state: {}, body: { type: 'Text', props: { text: id } } } },
  } : undefined;
  return {
    root, manifestPath: `${root}/manifest.json`, manifest, entries: {}, assets: {},
    ...(runtimeDocument ? { runtime: runtimeDocument } : {}),
  };
}

function dependency(packageId: string, exportId: string, kind: Dependency['kind'], version = '^1.0.0'): Dependency {
  return { package: packageId, export: exportId, kind, version };
}

describe('qualified export dependency graph', () => {
  it('orders mixed cross-package dependencies and counts distinct direct consumer packages', () => {
    const controls = discovered('ui.controls', [widget('button')]);
    const theme = discovered('theme.blueprint', [styling('dark', 'ui.controls/button')], {
      dependencies: [dependency('ui.controls', 'button', 'widget')],
    });
    const application = discovered('app.workspace', [runtime()], {
      runtimeDependencies: [dependency('ui.controls', 'button', 'widget'), dependency('theme.blueprint', 'dark', 'styling')],
    });

    const graph = buildExportRegistryGraph([application, theme, controls]);
    const reversed = buildExportRegistryGraph([controls, theme, application]);

    expect(graph.activationOrder).toEqual(['ui.controls/button', 'theme.blueprint/dark', 'app.workspace/main']);
    expect(reversed.activationOrder).toEqual(graph.activationOrder);
    expect([...graph.available.keys()]).toEqual(graph.activationOrder);
    expect(graph.available.get('ui.controls/button')?.directConsumers).toEqual(['app.workspace', 'theme.blueprint']);
    expect(graph.available.get('theme.blueprint/dark')?.directConsumers).toEqual(['app.workspace']);
    expect(graph.diagnostics).toEqual([]);
  });

  it('isolates missing, incompatible-version, and wrong-kind consumers', () => {
    const controls = discovered('ui.controls', [widget('button')]);
    const missing = discovered('consumer.missing', [runtime()], {
      runtimeDependencies: [dependency('absent.widgets', 'button', 'widget')],
    });
    const wrongKind = discovered('consumer.kind', [runtime()], {
      runtimeDependencies: [dependency('ui.controls', 'button', 'service')],
    });
    const wrongVersion = discovered('consumer.version', [runtime()], {
      runtimeDependencies: [dependency('ui.controls', 'button', 'widget', '^2.0.0')],
    });
    const independent = discovered('independent', [runtime()]);

    const graph = buildExportRegistryGraph([wrongVersion, missing, controls, independent, wrongKind]);
    const codes = Object.fromEntries(graph.exports.map(item => [item.identity, item.diagnostics.map(diagnostic => diagnostic.code)]));

    expect([...graph.available.keys()]).toEqual(['independent/main', 'ui.controls/button']);
    expect(codes['consumer.missing/main']).toContain('missing-dependency');
    expect(codes['consumer.kind/main']).toContain('dependency-kind');
    expect(codes['consumer.version/main']).toContain('dependency-version');
    expect(graph.available.get('ui.controls/button')?.directConsumers).toEqual(['consumer.kind', 'consumer.version']);
  });

  it('diagnoses collisions and cycles deterministically while preserving unrelated exports', () => {
    const duplicateOne = discovered('duplicate.package', [widget('shared')], { source: 'duplicate-one' });
    const duplicateTwo = discovered('duplicate.package', [widget('shared')], { source: 'duplicate-two' });
    const ambiguous = discovered('consumer.ambiguous', [runtime()], {
      runtimeDependencies: [dependency('duplicate.package', 'shared', 'widget')],
    });
    const cycleA = discovered('cycle.a', [runtime()], { dependencies: [dependency('cycle.b', 'main', 'runtime')] });
    const cycleB = discovered('cycle.b', [runtime()], { dependencies: [dependency('cycle.a', 'main', 'runtime')] });
    const downstream = discovered('cycle.consumer', [runtime()], {
      runtimeDependencies: [dependency('cycle.a', 'main', 'runtime')],
    });
    const independent = discovered('independent', [runtime()]);
    const packages = [duplicateTwo, cycleB, ambiguous, independent, downstream, duplicateOne, cycleA];

    const graph = buildExportRegistryGraph(packages);
    const reversed = buildExportRegistryGraph([...packages].reverse());
    const snapshot = (value: typeof graph) => value.exports.map(item => ({
      identity: item.identity, source: item.source, status: item.status,
      diagnostics: item.diagnostics.map(diagnostic => diagnostic.code), consumers: item.directConsumers,
    }));

    expect(graph.activationOrder).toEqual(['independent/main']);
    expect(snapshot(reversed)).toEqual(snapshot(graph));
    expect(graph.exports.filter(item => item.identity === 'duplicate.package/shared')).toHaveLength(2);
    expect(graph.exports.filter(item => item.identity === 'duplicate.package/shared').every(item => item.diagnostics.some(diagnostic => diagnostic.code === 'duplicate-export'))).toBe(true);
    expect(graph.exports.find(item => item.identity === 'consumer.ambiguous/main')?.diagnostics.map(item => item.code)).toContain('dependency-collision');
    expect(graph.exports.find(item => item.identity === 'cycle.a/main')?.diagnostics.map(item => item.code)).toContain('dependency-cycle');
    expect(graph.exports.find(item => item.identity === 'cycle.b/main')?.diagnostics.map(item => item.code)).toContain('dependency-cycle');
    expect(graph.exports.find(item => item.identity === 'cycle.consumer/main')?.diagnostics.map(item => item.code)).toContain('dependency-unavailable');
    expect(graph.exports.find(item => item.identity === 'cycle.a/main')?.directConsumers).toEqual(['cycle.b', 'cycle.consumer']);
  });
});
