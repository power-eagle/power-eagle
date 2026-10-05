// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { PackageManifest } from '../sdui/schema/model';
import { WorkbenchSourceTree } from './source-tree';
import { acquiredWorkbenchPackage, defaultSelection, groupWorkbenchPackages, packageContributions, type WorkbenchPackage } from './workbench-selection';

afterEach(cleanup);

function manifest(id: string, contributions: PackageManifest['contributions']): PackageManifest {
  const exports: PackageManifest['exports'] = [];
  if (contributions.runtime) exports.push({ kind: 'runtime', id: 'main', screens: ['home', 'details'] });
  if (contributions.widgets) exports.push({
    kind: 'widget', id: 'card', contract: {
      properties: { type: 'object', properties: {}, required: [] }, defaults: {}, slots: {}, events: {}, themeHooks: [],
      example: { type: `${id}/card` },
    },
  });
  if (contributions.styling) exports.push({
    kind: 'styling', id: 'theme', tokens: { type: 'object', properties: {}, required: [] }, targets: [`${id}/card`],
  });
  return {
    format: 'power-eagle/package', formatVersion: 1, id, name: id, version: '1.0.0', description: id, sdk: '^1.0.0',
    contributions, exports, dependencies: [], assets: [],
  };
}

function record(id: string, sourceKind: WorkbenchPackage['sourceKind'], status: WorkbenchPackage['status'], contributions: PackageManifest['contributions']): WorkbenchPackage {
  return {
    sourceId: sourceKind === 'installed' ? 'git:alpha' : sourceKind,
    sourceLabel: sourceKind === 'installed' ? 'github.com/example/packages' : sourceKind,
    sourceKind, persistence: sourceKind === 'session' ? 'session' : sourceKind === 'generated' ? 'generated' : sourceKind === 'built-in' ? 'built-in' : 'persistent',
    manifest: manifest(id, contributions), status,
  };
}

describe('shared workbench selection and sources', () => {
  it('groups built-in, canonical installed, generated, and session packages deterministically', () => {
    const groups = groupWorkbenchPackages([
      record('session.preview', 'session', 'active', { runtime: 'run.json' }),
      record('generated.report', 'generated', 'active', { runtime: 'run.json' }),
      record('installed.mixed', 'installed', 'active', { runtime: 'run.json', widgets: 'types.cjs', styling: 'styling.cjs' }),
      record('builtin.clipboard', 'built-in', 'active', { services: 'services.cjs' }),
    ]);
    expect(groups.map(group => group.kind)).toEqual(['built-in', 'installed', 'generated', 'session']);
    expect(packageContributions(groups[1].packages[0].manifest)).toEqual(['runtime', 'widgets', 'styling']);
    expect(defaultSelection(groups[1].packages[0])).toEqual({ packageId: 'installed.mixed', contribution: 'runtime', exportId: 'main', screen: 'home' });
  });

  it('inspects an off provider and mixed contributions without changing enablement', async () => {
    const off = record('provider.off', 'installed', 'off', { widgets: 'types.cjs' });
    const mixed = record('provider.mixed', 'generated', 'active', { runtime: 'run.json', widgets: 'types.cjs', styling: 'styling.cjs' });
    mixed.fresh = true;
    const onSelect = vi.fn();
    const user = userEvent.setup();
    render(<WorkbenchSourceTree packages={[off, mixed]} selection={defaultSelection(mixed)} onSelect={onSelect} />);

    expect(screen.getByText('new')).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Select widgets contribution from provider.off' })).toBeNull();
    await user.click(screen.getByRole('button', { name: 'Select package provider.off' }));
    expect(onSelect).toHaveBeenCalledWith({ packageId: 'provider.off', contribution: 'widgets', exportId: 'card' });
    await user.click(screen.getByRole('button', { name: 'Select styling contribution from provider.mixed' }));
    expect(onSelect).toHaveBeenLastCalledWith({ packageId: 'provider.mixed', contribution: 'styling', exportId: 'theme' });
  });

  it('selects runtime screens and provider exports through the same inert value', async () => {
    const mixed = record('provider.mixed', 'installed', 'active', { runtime: 'run.json', widgets: 'types.cjs' });
    const onSelect = vi.fn();
    const user = userEvent.setup();
    const { rerender } = render(<WorkbenchSourceTree packages={[mixed]} selection={defaultSelection(mixed)} onSelect={onSelect} />);

    await user.click(screen.getByRole('button', { name: 'Select screen details from provider.mixed' }));
    expect(onSelect).toHaveBeenLastCalledWith({ packageId: 'provider.mixed', contribution: 'runtime', exportId: 'main', screen: 'details' });

    const widgetSelection = { packageId: 'provider.mixed', contribution: 'widgets' as const, exportId: 'card' };
    rerender(<WorkbenchSourceTree packages={[mixed]} selection={widgetSelection} onSelect={onSelect} />);
    await user.click(screen.getByRole('button', { name: 'Inspect widget card from provider.mixed' }));
    expect(onSelect).toHaveBeenLastCalledWith(widgetSelection);
  });

  it('preserves actual acquisition source identity and unscoped session lifetime', () => {
    const acquired = {
      acquired: {
        artifact: { id: 'artifact-1', source_id: 'git:github.com/example/power-package' },
        directory: 'C:/store/artifact-1', fallback: false, update_checked: true, content_verified: true,
      },
      discovered: { root: 'C:/store/artifact-1', manifest: manifest('acquired.package', { widgets: 'types.cjs' }), entries: [] },
    };
    expect(acquiredWorkbenchPackage({ ...acquired, persistence: 'persistent' } as never)).toMatchObject({
      sourceId: 'git:github.com/example/power-package', sourceKind: 'installed', persistence: 'persistent',
    });
    expect(acquiredWorkbenchPackage({ ...acquired, persistence: 'session' } as never)).toMatchObject({
      sourceId: 'session', sourceLabel: 'session only', sourceKind: 'session', persistence: 'session',
    });
  });

  it('keeps generated conversation versions distinct across screen selection', async () => {
    const older = record('generated.dashboard', 'generated', 'active', { runtime: 'run.json' });
    older.conversationId = 'conversation-7';
    older.version = 1;
    const current = { ...older, version: 2, fresh: true };
    const onSelect = vi.fn();
    const user = userEvent.setup();
    render(<WorkbenchSourceTree packages={[current, older]} selection={defaultSelection(older)} onSelect={onSelect} />);

    expect(screen.getAllByRole('button', { name: 'Select package generated.dashboard' })).toHaveLength(2);
    await user.click(screen.getByRole('button', { name: 'Select screen details from generated.dashboard' }));
    expect(onSelect).toHaveBeenLastCalledWith({
      packageId: 'generated.dashboard', conversationId: 'conversation-7', version: 1,
      contribution: 'runtime', exportId: 'main', screen: 'details',
    });
  });
});
