import { useCallback, useState } from 'react';
import example from '../../examples/runtime-flow/document';
import exampleManifest from '../../examples/runtime-flow/manifest.json';
import { WebStorageEnablementPersistence, type EnablementPersistence } from '../host/activation/enablement';
import type { DiscoveredPackage } from '../host/install/contribution-package';
import { createEagleCapabilities, type EagleCapabilities } from '../host/eagle-capabilities';
import { builtinContributionManifests, builtinTools } from '../plugins/builtins';
import type { PackageManifest } from '../sdui/schema/model';
import { ActivationInspector } from './activation-inspector';
import { WorkbenchSourceTree } from './source-tree';
import { WorkbenchActivationModel } from './workbench-activation';
import { defaultSelection, selectionMatchesRecord, type WorkbenchPackage } from './workbench-selection';
import { WorkbenchShell } from './workbench-shell';
import { RuntimeStage } from './runtime-stage';

const manifests = [exampleManifest as PackageManifest, ...builtinContributionManifests];
const discoveredPackages: DiscoveredPackage[] = manifests.map(manifest => {
  const tool = builtinTools.find(item => item.manifest.id === manifest.id);
  const runtime = manifest.id === exampleManifest.id ? example : tool?.document;
  return {
    root: `builtin:${manifest.id}`, manifestPath: `builtin:${manifest.id}/manifest.json`, manifest,
    entries: { ...manifest.contributions }, assets: {}, ...(runtime ? { runtime } : {}),
  };
});
const basePackages: WorkbenchPackage[] = manifests.map(manifest => ({
  sourceId: 'built-in', sourceLabel: 'built-in', sourceKind: 'built-in', persistence: 'built-in', manifest, status: 'active',
}));

function enablementPersistence(): EnablementPersistence {
  if (typeof window !== 'undefined') {
    try { return new WebStorageEnablementPersistence(window.localStorage); } catch { /* non-browser rendering */ }
  }
  let value: string | null = null;
  return { read: () => value, write: next => { value = next; } };
}

export default function App({ capabilities: suppliedCapabilities }: { capabilities?: EagleCapabilities } = {}) {
  const [capabilities] = useState(() => suppliedCapabilities ?? createEagleCapabilities());
  const [activation] = useState(() => new WorkbenchActivationModel(
    discoveredPackages, enablementPersistence(),
  ));
  const [registry, setRegistry] = useState(() => activation.snapshot());
  const packages = basePackages.map(record => ({
    ...record, status: registry.packages.get(record.manifest.id)?.effectiveStatus ?? record.status,
  }));
  const [selection, setSelection] = useState(() => defaultSelection(basePackages[0]));
  const selected = packages.find(record => selectionMatchesRecord(selection, record)) ?? packages[0];
  const selectedExport = selection.exportId
    ? registry.exports.find(item => item.identity === `${selected.manifest.id}/${selection.exportId}`)
    : undefined;
  const runtimeSource = discoveredPackages.find(source => source.manifest.id === selected.manifest.id && source.runtime);
  const showRuntime = selection.contribution === 'runtime' && selectedExport?.effectiveStatus === 'active' && runtimeSource;
  const onScreenChange = useCallback((screen: string) => setSelection(current => ({ ...current, screen })), []);
  const togglePackage = (packageId: string, enabled: boolean) => setRegistry(activation.setPackage(packageId, enabled));
  const toggleExport = (identity: string, enabled: boolean) => setRegistry(activation.setExport(identity, enabled));
  return <WorkbenchShell
    sources={<WorkbenchSourceTree
      packages={packages} selection={selection} onSelect={setSelection} registry={registry}
      onTogglePackage={togglePackage} onToggleExport={toggleExport}
    />}
    sourceHint={String(packages.length)}
    stage={showRuntime ? <RuntimeStage key={`${selected.manifest.id}/${selection.exportId}`}
      source={runtimeSource} capabilities={capabilities} activation={activation}
      screen={selection.screen} onScreenChange={onScreenChange}
    /> : <ActivationInspector
      record={selected} selection={selection} registry={registry}
      onTogglePackage={togglePackage} onToggleExport={toggleExport}
    />}
    stageTitle={selected.manifest.name}
    stageMode={showRuntime ? 'live view' : 'activation'}
    stageStatus={selectedExport?.effectiveStatus ?? selected.status}
    stageCaption={[selected.persistence, showRuntime ? selection.screen : selection.contribution].filter(Boolean).join(' · ')}
    active={packages.filter(record => record.status === 'active').length}
    total={packages.length}
  />;
}
