import { useState } from 'react';
import example from '../../examples/runtime-flow/document';
import exampleManifest from '../../examples/runtime-flow/manifest.json';
import { foundationRuntimeCatalog } from '../sdui/runtime/foundation';
import { RuntimeSession } from '../sdui/runtime/session';
import { RuntimeView } from '../sdui/runtime/view';
import { eagleSelectionAdapter } from '../host/eagle-selection';
import { builtinContributionManifests } from '../plugins/builtins';
import type { ExportDescriptor, PackageManifest } from '../sdui/schema/model';
import { WorkbenchSourceTree } from './source-tree';
import { defaultSelection, selectionMatchesRecord, type WorkbenchPackage } from './workbench-selection';
import { WorkbenchShell } from './workbench-shell';

const session = new RuntimeSession(example, foundationRuntimeCatalog, { selection: eagleSelectionAdapter() });
const packages: WorkbenchPackage[] = [exampleManifest as PackageManifest, ...builtinContributionManifests].map(manifest => ({
  sourceId: 'built-in', sourceLabel: 'built-in', sourceKind: 'built-in', persistence: 'built-in', manifest, status: 'active',
}));

function Inspection({ record, selection }: { record: WorkbenchPackage; selection: ReturnType<typeof defaultSelection> }) {
  const exports = record.manifest.exports.filter(item =>
    selection.exportId ? item.id === selection.exportId : selection.contribution ? contributionMatches(item, selection.contribution) : true);
  return <div className="pe-package-inspection">
    <p>{record.manifest.description}</p>
    <dl>{exports.map(item => <div key={`${item.kind}/${item.id}`}>
      <dt>{item.id}</dt><dd>{item.kind}</dd>
    </div>)}</dl>
  </div>;
}

function contributionMatches(item: ExportDescriptor, contribution: NonNullable<ReturnType<typeof defaultSelection>['contribution']>): boolean {
  return ({ runtime: 'runtime', widgets: 'widget', styling: 'styling', actions: 'action', services: 'service' } as const)[contribution] === item.kind;
}

export default function App() {
  const [selection, setSelection] = useState(() => defaultSelection(packages[0]));
  const selected = packages.find(record => selectionMatchesRecord(selection, record)) ?? packages[0];
  const showFoundation = selected.manifest.id === exampleManifest.id && selection.contribution === 'runtime';
  return <WorkbenchShell
    sources={<WorkbenchSourceTree packages={packages} selection={selection} onSelect={setSelection} />}
    sourceHint={String(packages.length)}
    stage={showFoundation ? <RuntimeView session={session} /> : <Inspection record={selected} selection={selection} />}
    stageTitle={selected.manifest.name}
    stageCaption={[selected.manifest.id, selected.persistence, selection.contribution ?? 'package', selection.exportId, selection.screen].filter(Boolean).join(' · ')}
    active={packages.length}
    total={packages.length}
  />;
}
