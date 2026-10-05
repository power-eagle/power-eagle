import type { ExportDescriptor, Json } from '../../sdui/schema/model';
import { ActivationScope } from '../../sdui/runtime/lifecycle';
import type {
  InvocationContext, ProviderActivation, ProviderActivationContext, ProviderServiceHandle, ServiceImplementation,
} from '../../sdui/sdk/provider';
import type { DiscoveredPackage, LoadedContribution } from '../install/contribution-package';
import type { EffectiveRegistry } from './enablement';

export interface ActivationRegistration {
  identity: string;
  packageId: string;
  group: string;
  kind: ExportDescriptor['kind'];
  value: unknown;
  activate?: ProviderActivation;
}

export interface ActivationFailure {
  identity: string;
  group: string;
  message: string;
  cause?: unknown;
}

export interface ActivationResult {
  snapshot: ActivationSnapshot;
  failures: ReadonlyMap<string, ActivationFailure>;
}

export interface ActivationSnapshot {
  all: ReadonlyMap<string, ActivationRegistration>;
  runtime: ReadonlyMap<string, ActivationRegistration>;
  widget: ReadonlyMap<string, ActivationRegistration>;
  styling: ReadonlyMap<string, ActivationRegistration>;
  action: ReadonlyMap<string, ActivationRegistration>;
  service: ReadonlyMap<string, ActivationRegistration>;
}

interface ServiceSlot {
  identity: string;
  active: boolean;
  implementation: ServiceImplementation;
}

interface ActiveRecord {
  registration: ActivationRegistration;
  scope: ActivationScope;
  dependencies: string[];
  service?: ServiceSlot;
}

export class RevokedServiceHandleError extends Error {
  constructor(readonly identity: string) {
    super(`Service handle ${identity} is no longer active`);
    this.name = 'RevokedServiceHandleError';
  }
}

class ManagedServiceHandle implements ProviderServiceHandle {
  constructor(private readonly slot: ServiceSlot) {}
  async invoke(method: string, args: Json, context: InvocationContext): Promise<Json> {
    if (!this.slot.active) throw new RevokedServiceHandleError(this.slot.identity);
    const implementation = this.slot.implementation.methods[method];
    if (!implementation) throw new Error(`Service ${this.slot.identity} has no method ${method}`);
    return implementation(args, { ...context, method });
  }
}

function message(error: unknown): string { return error instanceof Error ? error.message : String(error); }

function serviceImplementation(value: unknown, identity: string): ServiceImplementation {
  if (!value || typeof value !== 'object' || Array.isArray(value) || !(value as Partial<ServiceImplementation>).methods) {
    throw new Error(`Service export ${identity} has no method implementations`);
  }
  return value as ServiceImplementation;
}

function sameRegistration(left: ActivationRegistration, right: ActivationRegistration): boolean {
  return left.identity === right.identity && left.group === right.group && left.kind === right.kind &&
    left.value === right.value && left.activate === right.activate;
}

export function contributionRegistrations(discovered: DiscoveredPackage, loaded: readonly LoadedContribution[]): ActivationRegistration[] {
  const registrations: ActivationRegistration[] = [];
  if (discovered.runtime) {
    discovered.manifest.exports.filter(descriptor => descriptor.kind === 'runtime').forEach(descriptor => {
      registrations.push({
        identity: `${discovered.manifest.id}/${descriptor.id}`, packageId: discovered.manifest.id,
        group: `${discovered.manifest.id}:runtime`, kind: 'runtime', value: discovered.runtime,
      });
    });
  }
  loaded.forEach(contribution => {
    contribution.exports.forEach(item => {
      registrations.push({
        identity: `${discovered.manifest.id}/${item.descriptor.id}`, packageId: discovered.manifest.id,
        group: `${discovered.manifest.id}:${contribution.contribution}`, kind: item.descriptor.kind,
        value: item.implementation, ...(item.activate ? { activate: item.activate } : {}),
      });
    });
  });
  return registrations.sort((left, right) => left.identity.localeCompare(right.identity));
}

export class ActivationController {
  #records = new Map<string, ActiveRecord>();
  #services = new Map<string, ServiceSlot>();
  #order: string[] = [];

  get snapshot(): ActivationSnapshot {
    const all = new Map([...this.#records].map(([identity, record]) => [identity, record.registration]));
    const kind = (value: ExportDescriptor['kind']) => new Map([...all].filter(([, registration]) => registration.kind === value));
    return { all, runtime: kind('runtime'), widget: kind('widget'), styling: kind('styling'), action: kind('action'), service: kind('service') };
  }

  service(identity: string): ProviderServiceHandle {
    const slot = this.#services.get(identity);
    if (!slot?.active) throw new RevokedServiceHandleError(identity);
    return new ManagedServiceHandle(slot);
  }

  async reconcile(registry: EffectiveRegistry, input: readonly ActivationRegistration[]): Promise<ActivationResult> {
    const failures = new Map<string, ActivationFailure>();
    const registrations = new Map(input.map(registration => [registration.identity, registration]));
    const desired = new Set(registry.active.keys());
    const activeNodes = new Map(registry.exports.filter(item => registry.active.has(item.identity)).map(item => [item.identity, item]));
    const replacementGroups = new Set<string>();
    const changed = new Set<string>();
    desired.forEach(identity => {
      const currentRecord = this.#records.get(identity);
      const current = currentRecord?.registration;
      const next = registrations.get(identity);
      const dependencies = (activeNodes.get(identity)?.dependencies ?? []).map(dependency => dependency.identity).sort();
      const dependencyChanged = currentRecord && currentRecord.dependencies.join('\0') !== dependencies.join('\0');
      if (current && (!next || !sameRegistration(current, next) || dependencyChanged)) changed.add(identity);
    });
    let expanded = true;
    while (expanded) {
      expanded = false;
      activeNodes.forEach(node => {
        if (changed.has(node.identity) || !node.dependencies.some(dependency => changed.has(dependency.identity))) return;
        changed.add(node.identity);
        expanded = true;
      });
    }
    changed.forEach(identity => {
      const current = this.#records.get(identity);
      if (current) replacementGroups.add(current.registration.group);
    });
    const remove = new Set<string>();
    this.#records.forEach((record, identity) => {
      if (!desired.has(identity) || replacementGroups.has(record.registration.group)) remove.add(identity);
    });
    await this.disposeSelected(remove, failures);

    const desiredOrder = [...registry.active.keys()];
    const groups = new Map<string, string[]>();
    desiredOrder.forEach(identity => {
      if (this.#records.has(identity)) return;
      const group = registrations.get(identity)?.group ?? `missing:${identity}`;
      const members = groups.get(group) ?? [];
      members.push(identity);
      groups.set(group, members);
    });
    const groupDependencies = new Map<string, Set<string>>();
    groups.forEach((members, group) => {
      const dependencies = new Set<string>();
      members.forEach(identity => activeNodes.get(identity)?.dependencies.forEach(dependency => {
        const dependencyGroup = registrations.get(dependency.identity)?.group;
        if (dependencyGroup && dependencyGroup !== group && groups.has(dependencyGroup)) dependencies.add(dependencyGroup);
      }));
      groupDependencies.set(group, dependencies);
    });
    const pending = new Set(groups.keys());
    const processed = new Set<string>();
    while (pending.size) {
      const ready = [...pending].filter(group => [...(groupDependencies.get(group) ?? [])].every(dependency => processed.has(dependency)));
      if (!ready.length) {
        [...pending].sort().forEach(group => {
          groups.get(group)!.forEach(identity => failures.set(identity, { identity, group, message: `Activation group dependency cycle involving ${group}` }));
        });
        break;
      }
      for (const group of ready) {
        pending.delete(group);
        processed.add(group);
        const members = groups.get(group)!;
        const missing = members.find(identity => !registrations.has(identity));
        if (missing) {
          members.forEach(identity => failures.set(identity, { identity, group, message: `No activation registration for ${missing}` }));
          continue;
        }
        const unavailable = members.flatMap(identity => activeNodes.get(identity)?.dependencies ?? [])
          .find(dependency => !members.includes(dependency.identity) && !this.#records.has(dependency.identity));
        if (unavailable) {
          members.forEach(identity => failures.set(identity, { identity, group, message: `Activation dependency ${unavailable.identity} is unavailable` }));
          continue;
        }
        await this.activateGroup(
          group,
          members.map(identity => registrations.get(identity)!),
          new Map(members.map(identity => [identity, (activeNodes.get(identity)?.dependencies ?? []).map(dependency => dependency.identity).sort()])),
          failures,
        );
      }
    }
    this.#order = [...registry.active.keys()].filter(identity => this.#records.has(identity));
    return { snapshot: this.snapshot, failures };
  }

  async dispose(): Promise<void> {
    const failures = new Map<string, ActivationFailure>();
    await this.disposeSelected(new Set(this.#records.keys()), failures);
    this.#order = [];
    if (failures.size) throw new Error([...failures.values()].map(failure => failure.message).join('\n'));
  }

  private async activateGroup(
    group: string,
    registrations: ActivationRegistration[],
    dependencies: ReadonlyMap<string, string[]>,
    failures: Map<string, ActivationFailure>,
  ): Promise<void> {
    const staging = new Map<string, ActiveRecord>();
    const stagingServices = new Map<string, ServiceSlot>();
    try {
      registrations.forEach(registration => {
        const scope = new ActivationScope(`provider:${registration.identity}`);
        const service = registration.kind === 'service'
          ? { identity: registration.identity, active: true, implementation: serviceImplementation(registration.value, registration.identity) }
          : undefined;
        if (service) stagingServices.set(registration.identity, service);
        staging.set(registration.identity, { registration, scope, dependencies: dependencies.get(registration.identity) ?? [], ...(service ? { service } : {}) });
      });
      for (const registration of registrations) {
        const record = staging.get(registration.identity)!;
        if (!registration.activate) continue;
        const context: ProviderActivationContext = {
          signal: record.scope.signal,
          use: disposer => record.scope.use(disposer),
          service: identity => {
            const slot = stagingServices.get(identity) ?? this.#services.get(identity);
            if (!slot?.active) throw new RevokedServiceHandleError(identity);
            return new ManagedServiceHandle(slot);
          },
        };
        const disposer = await registration.activate(context);
        if (disposer) record.scope.use(disposer);
      }
      staging.forEach((record, identity) => this.#records.set(identity, record));
      stagingServices.forEach((slot, identity) => this.#services.set(identity, slot));
    } catch (error) {
      stagingServices.forEach(slot => { slot.active = false; });
      for (const record of [...staging.values()].reverse()) {
        try { await record.scope.dispose(); } catch { /* activation error remains primary */ }
      }
      registrations.forEach(registration => failures.set(registration.identity, {
        identity: registration.identity, group, message: `Activation failed for ${group}: ${message(error)}`, cause: error,
      }));
    }
  }

  private async disposeSelected(identities: Set<string>, failures: Map<string, ActivationFailure>): Promise<void> {
    const ordered = [...this.#order].reverse();
    [...identities].sort().reverse().forEach(identity => { if (!ordered.includes(identity)) ordered.push(identity); });
    for (const identity of ordered) {
      if (!identities.has(identity)) continue;
      const record = this.#records.get(identity);
      if (!record) continue;
      if (record.service) record.service.active = false;
      this.#services.delete(identity);
      this.#records.delete(identity);
      try {
        await record.scope.dispose();
      } catch (error) {
        failures.set(identity, { identity, group: record.registration.group, message: `Disposal failed for ${identity}: ${message(error)}`, cause: error });
      }
    }
  }
}
