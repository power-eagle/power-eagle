import { useCallback, useEffect, useState, useSyncExternalStore } from 'react';
import { createEagleCapabilities, type EagleCapabilities } from '../host/eagle-capabilities';
import { PluginCatalog } from '../host/workspaces/catalog';
import { ActivationInspector } from './activation-inspector';
import { WorkbenchSourceTree } from './source-tree';
import { defaultSelection, type WorkbenchPackage, type WorkbenchSelection } from './workbench-selection';
import { WorkbenchShell } from './workbench-shell';
import { RuntimeStage } from './runtime-stage';
import { useWorkbenchTheme } from './workbench-theme';
import { openPluginCatalog } from './plugin-catalog';

export default function App({ capabilities: suppliedCapabilities, catalog: suppliedCatalog }: { capabilities?: EagleCapabilities; catalog?: PluginCatalog } = {}) {
  const [capabilities] = useState(() => suppliedCapabilities ?? createEagleCapabilities());
  const [catalog, setCatalog] = useState(suppliedCatalog);
  const [error, setError] = useState('');
  useEffect(() => {
    if (suppliedCatalog) return;
    let cancelled = false;
    let current: PluginCatalog | undefined;
    void openPluginCatalog(capabilities).then(value => {
      current = value;
      if (cancelled) void value.dispose(); else setCatalog(value);
    }).catch(reason => { if (!cancelled) setError(String(reason)); });
    return () => { cancelled = true; void current?.dispose(); };
  }, [capabilities, suppliedCatalog]);
  if (error) return <div role="alert"><h1>Plugin workspaces could not open</h1><p>{error}</p><p>Your stored artifacts have been retained. Correct the reported storage or format problem and reopen Power Eagle.</p></div>;
  if (!catalog) return <p role="status">Opening plugin workspaces…</p>;
  return <CatalogWorkbench catalog={catalog} />;
}

export function CatalogWorkbench({ catalog }: { catalog: PluginCatalog }) {
  const snapshot = useSyncExternalStore(catalog.subscribe, catalog.snapshot, catalog.snapshot);
  const [selection, setSelection] = useState<WorkbenchSelection>();
  const [filter, setFilter] = useState('');
  const [error, setError] = useState('');
  const { registry } = snapshot;
  const theme = useWorkbenchTheme(registry, catalog.controller, snapshot.entries);
  const packages: WorkbenchPackage[] = snapshot.entries.map(({ instance, discovered }) => ({
    instanceId: instance.instanceId, sourceId: instance.origin.sourceId, sourceLabel: instance.origin.kind,
    sourceKind: instance.origin.kind === 'built-in' ? 'built-in' : instance.origin.kind === 'agent' ? 'generated' : 'installed',
    persistence: instance.origin.kind === 'built-in' ? 'built-in' : 'generated',
    manifest: { ...discovered.manifest, name: instance.name }, status: snapshot.claims.get(instance.instanceId)!.status,
    desired: snapshot.claims.get(instance.instanceId)!.desired,
    exportPreferences: Object.fromEntries(discovered.manifest.exports.map(item => [item.id, catalog.preferences.exportEnabled(instance.instanceId, item.id)])),
    version: instance.currentRevision,
  }));
  const selected = packages.find(record => record.instanceId === selection?.instanceId) ?? packages[0];
  const current = selection?.instanceId === selected?.instanceId ? selection : selected ? defaultSelection(selected) : undefined;
  const entry = snapshot.entries.find(item => item.instance.instanceId === selected?.instanceId);
  const claim = entry && snapshot.claims.get(entry.instance.instanceId);
  const selectedExport = current?.exportId ? registry.exports.find(item => item.identity === `${selected.manifest.id}/${current.exportId}`) : undefined;
  const showRuntime = claim?.status === 'active' && current?.contribution === 'runtime' && selectedExport?.effectiveStatus === 'active' && entry?.discovered.runtime;
  const report = (work: Promise<unknown>) => { setError(''); void work.catch(reason => setError(String(reason))); };
  const togglePackage = (id: string, enabled: boolean) => {
    const instanceId = snapshot.entries.find(item => item.instance.instanceId === id)?.instance.instanceId
      ?? snapshot.owners.get(id)?.instance.instanceId ?? selected.instanceId!;
    report(catalog.setEnabled(instanceId, enabled));
  };
  const toggleExport = (identity: string, enabled: boolean) => {
    const [namespace, exportId] = identity.split('/');
    const instanceId = namespace === selected.manifest.id ? selected.instanceId! : snapshot.owners.get(namespace)?.instance.instanceId;
    if (instanceId) report(catalog.setExport(instanceId, exportId, enabled));
  };
  const onScreenChange = useCallback((screen: string) => setSelection(value => {
    if (value && value.instanceId !== selected?.instanceId) return value;
    return selected ? { ...(value ?? defaultSelection(selected)), screen } : value;
  }), [selected]);
  if (!selected || !current || !entry || !claim) return <p>No plugins available.</p>;
  const ownRegistry = claim.status === 'off' ? {
    ...registry, packages: new Map(registry.packages).set(selected.manifest.id, { packageId: selected.manifest.id, desired: claim.desired, effectiveStatus: 'off' as const, exports: [], reason: { code: 'package-off' as const, message: claim.reason ?? 'Plugin is disabled' } }),
    exports: registry.exports.filter(item => item.packageId !== selected.manifest.id),
  } : registry;
  return <WorkbenchShell
    themeStyle={theme.style} themeIdentity={theme.effective || 'blueprint'}
    themeControl={<>
      <label className="pe-theme-picker"><span>Theme</span>
        <select aria-label="Theme" value={theme.selected} onChange={event => theme.choose(event.currentTarget.value)}>
          <option value="">Blueprint</option>
          {theme.options.map(option => <option key={option.identity} value={option.identity}>{option.label}{option.active ? '' : ' (off)'}</option>)}
          {theme.selected && !theme.options.some(option => option.identity === theme.selected) ? <option value={theme.selected}>Unavailable theme</option> : null}
        </select>
      </label>
      {theme.unavailable || theme.error ? <span className="pe-theme-notice" role="status">Using Blueprint</span> : null}
      {theme.saveError ? <span className="pe-theme-notice" role="status">Preference not saved</span> : null}
    </>}
    sources={<>
      {error ? <p role="alert">{error}</p> : null}
      <WorkbenchSourceTree packages={packages} selection={current} onSelect={setSelection} registry={registry}
        filter={filter} onFilter={setFilter} onTogglePackage={togglePackage} onToggleExport={toggleExport} />
    </>}
    sourceHint={String(packages.length)}
    stage={showRuntime ? <RuntimeStage key={catalog.runtimeKey(`${selected.manifest.id}/${current.exportId}`)} source={entry.discovered}
      activation={catalog} screen={current.screen} onScreenChange={onScreenChange} /> : <>
      {claim.reason ? <p role="status">{claim.reason}</p> : null}
      <ActivationInspector record={selected} selection={current} registry={ownRegistry}
        onTogglePackage={togglePackage} onToggleExport={toggleExport} />
      {!claim.desired ? <button type="button" onClick={() => togglePackage(selected.instanceId!, true)}>Enable package</button> : null}
    </>}
    stageTitle={selected.manifest.name} stageMode={showRuntime ? 'live view' : 'activation'}
    stageStatus={claim.status} stageCaption={[entry.instance.origin.kind, `revision ${entry.instance.currentRevision}`, showRuntime ? current.screen : current.contribution].filter(Boolean).join(' · ')}
    active={packages.filter(record => record.status === 'active').length} total={packages.length}
  />;
}
