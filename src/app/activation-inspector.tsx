import { Switch } from '../components/ui';
import type { EffectiveExport, EffectiveRegistry } from '../host/activation/enablement';
import type { WorkbenchPackage, WorkbenchSelection } from './workbench-selection';

export interface ActivationInspectorProps {
  record: WorkbenchPackage;
  selection: WorkbenchSelection;
  registry: EffectiveRegistry;
  onTogglePackage(packageId: string, enabled: boolean): void;
  onToggleExport(identity: string, enabled: boolean): void;
}

function Recovery({ node, registry, onTogglePackage, onToggleExport }: {
  node: EffectiveExport;
  registry: EffectiveRegistry;
  onTogglePackage(packageId: string, enabled: boolean): void;
  onToggleExport(identity: string, enabled: boolean): void;
}) {
  if (node.reason?.code === 'package-off') {
    return <button className="pe-activation-recovery-action" type="button" onClick={() => onTogglePackage(node.packageId, true)}>Enable package</button>;
  }
  if (node.reason?.code === 'export-off') {
    return <button className="pe-activation-recovery-action" type="button" onClick={() => onToggleExport(node.identity, true)}>Enable export</button>;
  }
  if (node.reason?.dependency) {
    const required = registry.exports.find(item => item.identity === node.reason?.dependency);
    if (required && !required.desiredPackage) {
      return <button className="pe-activation-recovery-action" type="button" onClick={() => onTogglePackage(required.packageId, true)}>Enable required package</button>;
    }
    if (required && !required.desiredExport) {
      return <button className="pe-activation-recovery-action" type="button" onClick={() => onToggleExport(required.identity, true)}>Enable required export</button>;
    }
  }
  return node.effectiveStatus === 'failed'
    ? <span className="pe-activation-recovery">Repair or reacquire the package, then retry activation.</span>
    : null;
}

export function ActivationInspector({
  record, selection, registry, onTogglePackage, onToggleExport,
}: ActivationInspectorProps) {
  const packageState = registry.packages.get(record.manifest.id);
  const exports = registry.exports.filter(item => item.packageId === record.manifest.id &&
    (selection.exportId ? item.descriptor.id === selection.exportId : true));
  return <section className="pe-activation-inspector" aria-label={`${record.manifest.name} activation`}>
    <header>
      <div><strong>{record.manifest.name}</strong><small>{record.manifest.version} · {record.persistence}</small></div>
      <span data-status={packageState?.effectiveStatus ?? record.status}>{packageState?.effectiveStatus ?? record.status}</span>
      {packageState ? <Switch
        checked={packageState.desired}
        aria-label={`${packageState.desired ? 'Disable' : 'Enable'} package ${record.manifest.name}`}
        onCheckedChange={enabled => onTogglePackage(record.manifest.id, enabled)}
      /> : null}
    </header>
    <p>{record.manifest.description}</p>
    <div className="pe-activation-exports">
      {exports.map(node => <article key={`${node.identity}/${node.source}`} data-status={node.effectiveStatus}>
        <div>
          <strong>{node.descriptor.id}</strong>
          <small>{node.descriptor.kind} · {node.directConsumers.length} direct {node.directConsumers.length === 1 ? 'consumer' : 'consumers'}</small>
        </div>
        <span>{node.effectiveStatus}</span>
        <Switch
          checked={node.desiredExport}
          aria-label={`${node.desiredExport ? 'Disable' : 'Enable'} export ${node.identity}`}
          onCheckedChange={enabled => onToggleExport(node.identity, enabled)}
        />
        {node.reason ? <code>{node.reason.message}</code> : null}
        <Recovery node={node} registry={registry} onTogglePackage={onTogglePackage} onToggleExport={onToggleExport} />
      </article>)}
    </div>
  </section>;
}
