import * as React from 'react';
import * as ReactDOM from 'react-dom';
import * as jsx from 'react/jsx-runtime';
import example from '../../examples/runtime-flow/document';
import exampleManifest from '../../examples/runtime-flow/manifest.json';
import { builtinTools, builtinContributionManifests } from '../plugins/builtins';
import materializedProvider from '../plugins/materialized';
import { paperPopPackage } from '../plugins/paper-pop';
import { optionalHostRequire } from '../host/install/runtime-modules';
import type { EagleCapabilities } from '../host/eagle-capabilities';
import { WorkspaceStore } from '../host/workspaces/store';
import { PluginCatalog, type CatalogEntry } from '../host/workspaces/catalog';
import { InstancePreferences } from '../host/workspaces/preferences';
import { newPluginInstance } from '../host/workspaces/model';
import type { PackageManifest } from '../sdui/schema/model';
import { pluginRootFromEagleUrl } from './provider-experiment-path';

export const INSTANCE_PREFERENCES_KEY = 'power-eagle.instances.v1';
export const sharedModules = { react: React, 'react-dom': ReactDOM, 'react/jsx-runtime': jsx };
let boot: Promise<unknown> = Promise.resolve();
export function openPluginCatalog(capabilities: EagleCapabilities): Promise<PluginCatalog> {
  const operation = boot.then(async () => {
    const hostRequire = optionalHostRequire();
    if (hostRequire) {
      const path = hostRequire('node:path') as typeof import('node:path');
      const fs = hostRequire('node:fs') as typeof import('node:fs');
      const os = hostRequire('node:os') as typeof import('node:os');
      const store = new WorkspaceStore(path.join(os.homedir(), '.powereagle'), hostRequire);
      const page = new URL(location.href);
      const directory = page.protocol === 'file:'
        ? path.dirname((hostRequire('node:url') as typeof import('node:url')).fileURLToPath(page))
        : pluginRootFromEagleUrl(page.href, 'standalone', path);
      if (!directory) throw new Error('Cannot locate shipped plugins from this Eagle page');
      const root = path.join(directory, 'builtins');
      const ids = JSON.parse(fs.readFileSync(path.join(root, 'index.json'), 'utf8')) as string[];
      for (const id of ids) await store.register(path.join(root, id), { kind: 'built-in', sourceId: id }, `builtin.${id}`);
      const preferenceFile = store.bounded('preferences.json');
      const preferences = InstancePreferences.open({ read: () => fs.existsSync(preferenceFile) ? fs.readFileSync(preferenceFile, 'utf8') : null,
        write: value => store.atomicWrite('preferences.json', JSON.parse(value)) });
      const catalog = new PluginCatalog(preferences, { hostRequire, sharedModules, host: { eagle: capabilities } }, store);
      await catalog.refresh(); return catalog;
    }
    // Browser development surface: common providers and registry, with durable operations explicitly unavailable.
    const manifests = [exampleManifest as PackageManifest, ...builtinContributionManifests];
    const entries: CatalogEntry[] = manifests.map(manifest => {
      const instance = newPluginInstance(manifest.name, { kind: 'built-in', sourceId: manifest.id });
      instance.instanceId = `builtin.${manifest.id}`; instance.namespace = manifest.id;
      const runtime = manifest.id === exampleManifest.id ? example : builtinTools.find(item => item.manifest.id === manifest.id)?.document;
      return { instance, discovered: { root: `preview:${manifest.id}`, manifestPath: '', manifest, entries: manifest.contributions, assets: {}, runtime } };
    });
    const preferences = InstancePreferences.open({ read: () => window.localStorage.getItem(INSTANCE_PREFERENCES_KEY), write: value => window.localStorage.setItem(INSTANCE_PREFERENCES_KEY, value) });
    const catalog = new PluginCatalog(preferences, undefined, undefined, entries, entry => {
      if (entry.instance.namespace === paperPopPackage.discovered.manifest.id) return [paperPopPackage.loaded];
      const contribution = entry.discovered.manifest.contributions.actions ? 'actions' : entry.discovered.manifest.contributions.services ? 'services' : undefined;
      if (!contribution) return [];
      const provider = materializedProvider({ packageId: entry.instance.namespace, packageRoot: entry.discovered.root, sharedModules,
        require: (() => { throw new Error('Node modules require Eagle'); }) as unknown as NodeRequire,
        assetUrl: () => { throw new Error('Package assets require Eagle'); }, host: { eagle: capabilities } });
      return [{ entry: contribution, contribution, kind: provider.kind, exports: provider.exports }];
    });
    await catalog.refresh(); return catalog;
  });
  boot = operation.catch(() => {}); return operation;
}
