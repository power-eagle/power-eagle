import { afterEach, expect, it } from 'vitest';
import { createRequire } from 'node:module';
import { mkdtempSync, rmSync } from 'node:fs';
import { join, relative, resolve, sep } from 'node:path';
import { tmpdir } from 'node:os';
import * as React from 'react';
import * as ReactDOM from 'react-dom';
import * as jsxRuntime from 'react/jsx-runtime';
import { buildContributionArtifact } from '../../sdui/tooling/provider-package';
import { discoverContributionPackage, loadCompiledContributions } from './contribution-package';
import { ActivationController, contributionRegistrations } from '../activation/controller';
import { buildExportRegistryGraph } from '../activation/dependency-graph';
import { EnablementPreferences, reconcileEnablement } from '../activation/enablement';
import { collectActiveStyling } from '../activation/styling';
import { shellThemeStyle } from '../../app/workbench-theme';
import { PAPER_POP_IDENTITY } from '../../plugins/paper-pop';

const roots: string[] = [];
afterEach(() => {
  for (const root of roots.splice(0)) {
    const target = resolve(root);
    const rel = relative(resolve(tmpdir()), target);
    if (!rel.startsWith('power-eagle-theme-') || rel.includes(sep)) throw new Error('Unexpected cleanup directory');
    rmSync(target, { recursive: true, force: true });
  }
});

it('builds a standalone styling plugin and applies its activated tokens through the public loader', async () => {
  const root = mkdtempSync(join(tmpdir(), 'power-eagle-theme-'));
  roots.push(root);
  await buildContributionArtifact(resolve('src/plugins/paper-pop/power-eagle.build.json'), root);
  const hostRequire = createRequire(import.meta.url);
  const discovered = discoverContributionPackage(root, hostRequire, {
    hostTarget: { platform: 'win32', arch: 'x64', node: '16.17.1' },
  });
  const loaded = loadCompiledContributions(discovered, {
    hostRequire, sharedModules: { react: React, 'react-dom': ReactDOM, 'react/jsx-runtime': jsxRuntime },
  });
  expect(discovered.runtime).toBeUndefined();
  expect(loaded.map(item => item.kind)).toEqual(['styling']);
  const preferences = EnablementPreferences.open({ read: () => null, write: () => {} });
  const registry = reconcileEnablement(buildExportRegistryGraph([discovered]), preferences);
  const controller = new ActivationController();
  try {
    const result = await controller.reconcile(registry, contributionRegistrations(discovered, loaded));
    expect(result.failures.size).toBe(0);
    const catalog = collectActiveStyling(registry, result.snapshot);
    expect(shellThemeStyle(catalog, PAPER_POP_IDENTITY)).toMatchObject({
      '--background': '#fff9ef', '--source-header': '#d5eade', '--line-width': '2px',
    });
    preferences.setExport(PAPER_POP_IDENTITY, false);
    const revoked = reconcileEnablement(buildExportRegistryGraph([discovered]), preferences);
    expect(shellThemeStyle(collectActiveStyling(revoked, result.snapshot), PAPER_POP_IDENTITY)).toEqual({});
  } finally { await controller.dispose(); }
});
