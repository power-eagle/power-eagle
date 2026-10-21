import { useCallback, useEffect, useState, useSyncExternalStore } from 'react';
import { createEagleCapabilities, type EagleCapabilities } from '../host/eagle-capabilities';
import { PluginCatalog } from '../host/workspaces/catalog';
import { PluginDetails } from './plugin-details';
import { WorkbenchSourceTree } from './source-tree';
import { defaultSelection, type WorkbenchPackage, type WorkbenchSelection } from './workbench-selection';
import { StageBoundary, WorkbenchShell } from './workbench-shell';
import { RuntimeStage } from './runtime-stage';
import { useWorkbenchTheme } from './workbench-theme';
import { openPluginCatalog } from './plugin-catalog';
import { usePluginCreation } from './plugin-creation';
import { PluginAgent, type RuntimeModel } from '../host/workspaces/agent';
import { PluginAgentPanel } from './plugin-agent';
import { PackageControls } from './package-controls';

export default function App({ capabilities: suppliedCapabilities, catalog: suppliedCatalog, model }: { capabilities?: EagleCapabilities; catalog?: PluginCatalog; model?: RuntimeModel } = {}) {
  const [capabilities] = useState(() => suppliedCapabilities ?? createEagleCapabilities());
  const [catalog, setCatalog] = useState(suppliedCatalog);
  const [error, setError] = useState('');
  useEffect(() => {
    if (suppliedCatalog) return;
    let cancelled = false;
    let current: PluginCatalog | undefined;
    const close = () => { void current?.dispose().catch(reason => console.error('Package cleanup retained recovery state:', reason)); };
    window.addEventListener('pagehide', close);
    void openPluginCatalog(capabilities).then(value => {
      current = value;
      if (cancelled) void value.dispose(); else setCatalog(value);
    }).catch(reason => { if (!cancelled) setError(String(reason)); });
    return () => { cancelled = true; window.removeEventListener('pagehide', close); close(); };
  }, [capabilities, suppliedCatalog]);
  if (error) return <div role="alert"><h1>Plugin workspaces could not open</h1><p>{error}</p><p>Your stored artifacts have been retained. Correct the reported storage or format problem and reopen Power Eagle.</p></div>;
  if (!catalog) return <p role="status">Opening plugin workspaces…</p>;
  return <CatalogWorkbench catalog={catalog} model={model} />;
}

export function CatalogWorkbench({ catalog, model }: { catalog: PluginCatalog; model?: RuntimeModel }) {
  const snapshot = useSyncExternalStore(catalog.subscribe, catalog.snapshot, catalog.snapshot);
  const [selection, setSelection] = useState<WorkbenchSelection>();
  const [inspection, setInspection] = useState<WorkbenchSelection>();
  const select = (value: WorkbenchSelection) => { setInspection(undefined); setSelection(value); };
  const [filter, setFilter] = useState('');
  const [error, setError] = useState('');
  const [agent] = useState(() => new PluginAgent(catalog, model));
  useEffect(() => { void agent.recoverInterrupted().catch(reason => setError(String(reason))); }, [agent]);
  const { registry } = snapshot;
  const theme = useWorkbenchTheme(registry, catalog.controller, snapshot.entries);
  const packages: WorkbenchPackage[] = snapshot.entries.map(({ instance, discovered, session }) => ({
    instanceId: instance.instanceId, sourceId: instance.origin.sourceId, sourceLabel: instance.origin.kind,
    sourceKind: session ? 'session' : instance.origin.kind === 'built-in' ? 'built-in' : instance.origin.kind === 'agent' ? 'generated' : 'installed',
    persistence: session ? 'session' : instance.origin.kind === 'built-in' ? 'built-in' : 'persistent',
    manifest: { ...discovered.manifest, name: instance.name }, status: snapshot.claims.get(instance.instanceId)!.status,
    desired: snapshot.claims.get(instance.instanceId)!.desired,
    exportPreferences: Object.fromEntries(discovered.manifest.exports.map(item => [item.id, catalog.preferences.exportEnabled(instance.instanceId, item.id)])),
    version: instance.currentRevision,
  }));
  const liveSelected = packages.find(record => record.instanceId === selection?.instanceId) ?? packages[0];
  const liveCurrent = selection?.instanceId === liveSelected?.instanceId && selection?.version === liveSelected?.version ? selection : liveSelected ? defaultSelection(liveSelected) : undefined;
  const inspected = packages.find(record => record.instanceId === inspection?.instanceId);
  const selected = inspected ?? liveSelected;
  const current = inspected ? inspection?.version === inspected.version ? inspection : defaultSelection(inspected) : liveCurrent;
  const openInspection = (target: WorkbenchSelection) => {
    setSelection(liveCurrent);
    setInspection(target);
  };
  const closeInspection = () => {
    setInspection(undefined);
    const row = [...document.querySelectorAll<HTMLButtonElement>('.pe-workbench-package-select')].find(element => element.dataset.pluginId === liveSelected?.instanceId);
    (row ?? document.querySelector<HTMLInputElement>('[aria-label="Filter plugins"]'))?.focus();
  };
  const liveEntry = snapshot.entries.find(item => item.instance.instanceId === liveSelected?.instanceId);
  const liveClaim = liveEntry && snapshot.claims.get(liveEntry.instance.instanceId);
  const entry = snapshot.entries.find(item => item.instance.instanceId === selected?.instanceId);
  const claim = entry && snapshot.claims.get(entry.instance.instanceId);
  const creation = usePluginCreation(catalog, entry, instance => {
    setFilter('');
    const added = catalog.snapshot().entries.find(item => item.instance.instanceId === instance.instanceId)!;
    select(defaultSelection({ instanceId: instance.instanceId, manifest: added.discovered.manifest, version: instance.currentRevision } as WorkbenchPackage));
  });
  const liveExport = liveCurrent?.exportId ? registry.exports.find(item => item.identity === `${liveSelected.manifest.id}/${liveCurrent.exportId}`) : undefined;
  const showRuntime = liveClaim?.status === 'active' && liveCurrent?.contribution === 'runtime' && liveExport?.effectiveStatus === 'active' && liveEntry?.discovered.runtime;
  const report = (work: Promise<unknown>) => { setError(''); void work.catch(reason => setError(String(reason))); };
  const togglePackage = (id: string, enabled: boolean) => {
    report(catalog.setEnabled(id, enabled));
  };
  const toggleNamespacePackage = (id: string, enabled: boolean) => {
    const instanceId = id === selected.manifest.id ? selected.instanceId : snapshot.owners.get(id)?.instance.instanceId
      ?? snapshot.entries.find(item => item.instance.namespace === id)?.instance.instanceId;
    if (instanceId) report(catalog.setEnabled(instanceId, enabled));
  };
  const toggleExport = (identity: string, enabled: boolean) => {
    const [namespace, exportId] = identity.split('/');
    const instanceId = namespace === selected.manifest.id ? selected.instanceId! : snapshot.owners.get(namespace)?.instance.instanceId;
    if (instanceId) report(catalog.setExport(instanceId, exportId, enabled));
  };
  const onScreenChange = useCallback((screen: string) => setSelection(value => {
    if (value && value.instanceId !== liveSelected?.instanceId) return value;
    return liveSelected ? { ...(value ?? defaultSelection(liveSelected)), screen } : value;
  }), [liveSelected]);
  if (!selected || !current || !entry || !claim) return <p>No plugins available.</p>;
  const ownRegistry = claim.status === 'off' ? {
    ...registry, packages: new Map(registry.packages).set(selected.manifest.id, { packageId: selected.manifest.id, desired: claim.desired, effectiveStatus: 'off' as const, exports: [], reason: { code: 'package-off' as const, message: claim.reason ?? 'Plugin is disabled' } }),
    exports: [...registry.exports.filter(item => item.packageId !== selected.manifest.id), ...entry.discovered.manifest.exports.map(descriptor => ({
      identity: `${selected.manifest.id}/${descriptor.id}`, packageId: selected.manifest.id, packageVersion: selected.manifest.version,
      source: entry.discovered.root, descriptor, dependencies: [], directConsumers: [], status: 'resolved' as const, diagnostics: [],
      desiredPackage: claim.desired, desiredExport: catalog.preferences.exportEnabled(entry.instance.instanceId, descriptor.id),
      effectiveStatus: 'off' as const, ...(!claim.desired ? { reason: { code: 'package-off' as const, message: 'Plugin is disabled' } } : {}),
    }))],
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
      {creation.form}
      {error ? <p role="alert">{error}</p> : null}
      <WorkbenchSourceTree packages={packages} selection={current} onSelect={select} onInspect={record => openInspection(defaultSelection(record))} registry={registry}
        onMove={(id, before) => report(catalog.move(id, before))}
        filter={filter} onFilter={setFilter} onTogglePackage={togglePackage} />
    </>}
    sourceHint={String(packages.length)}
    sourceActions={creation.actions}
    sourceFooter={<PackageControls acquisition={catalog.acquisition} unavailableReason={catalog.acquisitionError} selected={entry} onSelect={id => {
      setFilter('');
      const added = catalog.snapshot().entries.find(item => item.instance.instanceId === id);
      if (added) select(defaultSelection({ instanceId: id, manifest: added.discovered.manifest, version: added.instance.currentRevision } as WorkbenchPackage));
    }} />}
    agent={entry.session ? <p>Duplicate this preview to create an editable plugin with its own Agent conversation.</p> : <PluginAgentPanel key={entry.instance.instanceId} agent={agent} entry={entry} />}
    onCloseDetails={inspected ? closeInspection : undefined}
    stage={<>
      <div className="pe-live-stage" hidden={Boolean(inspected)}>
        {showRuntime && liveEntry && liveCurrent ? <StageBoundary key={catalog.runtimeKey(`${liveSelected.manifest.id}/${liveCurrent.exportId}`)}>
          <RuntimeStage source={liveEntry.discovered} activation={catalog} screen={liveCurrent.screen} onScreenChange={onScreenChange} />
        </StageBoundary> : null}
      </div>
      {inspected || !showRuntime ? <>
        {claim.reason ? <p role="status">{claim.reason}</p> : null}
        {claim.owner ? <div className="pe-plugin-conflict"><small>Owner: {claim.owner}</small>
          <button type="button" disabled={Boolean(filter.trim())} onClick={() => report(catalog.move(entry.instance.instanceId, claim.owner!))}>Move above owner</button></div> : null}
        {inspected ? <PluginDetails record={selected} selection={current} registry={ownRegistry}
          onSelectionChange={setInspection} onOpenScreen={select}
          onTogglePackage={toggleNamespacePackage} onToggleExport={toggleExport} /> : <section className="pe-plugin-summary" aria-label={`${selected.manifest.name} summary`}>
          <p>{selected.manifest.description}</p>
          {!claim.desired ? <button type="button" onClick={() => togglePackage(entry.instance.instanceId, true)}>Enable package</button> : null}
          {liveExport?.reason && liveExport.reason.message !== claim.reason ? <p role="status">{liveExport.reason.message}</p> : null}
          <button type="button" onClick={() => openInspection(current)}>Inspect plugin…</button>
        </section>}
      </> : null}
    </>}
    stageTitle={selected.manifest.name} stageMode={inspected ? 'inspection' : showRuntime ? 'live view' : 'summary'}
    stageStatus={claim.status} stageCaption={[entry.instance.origin.kind, `revision ${entry.instance.currentRevision}`, inspected ? current.contribution : showRuntime ? current.screen : undefined].filter(Boolean).join(' · ')}
    active={packages.filter(record => record.status === 'active').length} total={packages.length}
  />;
}
