import { afterEach, describe, expect, it } from 'vitest';
import { cpSync, existsSync, lstatSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, realpathSync, rmSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { join, relative, resolve, sep } from 'node:path';
import { tmpdir } from 'node:os';
import * as React from 'react';
import * as ReactDOM from 'react-dom';
import * as jsxRuntime from 'react/jsx-runtime';
import type { PackageManifest, RuntimeDocument } from '../schema/model';
import { discoverContributionPackage, loadCompiledContributions } from '../../host/install/contribution-package';
import { buildContributionArtifact } from './provider-package';

const hostRequire = createRequire(import.meta.url);
const sharedModules = { react: React, 'react-dom': ReactDOM, 'react/jsx-runtime': jsxRuntime };
const eagleTarget = { platform: 'win32', arch: 'x64', node: '16.17.1' };
const roots: string[] = [];

afterEach(() => {
  for (const root of roots.splice(0)) {
    const target = resolve(root);
    const artifactRoot = resolve('.artifacts');
    const temporaryRoot = realpathSync(tmpdir());
    if (!inside(artifactRoot, target) && !inside(temporaryRoot, target)) throw new Error('Unexpected cleanup directory');
    rmSync(target, { recursive: true, force: true });
  }
});

function inside(root: string, target: string) {
  const rel = relative(root, target);
  return rel === '' || (rel !== '..' && !rel.startsWith(`..${sep}`) && !rel.startsWith('/'));
}

function symbolicLinks(root: string): string[] {
  return readdirSync(root).flatMap(name => {
    const path = join(root, name);
    const status = lstatSync(path);
    if (status.isSymbolicLink()) return [path];
    return status.isDirectory() ? symbolicLinks(path) : [];
  });
}

function fixture() {
  mkdirSync(resolve('.artifacts'), { recursive: true });
  const source = mkdtempSync(resolve('.artifacts/provider-source-'));
  const outputRoot = mkdtempSync(resolve('.artifacts/provider-output-'));
  const output = join(outputRoot, 'artifact');
  roots.push(source, outputRoot);
  mkdirSync(join(source, 'src'), { recursive: true });
  mkdirSync(join(source, 'assets'), { recursive: true });
  mkdirSync(join(source, 'node_modules/esm-only'), { recursive: true });
  writeFileSync(join(source, 'node_modules/esm-only/package.json'), JSON.stringify({ name: 'esm-only', version: '1.0.0', type: 'module', exports: './index.js' }));
  writeFileSync(join(source, 'node_modules/esm-only/index.js'), `export const esmLabel = 'bundled-esm';`);
  const descriptor = {
    kind: 'widget' as const, id: 'badge', contract: {
      properties: { type: 'object' as const, properties: { text: { type: 'string' as const } }, required: ['text'] },
      defaults: {}, slots: {}, events: {}, themeHooks: [], example: { type: 'build.example/badge', props: { text: 'Hello' } },
    },
  };
  const runtime: RuntimeDocument = {
    format: 'power-eagle/runtime', formatVersion: 1, start: 'home', state: {}, components: {}, actions: {}, dependencies: [],
    screens: { home: { params: { type: 'object', properties: {}, required: [] }, state: {}, body: descriptor.contract.example } },
  };
  const manifest: PackageManifest = {
    format: 'power-eagle/package', formatVersion: 1, id: 'build.example', name: 'Build example', version: '1.0.0', description: 'builder fixture', sdk: '^1.0.0',
    contributions: { runtime: 'run.json', widgets: 'types.cjs' }, exports: [{ kind: 'runtime', id: 'main', screens: ['home'] }, descriptor],
    dependencies: [], assets: ['assets/marker.txt'], target: { platform: ['win32'], arch: ['x64'], node: '^16.17.0' },
  };
  writeFileSync(join(source, 'manifest.json'), JSON.stringify(manifest));
  writeFileSync(join(source, 'run.json'), JSON.stringify(runtime));
  writeFileSync(join(source, 'assets/marker.txt'), 'asset');
  writeFileSync(join(source, 'package.json'), JSON.stringify({ name: 'build-example', private: true, dependencies: { clsx: '^2.1.1', 'esm-only': '1.0.0' } }));
  writeFileSync(join(source, 'src/types.ts'), `import clsx from 'clsx'; import { esmLabel } from 'esm-only';
    import { defineWidgetProvider } from '@power-eagle/sdk';
    export default defineWidgetProvider(sdk => [{
      descriptor: ${JSON.stringify(descriptor)}, implementation: {
        dependencyVersion: sdk.require('./node_modules/clsx/package.json').version,
        dependencyPath: sdk.require.resolve('clsx'), label: clsx(esmLabel, 'ready'), marker: sdk.assetUrl('assets/marker.txt'), render: () => null
      }
    }]);`);
  const config = join(source, 'power-eagle.build.json');
  writeFileSync(config, JSON.stringify({
    format: 'power-eagle/build', formatVersion: 1, manifest: 'manifest.json', providers: { widgets: 'src/types.ts' }, externalDependencies: ['clsx'],
  }));
  return { source, output, config };
}

describe('self-contained contribution package builder', () => {
  it('bundles ESM code, copies production dependencies/assets, and loads after relocation', async () => {
    const item = fixture();
    mkdirSync(item.output);
    writeFileSync(join(item.output, 'obsolete.txt'), 'old build');
    const result = await buildContributionArtifact(item.config, item.output);
    expect(result.providers).toEqual(['types.cjs']);
    expect(result.dependencies).toEqual({ clsx: '2.1.1' });
    expect(existsSync(join(item.output, 'run.json'))).toBe(true);
    expect(readFileSync(join(item.output, 'assets/marker.txt'), 'utf8')).toBe('asset');
    expect(existsSync(join(item.output, 'node_modules/esm-only'))).toBe(false);
    expect(lstatSync(join(item.output, 'node_modules/clsx')).isSymbolicLink()).toBe(false);
    expect(symbolicLinks(item.output)).toEqual([]);
    expect(existsSync(join(item.output, 'src'))).toBe(false);
    expect(existsSync(join(item.output, 'power-eagle.build.json'))).toBe(false);
    expect(existsSync(join(item.output, 'obsolete.txt'))).toBe(false);
    expect(JSON.parse(readFileSync(join(item.output, 'package.json'), 'utf8'))).toMatchObject({
      type: 'commonjs', dependencies: { clsx: '2.1.1' },
      powerEagle: { sdk: '^1.0.0', target: { platform: ['win32'], arch: ['x64'], node: '^16.17.0' } },
    });

    const relocated = mkdtempSync(join(tmpdir(), 'power-eagle-built-'));
    roots.push(relocated);
    rmSync(item.source, { recursive: true, force: true });
    cpSync(item.output, relocated, { recursive: true, dereference: true });
    const discovered = discoverContributionPackage(relocated, hostRequire, { hostTarget: eagleTarget });
    const loaded = loadCompiledContributions(discovered, { hostRequire, sharedModules });
    const implementation = loaded[0].exports[0].implementation as { dependencyVersion: string; dependencyPath: string; label: string; marker: string };
    expect(implementation.dependencyVersion).toBe('2.1.1');
    expect(implementation.dependencyPath.startsWith(relocated + sep)).toBe(true);
    expect(implementation.label).toContain('bundled-esm');
    expect(implementation.marker).toMatch(/^file:/);
  });

  it('leaves the previous artifact intact when a build fails', async () => {
    const item = fixture();
    await buildContributionArtifact(item.config, item.output);
    const previous = readFileSync(join(item.output, 'types.cjs'), 'utf8');
    writeFileSync(join(item.source, 'src/types.ts'), 'export default (');

    await expect(buildContributionArtifact(item.config, item.output)).rejects.toThrow();
    expect(readFileSync(join(item.output, 'types.cjs'), 'utf8')).toBe(previous);
    expect(discoverContributionPackage(item.output, hostRequire, { hostTarget: eagleTarget }).manifest.id).toBe('build.example');
  });
});
