import { describe, expect, it } from 'vitest';
import type { Dependency, ExportDescriptor, PackageManifest, RuntimeDocument } from '../../sdui/schema/model';
import type { StylingImplementation } from '../../sdui/sdk/provider';
import type { DiscoveredPackage } from '../install/contribution-package';
import type { ActivationRegistration, ActivationSnapshot } from './controller';
import { buildExportRegistryGraph } from './dependency-graph';
import { EnablementPreferences, reconcileEnablement, type EnablementPersistence } from './enablement';
import { collectActiveStyling, composeStyle, StyleCompositionError, type ActiveStyling } from './styling';

class MemoryPersistence implements EnablementPersistence {
  value: string | null = null;
  read(): string | null { return this.value; }
  write(value: string): void { this.value = value; }
}

const emptyObject = { type: 'object' as const, properties: {}, required: [] };
function style(identity: string, implementation: StylingImplementation, targets = ['ui/button']): ActiveStyling {
  return { identity, implementation, targets };
}
function stylingImplementation(
  tokens: StylingImplementation['tokens'],
  overrides: StylingImplementation['overrides'],
  variants: StylingImplementation['variants'] = {},
): StylingImplementation {
  return { tokens, overrides, variants };
}

function widgetDescriptor(): ExportDescriptor {
  return {
    kind: 'widget', id: 'button',
    contract: { properties: emptyObject, defaults: {}, slots: {}, events: {}, themeHooks: ['surface'], example: { type: 'ui/button' } },
  };
}
function stylingDescriptor(): Extract<ExportDescriptor, { kind: 'styling' }> {
  return { kind: 'styling', id: 'theme', tokens: emptyObject, targets: ['ui/button'] };
}
function discovered(id: string, descriptor: ExportDescriptor, runtimeDependencies: Dependency[] = []): DiscoveredPackage {
  const root = `C:/styling/${id}`;
  const isRuntime = descriptor.kind === 'runtime';
  const manifest: PackageManifest = {
    format: 'power-eagle/package', formatVersion: 1, id, name: id, version: '1.0.0', description: 'fixture', sdk: '^1.0.0',
    contributions: isRuntime ? { runtime: 'run.json' } : descriptor.kind === 'widget' ? { widgets: 'types.cjs' } : { styling: 'styling.cjs' },
    exports: [descriptor], dependencies: [], assets: [],
  };
  const runtime: RuntimeDocument | undefined = isRuntime ? {
    format: 'power-eagle/runtime', formatVersion: 1, start: 'home', state: {}, components: {}, actions: {}, dependencies: runtimeDependencies,
    screens: { home: { params: emptyObject, state: {}, body: { type: 'ui/button' } } },
  } : undefined;
  return { root, manifestPath: `${root}/manifest.json`, manifest, entries: {}, assets: {}, ...(runtime ? { runtime } : {}) };
}

function snapshot(registrations: ActivationRegistration[]): ActivationSnapshot {
  const all = new Map(registrations.map(registration => [registration.identity, registration]));
  const kind = (value: ExportDescriptor['kind']) => new Map([...all].filter(([, registration]) => registration.kind === value));
  return { all, runtime: kind('runtime'), widget: kind('widget'), styling: kind('styling'), action: kind('action'), service: kind('service') };
}

describe('deterministic styling composition', () => {
  it('applies host, explicitly ordered package, view, and node layers in precedence order', () => {
    const packageA = style('theme/a', stylingImplementation(
      { accent: 'a', density: 'a' }, { 'ui/button': { color: 'a', padding: 2 } }, { dense: { padding: 4 } },
    ));
    const packageB = style('theme/b', stylingImplementation(
      { accent: 'b' }, { 'ui/button': { color: 'b', border: 'b' } }, { rounded: { radius: 8 } },
    ));
    const view = style('theme/view', stylingImplementation(
      { accent: 'view' }, { 'ui/button': { color: 'view', outline: 'view' } },
    ));
    const selections = {
      widget: 'ui/button', host: { tokens: { accent: 'host', base: 'host' }, style: { color: 'host', padding: 1 } },
      packageThemes: [
        { identity: 'theme/a', order: 20, variants: ['dense'] },
        { identity: 'theme/b', order: 10, variants: ['rounded'] },
      ],
      viewThemes: [{ identity: 'theme/view', order: 10 }], nodeStyle: { color: 'node' },
    } as const;

    const result = composeStyle(new Map([['theme/a', packageA], ['theme/view', view], ['theme/b', packageB]]), selections);
    const reversed = composeStyle(new Map([['theme/b', packageB], ['theme/view', view], ['theme/a', packageA]]), selections);

    expect(result).toEqual(reversed);
    expect(result.applied).toEqual(['theme/b', 'theme/a', 'theme/view']);
    expect(result.tokens).toEqual({ accent: 'view', base: 'host', density: 'a' });
    expect(result.style).toEqual({ color: 'node', padding: 4, border: 'b', radius: 8, outline: 'view' });
    expect(() => composeStyle(new Map([['theme/a', packageA], ['theme/b', packageB]]), {
      ...selections, packageThemes: [{ identity: 'theme/a', order: 1 }, { identity: 'theme/b', order: 1 }],
    })).toThrow(StyleCompositionError);
  });

  it('removes unavailable optional styles and rejects unavailable required styles or variants', () => {
    const active = style('theme/active', stylingImplementation({}, { 'ui/button': { color: 'active' } }));
    const catalog = new Map([['theme/active', active]]);
    const optional = composeStyle(catalog, {
      widget: 'ui/button', host: { tokens: {}, style: { color: 'host' } },
      packageThemes: [{ identity: 'theme/missing', order: 1 }], nodeStyle: { padding: 3 },
    });
    expect(optional).toEqual({ tokens: {}, style: { color: 'host', padding: 3 }, applied: [] });
    expect(() => composeStyle(catalog, {
      widget: 'ui/button', host: { tokens: {}, style: {} }, packageThemes: [{ identity: 'theme/missing', order: 1, required: true }],
    })).toThrow(/Required package style theme\/missing is unavailable/);
    expect(() => composeStyle(catalog, {
      widget: 'ui/button', host: { tokens: {}, style: {} }, packageThemes: [{ identity: 'theme/active', order: 1, variants: ['absent'] }],
    })).toThrow(/has no variant absent/);
  });

  it('uses styling registrations without replacing widgets and follows required dependency status', () => {
    const widgets = discovered('ui', widgetDescriptor());
    const themes = discovered('theme', stylingDescriptor());
    const runtimeDescriptor: ExportDescriptor = { kind: 'runtime', id: 'main', screens: ['home'] };
    const application = discovered('app', runtimeDescriptor, [{ package: 'theme', export: 'theme', kind: 'styling', version: '^1.0.0' }]);
    const graph = buildExportRegistryGraph([application, themes, widgets]);
    const persistence = new MemoryPersistence();
    const preferences = EnablementPreferences.open(persistence);
    let registry = reconcileEnablement(graph, preferences);
    const widgetValue = { render: () => null };
    const styleValue = stylingImplementation({ accent: 'gold' }, { 'ui/button': { color: 'gold' } });
    const registrations: ActivationRegistration[] = [
      { identity: 'ui/button', packageId: 'ui', group: 'ui:widgets', kind: 'widget', value: widgetValue },
      { identity: 'theme/theme', packageId: 'theme', group: 'theme:styling', kind: 'styling', value: styleValue },
    ];
    const activeSnapshot = snapshot(registrations);
    const catalog = collectActiveStyling(registry, activeSnapshot);

    expect(composeStyle(catalog, {
      widget: 'ui/button', host: { tokens: {}, style: {} }, packageThemes: [{ identity: 'theme/theme', order: 1, required: true }],
    }).style).toEqual({ color: 'gold' });
    expect(activeSnapshot.widget.get('ui/button')?.value).toBe(widgetValue);

    preferences.setExport('theme/theme', false);
    registry = reconcileEnablement(graph, preferences);
    expect(registry.exports.find(item => item.identity === 'app/main')?.reason).toEqual(expect.objectContaining({ code: 'dependency-off', dependency: 'theme/theme' }));
    expect(() => composeStyle(collectActiveStyling(registry, snapshot([registrations[0]])), {
      widget: 'ui/button', host: { tokens: {}, style: {} }, packageThemes: [{ identity: 'theme/theme', order: 1, required: true }],
    })).toThrow(/Required package style theme\/theme is unavailable/);

    const invalid = stylingImplementation({}, { 'other/widget': { color: 'bad' } });
    expect(() => collectActiveStyling(reconcileEnablement(graph, EnablementPreferences.open(new MemoryPersistence())), snapshot([
      registrations[0], { ...registrations[1], value: invalid },
    ]))).toThrow(/undeclared targets/);
  });
});
