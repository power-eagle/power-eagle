import type { AcquiredContributionPackage, PackagePersistence } from '../host/install/package-repository';
import type { ExportDescriptor, PackageManifest } from '../sdui/schema/model';

export type WorkbenchSourceKind = 'built-in' | 'installed' | 'generated' | 'session';
export type WorkbenchStatus = 'active' | 'off' | 'failed';
export type ContributionKind = keyof PackageManifest['contributions'];

export interface WorkbenchPackage {
  sourceId: string;
  sourceLabel: string;
  sourceKind: WorkbenchSourceKind;
  persistence: 'built-in' | PackagePersistence | 'generated';
  manifest: PackageManifest;
  status: WorkbenchStatus;
  failure?: string;
  fresh?: boolean;
  conversationId?: string;
  version?: number;
}

export interface WorkbenchSelection {
  packageId: string;
  contribution?: ContributionKind;
  exportId?: string;
  screen?: string;
  conversationId?: string;
  version?: number;
}

export interface WorkbenchSourceGroup {
  id: string;
  label: string;
  kind: WorkbenchSourceKind;
  packages: WorkbenchPackage[];
}

const contributionOrder: ContributionKind[] = ['runtime', 'widgets', 'styling', 'actions', 'services'];
const contributionExportKind: Record<ContributionKind, ExportDescriptor['kind']> = {
  runtime: 'runtime', widgets: 'widget', styling: 'styling', actions: 'action', services: 'service',
};

export function packageContributions(manifest: PackageManifest): ContributionKind[] {
  return contributionOrder.filter(kind => manifest.contributions[kind] !== undefined);
}

export function contributionExports(manifest: PackageManifest, contribution: ContributionKind): ExportDescriptor[] {
  return manifest.exports.filter(descriptor => descriptor.kind === contributionExportKind[contribution]);
}

export function contributionSelection(record: WorkbenchPackage, contribution: ContributionKind): WorkbenchSelection {
  const descriptor = contributionExports(record.manifest, contribution)[0];
  return {
    packageId: record.manifest.id,
    ...(record.conversationId ? { conversationId: record.conversationId } : {}),
    ...(record.version !== undefined ? { version: record.version } : {}),
    contribution,
    ...(descriptor ? { exportId: descriptor.id } : {}),
    ...(descriptor?.kind === 'runtime' && descriptor.screens[0] ? { screen: descriptor.screens[0] } : {}),
  };
}

export function selectionMatchesRecord(selection: WorkbenchSelection, record: WorkbenchPackage): boolean {
  return selection.packageId === record.manifest.id &&
    selection.conversationId === record.conversationId && selection.version === record.version;
}

export function workbenchPackageKey(record: WorkbenchPackage): string {
  return [record.sourceId, record.manifest.id, record.conversationId ?? '', record.version ?? ''].join(':');
}

export function defaultSelection(record: WorkbenchPackage): WorkbenchSelection {
  const contribution = packageContributions(record.manifest)[0];
  return contribution ? contributionSelection(record, contribution) : { packageId: record.manifest.id };
}

export function groupWorkbenchPackages(records: readonly WorkbenchPackage[]): WorkbenchSourceGroup[] {
  const groups = new Map<string, WorkbenchSourceGroup>();
  records.forEach(record => {
    const group = groups.get(record.sourceId) ?? {
      id: record.sourceId, label: record.sourceLabel, kind: record.sourceKind, packages: [],
    };
    group.packages.push(record);
    groups.set(group.id, group);
  });
  const rank: Record<WorkbenchSourceKind, number> = { 'built-in': 0, installed: 1, generated: 2, session: 3 };
  return [...groups.values()]
    .map(group => ({ ...group, packages: [...group.packages].sort((a, b) => a.manifest.name.localeCompare(b.manifest.name)) }))
    .sort((a, b) => rank[a.kind] - rank[b.kind] || a.label.localeCompare(b.label));
}

export function acquiredWorkbenchPackage(
  record: AcquiredContributionPackage,
  status: WorkbenchStatus = 'active',
): WorkbenchPackage {
  return {
    sourceId: record.persistence === 'session' ? 'session' : record.acquired.artifact.source_id,
    sourceLabel: record.persistence === 'session' ? 'session only' : record.acquired.artifact.source_id,
    sourceKind: record.persistence === 'session' ? 'session' : 'installed',
    persistence: record.persistence, manifest: record.discovered.manifest, status,
  };
}
