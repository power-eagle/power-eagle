import { Badge, SectionLabel, Switch } from '../components/ui';
import type { EffectiveRegistry } from '../host/activation/enablement';
import {
  contributionExports, contributionSelection, defaultSelection, groupWorkbenchPackages, packageContributions,
  selectionMatchesRecord, workbenchPackageKey, type ContributionKind, type WorkbenchPackage, type WorkbenchSelection,
} from './workbench-selection';

function ExportChoices({ record, contribution, selection, onSelect, registry, onToggleExport }: {
  record: WorkbenchPackage;
  contribution: ContributionKind;
  selection: WorkbenchSelection;
  onSelect(selection: WorkbenchSelection): void;
  registry?: EffectiveRegistry;
  onToggleExport?(identity: string, enabled: boolean): void;
}) {
  const descriptors = contributionExports(record.manifest, contribution);
  const identity = {
    packageId: record.manifest.id,
    ...(record.conversationId ? { conversationId: record.conversationId } : {}),
    ...(record.version !== undefined ? { version: record.version } : {}),
  };
  return <div className="pe-workbench-exports">
    {descriptors.map(descriptor => {
      const identityValue = `${record.manifest.id}/${descriptor.id}`;
      const state = registry?.exports.find(item => item.identity === identityValue);
      return <div className="pe-workbench-export" key={descriptor.id} data-status={state?.effectiveStatus}>
        <div>{descriptor.kind === 'runtime'
          ? descriptor.screens.map(screen => <button
        type="button" key={`${descriptor.id}/${screen}`}
        aria-label={`Select screen ${screen} from ${record.manifest.name}`}
        aria-current={selectionMatchesRecord(selection, record) && selection.exportId === descriptor.id && selection.screen === screen ? 'page' : undefined}
        onClick={() => onSelect({ ...identity, contribution, exportId: descriptor.id, screen })}
      >{screen}</button>)
          : <button
        type="button"
        aria-label={`Inspect ${descriptor.kind} ${descriptor.id} from ${record.manifest.name}`}
        aria-current={selectionMatchesRecord(selection, record) && selection.exportId === descriptor.id ? 'page' : undefined}
        onClick={() => onSelect({ ...identity, contribution, exportId: descriptor.id })}
      >{descriptor.id}</button>}</div>
        {state ? <small>{state.effectiveStatus} · {state.directConsumers.length}</small> : null}
        {state && onToggleExport ? <Switch
          checked={state.desiredExport}
          aria-label={`${state.desiredExport ? 'Disable' : 'Enable'} export ${state.identity}`}
          onCheckedChange={enabled => onToggleExport(state.identity, enabled)}
        /> : null}
      </div>;
    })}
  </div>;
}

export function WorkbenchSourceTree({
  packages, selection, onSelect,
  registry, onTogglePackage, onToggleExport,
}: {
  packages: readonly WorkbenchPackage[];
  selection: WorkbenchSelection;
  onSelect(selection: WorkbenchSelection): void;
  registry?: EffectiveRegistry;
  onTogglePackage?(packageId: string, enabled: boolean): void;
  onToggleExport?(identity: string, enabled: boolean): void;
}) {
  return <nav className="pe-workbench-source-tree" aria-label="Package sources">
    {groupWorkbenchPackages(packages).map(group => <section key={group.id} aria-label={group.label}>
      <SectionLabel>{group.label}</SectionLabel>
      {group.packages.map(record => {
        const selected = selectionMatchesRecord(selection, record);
        return <div className="pe-workbench-package" key={workbenchPackageKey(record)} data-status={record.status}>
          <div className="pe-workbench-package-head">
            <button type="button" aria-label={`Select package ${record.manifest.name}`} aria-current={selected ? 'page' : undefined} onClick={() => onSelect(defaultSelection(record))}>
              <span><strong>{record.manifest.name}</strong><small>{record.manifest.version} · {record.persistence}</small></span>
              <span className="pe-meta">{record.status}</span>
              {record.fresh ? <Badge>new</Badge> : null}
            </button>
            {onTogglePackage ? <Switch
              checked={registry?.packages.get(record.manifest.id)?.desired ?? record.status !== 'off'}
              aria-label={`${registry?.packages.get(record.manifest.id)?.desired === false ? 'Enable' : 'Disable'} package ${record.manifest.name}`}
              onCheckedChange={enabled => onTogglePackage(record.manifest.id, enabled)}
            /> : null}
          </div>
          <div className="pe-workbench-contributions">
            {packageContributions(record.manifest).map(contribution => <div key={contribution}>
              <button
                type="button"
                aria-label={`Select ${contribution} contribution from ${record.manifest.name}`}
                aria-current={selected && selection.contribution === contribution ? 'page' : undefined}
                onClick={() => onSelect(contributionSelection(record, contribution))}
              >{contribution}</button>
              {selected && selection.contribution === contribution
                ? <ExportChoices record={record} contribution={contribution} selection={selection} onSelect={onSelect} registry={registry} onToggleExport={onToggleExport} />
                : null}
            </div>)}
          </div>
        </div>;
      })}
    </section>)}
  </nav>;
}
