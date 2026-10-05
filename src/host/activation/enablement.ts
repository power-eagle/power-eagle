import { z } from 'zod';
import { identifier, qualifiedId } from '../../sdui/schema/model';
import type { ExportRegistryGraph, RegistryDiagnostic, RegistryExport } from './dependency-graph';

const preferenceSchema = z.strictObject({
  format: z.literal('power-eagle/enablement'),
  formatVersion: z.literal(1),
  packages: z.record(identifier, z.boolean()),
  exports: z.record(qualifiedId, z.boolean()),
});

export type EnablementDocument = z.infer<typeof preferenceSchema>;

export interface EnablementPersistence {
  read(): string | null;
  write(value: string): void;
}

export class EnablementPreferenceError extends Error {
  constructor(message: string, public readonly cause?: unknown) {
    super(message);
    this.name = 'EnablementPreferenceError';
  }
}

const emptyDocument = (): EnablementDocument => ({
  format: 'power-eagle/enablement', formatVersion: 1, packages: {}, exports: {},
});

function sortedRecord(values: Record<string, boolean>): Record<string, boolean> {
  return Object.fromEntries(Object.entries(values).sort(([left], [right]) => left.localeCompare(right)));
}

export class EnablementPreferences {
  private constructor(
    private readonly persistence: EnablementPersistence,
    private document: EnablementDocument,
    private readonly packageDefaults: Readonly<Record<string, boolean>>,
  ) {}

  static open(persistence: EnablementPersistence, packageDefaults: Readonly<Record<string, boolean>> = {}): EnablementPreferences {
    const raw = persistence.read();
    if (raw === null) return new EnablementPreferences(persistence, emptyDocument(), packageDefaults);
    try {
      return new EnablementPreferences(persistence, preferenceSchema.parse(JSON.parse(raw)), packageDefaults);
    } catch (error) {
      throw new EnablementPreferenceError('Invalid persisted Power Eagle enablement preferences', error);
    }
  }

  packageEnabled(packageId: string): boolean { return this.document.packages[packageId] ?? this.packageDefaults[packageId] ?? true; }
  exportEnabled(identity: string): boolean { return this.document.exports[identity] ?? true; }

  setPackage(packageId: string, enabled: boolean): void {
    identifier.parse(packageId);
    this.document.packages[packageId] = enabled;
    this.persist();
  }

  setExport(identity: string, enabled: boolean): void {
    qualifiedId.parse(identity);
    this.document.exports[identity] = enabled;
    this.persist();
  }

  snapshot(): EnablementDocument {
    return {
      ...this.document,
      packages: sortedRecord(this.document.packages),
      exports: sortedRecord(this.document.exports),
    };
  }

  private persist(): void {
    this.document = this.snapshot();
    this.persistence.write(`${JSON.stringify(this.document, null, 2)}\n`);
  }
}

export class WebStorageEnablementPersistence implements EnablementPersistence {
  constructor(private readonly storage: Storage, private readonly key = 'power-eagle.enablement.v1') {}
  read(): string | null { return this.storage.getItem(this.key); }
  write(value: string): void { this.storage.setItem(this.key, value); }
}

export type EffectiveStatus = 'active' | 'off' | 'failed';

export interface EffectiveReason {
  code: 'package-off' | 'export-off' | 'dependency-off' | 'dependency-failed' | RegistryDiagnostic['code'];
  message: string;
  dependency?: string;
}

export interface EffectiveExport extends RegistryExport {
  desiredPackage: boolean;
  desiredExport: boolean;
  effectiveStatus: EffectiveStatus;
  reason?: EffectiveReason;
}

export interface EffectivePackage {
  packageId: string;
  desired: boolean;
  effectiveStatus: EffectiveStatus;
  exports: string[];
  reason?: EffectiveReason;
}

export interface EffectiveRegistry {
  exports: EffectiveExport[];
  active: ReadonlyMap<string, EffectiveExport>;
  packages: ReadonlyMap<string, EffectivePackage>;
}

function structuralReason(node: RegistryExport): EffectiveReason {
  const first = node.diagnostics[0];
  return { code: first.code, message: first.message, ...(first.dependency ? { dependency: first.dependency } : {}) };
}

export function reconcileEnablement(graph: ExportRegistryGraph, preferences: EnablementPreferences): EffectiveRegistry {
  const effective = graph.exports.map<EffectiveExport>(node => {
    const desiredPackage = preferences.packageEnabled(node.packageId);
    const desiredExport = preferences.exportEnabled(node.identity);
    if (!desiredPackage) {
      return { ...node, desiredPackage, desiredExport, effectiveStatus: 'off', reason: { code: 'package-off', message: `Package ${node.packageId} is disabled` } };
    }
    if (!desiredExport) {
      return { ...node, desiredPackage, desiredExport, effectiveStatus: 'off', reason: { code: 'export-off', message: `Export ${node.identity} is disabled` } };
    }
    if (node.status === 'failed') return { ...node, desiredPackage, desiredExport, effectiveStatus: 'failed', reason: structuralReason(node) };
    return { ...node, desiredPackage, desiredExport, effectiveStatus: 'active' };
  });
  const groups = new Map<string, EffectiveExport[]>();
  effective.forEach(node => {
    const group = groups.get(node.identity) ?? [];
    group.push(node);
    groups.set(node.identity, group);
  });
  const unique = new Map<string, EffectiveExport>();
  groups.forEach((group, identity) => { if (group.length === 1) unique.set(identity, group[0]); });

  graph.activationOrder.forEach(identity => {
    const node = unique.get(identity)!;
    if (node.effectiveStatus === 'off') return;
    for (const dependency of node.dependencies) {
      const target = unique.get(dependency.identity);
      if (!target || target.effectiveStatus === 'failed') {
        node.effectiveStatus = 'failed';
        node.reason = {
          code: 'dependency-failed', dependency: dependency.identity,
          message: `Required export ${dependency.identity} failed${target?.reason ? `: ${target.reason.message}` : ''}`,
        };
        break;
      }
      if (target.effectiveStatus === 'off') {
        node.effectiveStatus = 'failed';
        node.reason = { code: 'dependency-off', dependency: dependency.identity, message: `Required export ${dependency.identity} is off` };
        break;
      }
    }
  });

  const active = new Map<string, EffectiveExport>();
  graph.activationOrder.forEach(identity => {
    const node = unique.get(identity)!;
    if (node.effectiveStatus === 'active') active.set(identity, node);
  });
  const packageGroups = new Map<string, EffectiveExport[]>();
  effective.forEach(node => {
    const group = packageGroups.get(node.packageId) ?? [];
    group.push(node);
    packageGroups.set(node.packageId, group);
  });
  const packages = new Map<string, EffectivePackage>();
  [...packageGroups].sort(([left], [right]) => left.localeCompare(right)).forEach(([packageId, nodes]) => {
    const desired = preferences.packageEnabled(packageId);
    const failed = nodes.find(node => node.effectiveStatus === 'failed');
    const effectiveStatus: EffectiveStatus = !desired ? 'off' : failed ? 'failed' : nodes.some(node => node.effectiveStatus === 'active') ? 'active' : 'off';
    packages.set(packageId, {
      packageId, desired, effectiveStatus,
      exports: [...new Set(nodes.map(node => node.identity))].sort(),
      ...(failed?.reason ? { reason: failed.reason } : {}),
    });
  });
  return { exports: effective, active, packages };
}
