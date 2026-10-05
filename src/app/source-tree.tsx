import { useState } from 'react';
import { Badge, Input, SectionLabel } from '../components/ui';
import type { EffectiveRegistry } from '../host/activation/enablement';
import {
  contributionExports, contributionSelection, defaultSelection, groupWorkbenchPackages, packageContributions,
  selectionMatchesRecord, workbenchPackageKey, type ContributionKind, type WorkbenchPackage, type WorkbenchSelection,
} from './workbench-selection';

function SourceToggle({ name, enabled, status, onToggle }: {
  name: string;
  enabled: boolean;
  status: string;
  onToggle(): void;
}) {
  const label = `${enabled ? 'Disable' : 'Enable'} ${name}`;
  return <button type="button" role="switch" aria-checked={enabled} aria-label={label}
    aria-description={`Currently ${status}`} title={`${label} · currently ${status}`}
    className={`pe-iris${status === 'failed' ? ' pe-iris-failed' : status === 'active' ? ' pe-iris-on' : ''}`}
    onClick={onToggle}>
    <span className="pe-iris-dot" aria-hidden="true" />
  </button>;
}

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
        {state && onToggleExport ? <SourceToggle name={`export ${state.identity}`}
          enabled={state.desiredExport} status={state.effectiveStatus}
          onToggle={() => onToggleExport(state.identity, !state.desiredExport)}
        /> : <span className="pe-workbench-tree-branch" aria-hidden="true" />}
        <div className="pe-workbench-export-links">{descriptor.kind === 'runtime'
          ? descriptor.screens.map(screen => <button
        className="pe-workbench-tree-link"
        type="button" key={`${descriptor.id}/${screen}`}
        aria-label={`Select screen ${screen} from ${record.manifest.name}`}
        aria-current={selectionMatchesRecord(selection, record) && selection.exportId === descriptor.id && selection.screen === screen ? 'page' : undefined}
        onClick={() => onSelect({ ...identity, contribution, exportId: descriptor.id, screen })}
      >{screen}</button>)
          : <button
        className="pe-workbench-tree-link"
        type="button"
        aria-label={`Inspect ${descriptor.kind} ${descriptor.id} from ${record.manifest.name}`}
        aria-current={selectionMatchesRecord(selection, record) && selection.exportId === descriptor.id ? 'page' : undefined}
        onClick={() => onSelect({ ...identity, contribution, exportId: descriptor.id })}
      >{descriptor.id}</button>}</div>
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
  const [query, setQuery] = useState('');
  const terms = query.trim().toLocaleLowerCase().split(/\s+/u).filter(Boolean);
  const filtered = packages.filter(record => {
    const text = [record.manifest.name, record.manifest.id, record.manifest.description,
      record.sourceLabel, sourceGroupLabel(record.sourceKind, record.sourceLabel)].join(' ').toLocaleLowerCase();
    return terms.every(term => text.includes(term));
  });
  return <nav className="pe-workbench-source-tree" aria-label="Package sources">
    <div className="pe-plugin-search">
      <Input size="sm" type="search" aria-label="Filter plugins" placeholder="Filter plugins…"
        value={query} onChange={event => setQuery(event.currentTarget.value)} />
      {query ? <button type="button" aria-label="Clear plugin filter" onClick={() => setQuery('')}>×</button> : null}
    </div>
    {filtered.length === 0 ? <p className="pe-plugin-search-empty" role="status">No matching plugins.</p> : null}
    {groupWorkbenchPackages(filtered).map(group => <section key={group.id} aria-label={sourceGroupLabel(group.kind, group.label)}>
      <SectionLabel>{sourceGroupLabel(group.kind, group.label)}</SectionLabel>
      {group.packages.map(record => {
        const selected = selectionMatchesRecord(selection, record);
        const enabled = registry?.packages.get(record.manifest.id)?.desired ?? record.status !== 'off';
        return <div className="pe-workbench-package" key={workbenchPackageKey(record)} data-status={record.status}>
          <div className="pe-workbench-package-head" data-selected={selected}>
            {onTogglePackage ? <SourceToggle name={`package ${record.manifest.name}`} enabled={enabled} status={record.status}
              onToggle={() => onTogglePackage(record.manifest.id, !enabled)}
            /> : <span className="pe-workbench-tree-branch" aria-hidden="true" />}
            <button className="pe-workbench-package-select" type="button" aria-label={`Select package ${record.manifest.name}`} aria-current={selected ? 'page' : undefined} onClick={() => onSelect(defaultSelection(record))}>
              <span>
                <span className="pe-workbench-package-title"><strong>{record.manifest.name}</strong>{record.fresh ? <Badge>new</Badge> : null}</span>
                <small>{record.manifest.version} · {record.persistence}</small>
                {record.status !== 'active' ? <small className="pe-workbench-package-status">{record.status}</small> : null}
              </span>
            </button>
          </div>
          {selected ? <div className="pe-workbench-contributions">
            {packageContributions(record.manifest).map(contribution => <div key={contribution}>
              <button
                className="pe-workbench-tree-link pe-workbench-contribution-link"
                type="button"
                aria-label={`Select ${contribution} contribution from ${record.manifest.name}`}
                aria-current={selected && selection.contribution === contribution ? 'page' : undefined}
                onClick={() => onSelect(contributionSelection(record, contribution))}
              ><span aria-hidden="true">{selection.contribution === contribution ? '⌄' : '›'}</span>{contribution}</button>
              {selected && selection.contribution === contribution
                ? <ExportChoices record={record} contribution={contribution} selection={selection} onSelect={onSelect} registry={registry} onToggleExport={onToggleExport} />
                : null}
            </div>)}
          </div> : null}
        </div>;
      })}
    </section>)}
  </nav>;
}

function sourceGroupLabel(kind: WorkbenchPackage['sourceKind'], label: string): string {
  if (kind === 'built-in') return 'Included with Power Eagle';
  if (kind === 'generated') return 'Created by Agent';
  if (kind === 'session') return 'Session only';
  return label;
}
