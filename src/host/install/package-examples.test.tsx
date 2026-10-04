// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { execFileSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { mkdtempSync, rmSync } from 'node:fs';
import { join, relative, resolve, sep } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import * as React from 'react';
import * as ReactDOM from 'react-dom';
import * as jsxRuntime from 'react/jsx-runtime';
import type { ExportDescriptor, RuntimeDocument } from '../../sdui/schema/model';
import { RuntimeSession, type RuntimeCatalog } from '../../sdui/runtime/session';
import { RuntimeView } from '../../sdui/runtime/view';
import type { StylingImplementation, WidgetImplementation } from '../../sdui/sdk/provider';
import { discoverContributionPackage, loadCompiledContributions, type DiscoveredPackage, type LoadedContribution } from './contribution-package';

const hostRequire = createRequire(import.meta.url);
const sharedModules = { react: React, 'react-dom': ReactDOM, 'react/jsx-runtime': jsxRuntime };
const eagleTarget = { platform: 'win32', arch: 'x64', node: '16.17.1' };
const roots: string[] = [];

afterEach(() => {
  cleanup();
  for (const root of roots.splice(0)) {
    const parent = resolve(tmpdir());
    const target = resolve(root);
    const rel = relative(parent, target);
    if (!rel.startsWith('power-eagle-examples-') || rel.includes(sep)) throw new Error('Unexpected cleanup directory');
    rmSync(target, { recursive: true, force: true });
  }
});

function widgetCatalog(discovered: DiscoveredPackage, loaded: LoadedContribution[]): RuntimeCatalog {
  const descriptor = discovered.manifest.exports.find(item => item.kind === 'widget') as Extract<ExportDescriptor, { kind: 'widget' }>;
  const implementation = loaded.find(item => item.kind === 'widget')!.exports[0].implementation as WidgetImplementation;
  const qualified = `${discovered.manifest.id}/${descriptor.id}`;
  return {
    widgets: { [qualified]: { contract: descriptor.contract, render: implementation.render } },
    exports: { [qualified]: { version: discovered.manifest.version, descriptor } },
  };
}

describe('documented contribution package examples', () => {
  it('builds and installs provider-only and mixed artifacts through the public contracts', async () => {
    const root = mkdtempSync(join(tmpdir(), 'power-eagle-examples-'));
    roots.push(root);
    const providerRoot = join(root, 'provider-only');
    const mixedRoot = join(root, 'mixed-package');
    execFileSync(process.execPath, [resolve('scripts/package-examples.mjs'), root], { cwd: resolve('.'), stdio: 'pipe' });

    const provider = discoverContributionPackage(providerRoot, hostRequire, { hostTarget: eagleTarget });
    const mixed = discoverContributionPackage(mixedRoot, hostRequire, { hostTarget: eagleTarget });
    const providerLoaded = loadCompiledContributions(provider, { hostRequire, sharedModules });
    const mixedLoaded = loadCompiledContributions(mixed, { hostRequire, sharedModules });
    expect(provider.runtime).toBeUndefined();
    expect(mixed.runtime?.start).toBe('home');
    expect(mixedLoaded.map(item => item.kind)).toEqual(['widget', 'styling']);

    const providerRequire = createRequire(provider.manifestPath);
    const mixedRequire = createRequire(mixed.manifestPath);
    const providerDependency = providerRequire('clsx');
    const mixedDependency = mixedRequire('clsx');
    expect(providerRequire.resolve('clsx').startsWith(providerRoot + sep)).toBe(true);
    expect(mixedRequire.resolve('clsx').startsWith(mixedRoot + sep)).toBe(true);
    expect(providerDependency).not.toBe(mixedDependency);

    const providerDescriptor = provider.manifest.exports.find(item => item.kind === 'widget') as Extract<ExportDescriptor, { kind: 'widget' }>;
    const providerDocument: RuntimeDocument = {
      format: 'power-eagle/runtime', formatVersion: 1, start: 'home', state: {}, components: {}, actions: {},
      dependencies: [{ package: provider.manifest.id, version: '^1.0.0', export: providerDescriptor.id, kind: 'widget' }],
      screens: { home: { params: { type: 'object', properties: {}, required: [] }, state: {}, body: providerDescriptor.contract.example } },
    };
    const providerSession = new RuntimeSession(providerDocument, widgetCatalog(provider, providerLoaded));
    const user = userEvent.setup();
    const providerView = render(<RuntimeView session={providerSession} />);
    expect(screen.getByRole('button').textContent).toContain('Provider example: off');
    expect(screen.getByRole('button').getAttribute('data-dependency-version')).toBe('2.1.1');
    expect(fileURLToPath(providerView.container.querySelector('img')!.src).startsWith(providerRoot + sep)).toBe(true);
    await user.click(screen.getByRole('button'));
    expect(screen.getByRole('button').textContent).toContain('Provider example: on');
    await providerSession.dispose();
    cleanup();

    const mixedSession = new RuntimeSession(mixed.runtime!, widgetCatalog(mixed, mixedLoaded));
    const mixedView = render(<RuntimeView session={mixedSession} />);
    expect(screen.getByRole('button').textContent).toContain('Mixed example: 0');
    expect(fileURLToPath(mixedView.container.querySelector('img')!.src).startsWith(mixedRoot + sep)).toBe(true);
    await user.click(screen.getByRole('button'));
    expect(screen.getByRole('button').textContent).toContain('Mixed example: 1');
    const styling = mixedLoaded.find(item => item.kind === 'styling')!.exports[0].implementation as StylingImplementation;
    expect(styling.tokens).toEqual({ accent: '#ffb000', panel: '#111315' });
    await mixedSession.dispose();
  });
});
