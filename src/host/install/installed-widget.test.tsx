// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { cpSync, mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { join, relative, resolve, sep } from 'node:path';
import { tmpdir } from 'node:os';
import * as React from 'react';
import * as ReactDOM from 'react-dom';
import * as jsxRuntime from 'react/jsx-runtime';
import type { ExportDescriptor, PackageManifest, RuntimeDocument } from '../../sdui/schema/model';
import type { WidgetImplementation } from '../../sdui/sdk/provider';
import { RuntimeSession, type RuntimeCatalog } from '../../sdui/runtime/session';
import { RuntimeView } from '../../sdui/runtime/view';
import { discoverContributionPackage, loadCompiledContributions } from './contribution-package';

const hostRequire = createRequire(import.meta.url);
const sharedModules = { react: React, 'react-dom': ReactDOM, 'react/jsx-runtime': jsxRuntime };
const roots: string[] = [];

afterEach(() => {
  cleanup();
  for (const root of roots.splice(0)) {
    const parent = resolve(tmpdir());
    const target = resolve(root);
    const rel = relative(parent, target);
    if (!rel.startsWith('power-eagle-installed-') || rel.includes(sep)) throw new Error('Unexpected cleanup directory');
    rmSync(target, { recursive: true, force: true });
  }
});

function descriptor(packageId: string): Extract<ExportDescriptor, { kind: 'widget' }> {
  return {
    kind: 'widget', id: 'switch',
    contract: {
      properties: { type: 'object', properties: { label: { type: 'string' } }, required: ['label'] },
      defaults: {}, slots: {}, events: {}, themeHooks: ['control'],
      example: { type: `${packageId}/switch`, props: { label: 'Toggle' } },
    },
  };
}

function installedPackage(packageId: string, dependencyAlias: string, version: string) {
  const root = mkdtempSync(join(tmpdir(), 'power-eagle-installed-'));
  roots.push(root);
  mkdirSync(join(root, 'node_modules'), { recursive: true });
  cpSync(resolve('node_modules', dependencyAlias), join(root, 'node_modules', 'clsx'), { recursive: true, dereference: true });
  const widget = descriptor(packageId);
  const manifest: PackageManifest = {
    format: 'power-eagle/package', formatVersion: 1, id: packageId, name: packageId, version: '1.0.0', description: 'runtime install fixture', sdk: '^1.0.0',
    contributions: { widgets: 'types.cjs' }, exports: [widget], dependencies: [], assets: [],
  };
  writeFileSync(join(root, 'manifest.json'), JSON.stringify(manifest));
  writeFileSync(join(root, 'package.json'), JSON.stringify({ private: true, dependencies: { clsx: version } }));
  writeFileSync(join(root, 'types.cjs'), `module.exports = sdk => {
    const React = sdk.sharedModules.react;
    const clsx = sdk.require('clsx');
    const dependency = sdk.require('./node_modules/clsx/package.json');
    return {
      format: 'power-eagle/provider', formatVersion: 1, kind: 'widget',
      exports: [{
        descriptor: ${JSON.stringify(widget)},
        implementation: {
          dependencyVersion: dependency.version,
          dependencyPath: sdk.require.resolve('clsx'),
          render: ({ props }) => {
            const [active, setActive] = React.useState(false);
            return React.createElement('button', {
              type: 'button', className: clsx('installed-switch', active && 'active'), onClick: () => setActive(value => !value)
            }, props.label + ': ' + (active ? 'on' : 'off') + ' · clsx ' + dependency.version);
          }
        }
      }]
    };
  };`);
  return { root, widget };
}

describe('installed widget runtime integration', () => {
  it('renders a hook-using provider through a runtime document with isolated private dependencies', async () => {
    const alpha = installedPackage('installed.alpha', 'probe-clsx-v1', '1.2.1');
    const beta = installedPackage('installed.beta', 'probe-clsx-v2', '2.1.1');
    const alphaLoaded = loadCompiledContributions(discoverContributionPackage(alpha.root, hostRequire), { hostRequire, sharedModules });
    const betaLoaded = loadCompiledContributions(discoverContributionPackage(beta.root, hostRequire), { hostRequire, sharedModules });
    const implementation = alphaLoaded[0].exports[0].implementation as WidgetImplementation & { dependencyVersion: string; dependencyPath: string };
    const betaImplementation = betaLoaded[0].exports[0].implementation as WidgetImplementation & { dependencyVersion: string; dependencyPath: string };
    const qualified = 'installed.alpha/switch';
    const catalog: RuntimeCatalog = {
      widgets: { [qualified]: { contract: alpha.widget.contract, render: implementation.render } },
      exports: { [qualified]: { version: '1.0.0', descriptor: alpha.widget } },
    };
    const document: RuntimeDocument = {
      format: 'power-eagle/runtime', formatVersion: 1, start: 'home', state: {}, components: {}, actions: {},
      dependencies: [{ package: 'installed.alpha', version: '^1.0.0', export: 'switch', kind: 'widget' }],
      screens: { home: { params: { type: 'object', properties: {}, required: [] }, state: {}, body: { type: qualified, props: { label: 'Installed' } } } },
    };
    const session = new RuntimeSession(document, catalog);
    const user = userEvent.setup();
    render(<RuntimeView session={session} />);

    expect(screen.getByRole('button').textContent).toBe('Installed: off · clsx 1.2.1');
    await user.click(screen.getByRole('button'));
    expect(screen.getByRole('button').textContent).toBe('Installed: on · clsx 1.2.1');
    expect([implementation.dependencyVersion, betaImplementation.dependencyVersion]).toEqual(['1.2.1', '2.1.1']);
    expect(implementation.dependencyPath.startsWith(alpha.root + sep)).toBe(true);
    expect(betaImplementation.dependencyPath.startsWith(beta.root + sep)).toBe(true);
    await session.dispose();
  });
});
