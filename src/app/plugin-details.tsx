import { Tabs } from '../components/ui';
import { ActivationInspector, type ActivationInspectorProps } from './activation-inspector';
import { contributionSelection, packageContributions, type ContributionKind, type WorkbenchSelection } from './workbench-selection';

export function PluginDetails({ onSelectionChange, ...props }: ActivationInspectorProps & {
  onSelectionChange(selection: WorkbenchSelection): void;
}) {
  const { record, selection } = props;
  const categories = packageContributions(record.manifest);
  return <div className="pe-plugin-details">
    <small className="pe-plugin-origin">{[...new Set([record.manifest.id, record.sourceLabel, record.persistence])].join(' · ')}</small>
    <Tabs aria-label="Plugin contributions" items={categories} value={selection.contribution ?? categories[0] ?? ''}
      onValueChange={value => onSelectionChange(contributionSelection(record, value as ContributionKind))} />
    <div role="tabpanel" aria-label={`${selection.contribution ?? 'Plugin'} exports`}>
      <ActivationInspector {...props} selection={{ ...selection, exportId: undefined }} />
    </div>
  </div>;
}
