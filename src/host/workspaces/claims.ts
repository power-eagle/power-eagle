import { buildExportRegistryGraph } from '../activation/dependency-graph';
import { EnablementPreferences, reconcileEnablement, type EffectiveRegistry, type EffectiveStatus } from '../activation/enablement';
import { contributionRegistrations } from '../activation/controller';
import type { DiscoveredPackage, LoadedContribution } from '../install/contribution-package';
import { pluginInstanceSchema, type PluginInstance } from './model';
import type { InstancePreferences } from './preferences';

export interface InstancePackage { instance: PluginInstance; discovered: DiscoveredPackage }
export interface InstanceClaim {
  instanceId: string; namespace: string; desired: boolean; status: EffectiveStatus;
  owner?: string; reason?: string;
}
export interface ClaimedRegistry {
  registry: EffectiveRegistry; claims: ReadonlyMap<string, InstanceClaim>;
  owners: ReadonlyMap<string, InstancePackage>;
}

export function resolveInstanceClaims(
  packages: readonly InstancePackage[], order: readonly string[], preferences: InstancePreferences,
): ClaimedRegistry {
  const byId = new Map<string, InstancePackage>();
  for (const item of packages) {
    pluginInstanceSchema.parse(item.instance);
    if (item.instance.namespace !== item.discovered.manifest.id) throw new Error('Artifact namespace does not match instance namespace');
    if (byId.has(item.instance.instanceId)) throw new Error(`Duplicate instance ${item.instance.instanceId}`);
    byId.set(item.instance.instanceId, item);
  }
  if (new Set(order).size !== order.length || order.length !== byId.size || order.some(id => !byId.has(id))) {
    throw new Error('Plugin order must contain every instance exactly once');
  }
  const claims = new Map<string, InstanceClaim>();
  const groups = new Map<string, InstancePackage[]>();
  for (const id of order) {
    const item = byId.get(id)!;
    const group = groups.get(item.instance.namespace) ?? [];
    group.push(item); groups.set(item.instance.namespace, group);
  }
  const owners = new Map<string, InstancePackage>();
  for (const [namespace, group] of groups) {
    // All declared forks must lead to the same root, even if that root was removed.
    const lineage = (item: InstancePackage): string | undefined => {
      const visited = new Set<string>();
      let current = item;
      while (current.instance.namespaceConflict) {
        if (visited.has(current.instance.instanceId)) return undefined;
        visited.add(current.instance.instanceId);
        const sourceId = current.instance.namespaceConflict.sourceInstanceId;
        const source = byId.get(sourceId);
        if (!source) return sourceId;
        if (source.instance.namespace !== namespace) return undefined;
        current = source;
      }
      return current.instance.instanceId;
    };
    const roots = group.map(lineage);
    const invalid = roots.some(root => !root) || new Set(roots).size !== 1;
    const desired = (item: InstancePackage) => preferences.enabled(item.instance.instanceId,
      !item.instance.forkOf && namespace !== 'power-eagle.paper-pop');
    const winner = invalid ? undefined : group.find(desired);
    if (winner) owners.set(namespace, winner);
    for (const item of group) {
      const enabled = desired(item);
      claims.set(item.instance.instanceId, {
        instanceId: item.instance.instanceId, namespace, desired: enabled,
        status: invalid ? 'failed' : enabled && winner === item ? 'active' : 'off',
        ...(invalid ? { reason: `Undeclared or invalid namespace conflict: ${namespace}` }
          : !enabled ? { reason: 'Plugin is disabled' }
          : winner !== item ? { owner: winner!.instance.instanceId, reason: `Namespace owned by ${winner!.instance.name}` } : {}),
      });
    }
  }
  const winning = [...owners.values()];
  const graph = buildExportRegistryGraph(winning.map(item => item.discovered), new Map(winning.map(item => [item.instance.namespace, order.indexOf(item.instance.instanceId)])));
  const projected = {
    format: 'power-eagle/enablement', formatVersion: 1, packages: {},
    exports: Object.fromEntries(winning.flatMap(item => item.discovered.manifest.exports.map(descriptor => [
      `${item.instance.namespace}/${descriptor.id}`, preferences.exportEnabled(item.instance.instanceId, descriptor.id),
    ]))),
  };
  const registry = reconcileEnablement(graph, EnablementPreferences.open({ read: () => JSON.stringify(projected), write: () => {} }));
  for (const [namespace, item] of owners) {
    const state = registry.packages.get(namespace);
    if (state) {
      const claim = claims.get(item.instance.instanceId)!;
      claim.status = state.effectiveStatus;
      if (state.reason) claim.reason = state.reason.message;
    }
  }
  return { registry, claims, owners };
}

export function instanceRegistrations(item: InstancePackage, loaded: readonly LoadedContribution[]) {
  return contributionRegistrations(item.discovered, loaded).map(registration => ({
    ...registration, group: `${item.instance.instanceId}@${item.instance.currentRevision}:${registration.group}`,
  }));
}
