import type { DiscoveredPackage } from '../host/install/contribution-package';
import { buildExportRegistryGraph } from '../host/activation/dependency-graph';
import {
  EnablementPreferences, reconcileEnablement, type EffectiveRegistry, type EnablementPersistence,
} from '../host/activation/enablement';

export class WorkbenchActivationModel {
  readonly #graph;
  readonly #preferences: EnablementPreferences;

  constructor(packages: readonly DiscoveredPackage[], persistence: EnablementPersistence) {
    this.#graph = buildExportRegistryGraph(packages);
    this.#preferences = EnablementPreferences.open(persistence);
  }

  snapshot(): EffectiveRegistry { return reconcileEnablement(this.#graph, this.#preferences); }

  setPackage(packageId: string, enabled: boolean): EffectiveRegistry {
    this.#preferences.setPackage(packageId, enabled);
    return this.snapshot();
  }

  setExport(identity: string, enabled: boolean): EffectiveRegistry {
    this.#preferences.setExport(identity, enabled);
    return this.snapshot();
  }
}
