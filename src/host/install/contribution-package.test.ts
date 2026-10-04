import { afterEach, describe, expect, it } from 'vitest';
import { existsSync, mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { join, relative, resolve, sep } from 'node:path';
import { tmpdir } from 'node:os';
import * as React from 'react';
import * as ReactDOM from 'react-dom';
import * as jsxRuntime from 'react/jsx-runtime';
import { Text } from '../../sdui/authoring/foundation';
import type { ExportDescriptor, PackageManifest, RuntimeDocument } from '../../sdui/schema/model';
import { ContributionPackageError, discoverContributionPackage, loadCompiledContributions } from './contribution-package';

const hostRequire = createRequire(import.meta.url);
const sharedModules = { react: React, 'react-dom': ReactDOM, 'react/jsx-runtime': jsxRuntime };
const roots: string[] = [];
afterEach(() => {
  for (const root of roots.splice(0)) {
    const parent = resolve(tmpdir());
    const target = resolve(root);
    const rel = relative(parent, target);
    if (!rel.startsWith('power-eagle-package-') || rel.includes(sep)) throw new Error('Unexpected cleanup directory');
    rmSync(target, { recursive: true, force: true });
  }
});

function widgetDescriptor(id = 'switch'): ExportDescriptor {
  return { kind: 'widget', id, contract: { ...Text.contract, example: { type: `example.provider/${id}`, props: { text: 'hello' } } } };
}

function runtimeDocument(): RuntimeDocument {
  return {
    format: 'power-eagle/runtime', formatVersion: 1, start: 'home', state: {}, components: {}, actions: {}, dependencies: [],
    screens: { home: { params: { type: 'object', properties: {}, required: [] }, state: {}, body: { type: 'example.provider/switch' } } },
  };
}

function createPackage(options: { mixed?: boolean; provider?: string; entry?: string; assets?: string[] } = {}) {
  const root = mkdtempSync(join(tmpdir(), 'power-eagle-package-'));
  roots.push(root);
  const descriptor = widgetDescriptor();
  const manifest: PackageManifest = {
    format: 'power-eagle/package', formatVersion: 1, id: 'example.provider', name: 'Example provider', version: '1.0.0',
    description: 'fixture', sdk: '^1.0.0', contributions: { widgets: options.entry ?? 'types.cjs' },
    exports: [descriptor], dependencies: [], assets: options.assets ?? [],
  };
  if (options.mixed) {
    manifest.contributions.runtime = 'run.json';
    manifest.exports.unshift({ kind: 'runtime', id: 'main', screens: ['home'] });
    writeFileSync(join(root, 'run.json'), JSON.stringify(runtimeDocument()));
  }
  writeFileSync(join(root, 'manifest.json'), JSON.stringify(manifest));
  if ((options.entry ?? 'types.cjs').includes('/')) mkdirSync(join(root, (options.entry ?? 'types.cjs').split('/').slice(0, -1).join('/')), { recursive: true });
  writeFileSync(join(root, options.entry ?? 'types.cjs'), options.provider ?? `module.exports = sdk => ({
    format: 'power-eagle/provider', formatVersion: 1, kind: 'widget',
    exports: [{ descriptor: ${JSON.stringify(descriptor)}, implementation: { packageId: sdk.packageId } }]
  });`);
  for (const asset of options.assets ?? []) {
    mkdirSync(join(root, asset.split('/').slice(0, -1).join('/')), { recursive: true });
    writeFileSync(join(root, asset), 'asset');
  }
  return { root, manifest, descriptor };
}

function diagnostics(error: unknown) {
  expect(error).toBeInstanceOf(ContributionPackageError);
  return (error as ContributionPackageError).diagnostics;
}

describe('manifest-first contribution packages', () => {
  it('discovers provider-only and mixed packages without evaluating provider code', () => {
    const markerName = 'provider-executed';
    const provider = `require('fs').writeFileSync(require('path').join(__dirname, '${markerName}'), 'yes'); module.exports = () => ({ format: 'power-eagle/provider', formatVersion: 1, kind: 'widget', exports: [] });`;
    const providerOnly = createPackage({ provider, entry: 'compiled/types.cjs' });
    const mixed = createPackage({ mixed: true });

    const first = discoverContributionPackage(providerOnly.root, hostRequire);
    const second = discoverContributionPackage(mixed.root, hostRequire);

    expect(first.runtime).toBeUndefined();
    expect(second.runtime?.start).toBe('home');
    expect(first.entries.widgets).toContain(join('compiled', 'types.cjs'));
    expect(existsSync(join(providerOnly.root, 'compiled', markerName))).toBe(false);
  });

  it('loads a declared CommonJS factory with package-relative assets', () => {
    const fixture = createPackage({ assets: ['assets/marker.txt'] });
    const discovered = discoverContributionPackage(fixture.root, hostRequire);
    const loaded = loadCompiledContributions(discovered, { hostRequire, sharedModules });

    expect(loaded).toHaveLength(1);
    expect(loaded[0].exports[0].descriptor).toEqual(fixture.descriptor);
    expect(loaded[0].exports[0].implementation).toEqual({ packageId: 'example.provider' });
  });

  it('rejects missing declared entries before provider execution', () => {
    const fixture = createPackage();
    rmSync(join(fixture.root, 'types.cjs'));

    try {
      discoverContributionPackage(fixture.root, hostRequire);
      throw new Error('Expected discovery to fail');
    } catch (error) {
      expect(diagnostics(error)).toEqual(expect.arrayContaining([expect.objectContaining({ path: '/contributions/widgets', code: 'missing-file' })]));
    }
  });

  it('rejects descriptor mismatches and reports missing private dependencies', () => {
    const mismatch = createPackage({ provider: `module.exports = () => ({ format: 'power-eagle/provider', formatVersion: 1, kind: 'widget', exports: [{ descriptor: ${JSON.stringify(widgetDescriptor('other'))}, implementation: {} }] });` });
    expect(() => loadCompiledContributions(discoverContributionPackage(mismatch.root, hostRequire), { hostRequire, sharedModules }))
      .toThrow(/Undeclared provider export other|omitted manifest export switch/);

    const missing = createPackage({ provider: `module.exports = () => require('dependency-that-is-not-installed');` });
    try {
      loadCompiledContributions(discoverContributionPackage(missing.root, hostRequire), { hostRequire, sharedModules });
      throw new Error('Expected provider load to fail');
    } catch (error) {
      expect(diagnostics(error)[0]).toEqual(expect.objectContaining({ path: '/contributions/widgets', code: 'missing-dependency' }));
    }
  });
});
