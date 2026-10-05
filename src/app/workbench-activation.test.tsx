// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { EnablementPersistence } from '../host/activation/enablement';
import type { DiscoveredPackage } from '../host/install/contribution-package';
import type { Dependency, ExportDescriptor, PackageManifest, RuntimeDocument } from '../sdui/schema/model';
import { ActivationInspector } from './activation-inspector';
import { WorkbenchSourceTree } from './source-tree';
import { WorkbenchActivationModel } from './workbench-activation';
import { defaultSelection, type WorkbenchPackage } from './workbench-selection';

afterEach(cleanup);

class MemoryPersistence implements EnablementPersistence {
  value: string | null = null;
  read(): string | null { return this.value; }
  write(value: string): void { this.value = value; }
}

const emptyObject = { type: 'object' as const, properties: {}, required: [] };
const widget: ExportDescriptor = {
  kind: 'widget', id: 'card', contract: {
    properties: emptyObject, defaults: {}, slots: {}, events: {}, themeHooks: [], example: { type: 'provider/card' },
  },
};
const runtime: ExportDescriptor = { kind: 'runtime', id: 'main', screens: ['home'] };

function discovered(id: string, descriptor: ExportDescriptor, dependencies: Dependency[] = []): DiscoveredPackage {
  const hasRuntime = descriptor.kind === 'runtime';
  const manifest: PackageManifest = {
    format: 'power-eagle/package', formatVersion: 1, id, name: id === 'provider' ? 'Provider' : 'Consumer',
    version: '1.0.0', description: `${id} fixture`, sdk: '^1.0.0',
    contributions: hasRuntime ? { runtime: 'run.json' } : { widgets: 'types.cjs' },
    exports: [descriptor], dependencies: [], assets: [],
  };
  const document: RuntimeDocument | undefined = hasRuntime ? {
    format: 'power-eagle/runtime', formatVersion: 1, start: 'home', state: {}, components: {}, actions: {}, dependencies,
    screens: { home: { params: emptyObject, state: {}, body: { type: 'Text', props: { text: id } } } },
  } : undefined;
  return {
    root: `fixture:${id}`, manifestPath: `fixture:${id}/manifest.json`, manifest,
    entries: { ...manifest.contributions }, assets: {}, ...(document ? { runtime: document } : {}),
  };
}

const dependency: Dependency = { package: 'provider', export: 'card', kind: 'widget', version: '^1.0.0' };
const provider = discovered('provider', widget);
const consumer = discovered('consumer', runtime, [dependency]);
const record = (item: DiscoveredPackage, status: WorkbenchPackage['status']): WorkbenchPackage => ({
  sourceId: 'built-in', sourceLabel: 'built-in', sourceKind: 'built-in', persistence: 'built-in', manifest: item.manifest, status,
});

describe('workbench activation graph integration', () => {
  it('persists package choices and derives dependency failure, recovery, and consumer counts', () => {
    const persistence = new MemoryPersistence();
    const activation = new WorkbenchActivationModel([consumer, provider], persistence);
    expect(activation.snapshot().exports.find(item => item.identity === 'provider/card')?.directConsumers).toEqual(['consumer']);

    const disabled = activation.setPackage('provider', false);
    expect(disabled.packages.get('provider')?.effectiveStatus).toBe('off');
    expect(disabled.exports.find(item => item.identity === 'consumer/main')).toMatchObject({
      effectiveStatus: 'failed', reason: { code: 'dependency-off', dependency: 'provider/card' },
    });

    const restored = new WorkbenchActivationModel([consumer, provider], persistence);
    expect(restored.snapshot().packages.get('provider')?.desired).toBe(false);
    expect(restored.setPackage('provider', true).packages.get('consumer')?.effectiveStatus).toBe('active');
  });

  it('shows raw failure and enables the required package as the recovery action', async () => {
    const activation = new WorkbenchActivationModel([consumer, provider], new MemoryPersistence());
    const registry = activation.setPackage('provider', false);
    const onTogglePackage = vi.fn();
    const user = userEvent.setup();
    render(<ActivationInspector
      record={record(consumer, 'failed')} selection={defaultSelection(record(consumer, 'failed'))} registry={registry}
      onTogglePackage={onTogglePackage} onToggleExport={vi.fn()}
    />);

    expect(screen.getByText('Required export provider/card is off')).toBeTruthy();
    expect(screen.getByText(/0 direct consumers/u)).toBeTruthy();
    await user.click(screen.getByRole('button', { name: 'Enable required package' }));
    expect(onTogglePackage).toHaveBeenCalledWith('provider', true);
  });

  it('keeps package and export toggles separate from source selection', async () => {
    const activation = new WorkbenchActivationModel([consumer, provider], new MemoryPersistence());
    const registry = activation.snapshot();
    const onSelect = vi.fn();
    const onTogglePackage = vi.fn();
    const onToggleExport = vi.fn();
    const user = userEvent.setup();
    render(<WorkbenchSourceTree
      packages={[record(provider, 'active')]} selection={defaultSelection(record(provider, 'active'))}
      registry={registry} onSelect={onSelect} onTogglePackage={onTogglePackage} onToggleExport={onToggleExport}
    />);

    await user.click(screen.getByRole('switch', { name: 'Disable package Provider' }));
    expect(onTogglePackage).toHaveBeenCalledWith('provider', false);
    expect(onSelect).not.toHaveBeenCalled();
    await user.click(screen.getByRole('switch', { name: 'Disable export provider/card' }));
    expect(onToggleExport).toHaveBeenCalledWith('provider/card', false);
    expect(onSelect).not.toHaveBeenCalled();
  });
});
