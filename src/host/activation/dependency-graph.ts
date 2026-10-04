import { satisfies } from 'semver';
import type { Dependency, ExportDescriptor } from '../../sdui/schema/model';
import type { DiscoveredPackage } from '../install/contribution-package';

export type RegistryDiagnosticCode =
  | 'duplicate-export'
  | 'missing-dependency'
  | 'dependency-collision'
  | 'dependency-kind'
  | 'dependency-version'
  | 'dependency-cycle'
  | 'dependency-unavailable';

export interface RegistryDiagnostic {
  code: RegistryDiagnosticCode;
  packageId: string;
  identity: string;
  source: string;
  message: string;
  dependency?: string;
}

export interface RegistryDependency {
  identity: string;
  requirement: Dependency;
}

export interface RegistryExport {
  identity: string;
  packageId: string;
  packageVersion: string;
  source: string;
  descriptor: ExportDescriptor;
  dependencies: RegistryDependency[];
  directConsumers: string[];
  status: 'resolved' | 'failed';
  diagnostics: RegistryDiagnostic[];
}

export interface ExportRegistryGraph {
  exports: RegistryExport[];
  available: ReadonlyMap<string, RegistryExport>;
  activationOrder: string[];
  diagnostics: RegistryDiagnostic[];
}

interface Candidate {
  discovered: DiscoveredPackage;
  node: RegistryExport;
  failures: RegistryDiagnostic[];
  resolvedDependencies: Set<string>;
  consumers: Set<string>;
}

const compare = (left: string, right: string) => left.localeCompare(right);
const identityOf = (packageId: string, exportId: string) => `${packageId}/${exportId}`;

function packageDependencies(discovered: DiscoveredPackage, descriptor: ExportDescriptor): RegistryDependency[] {
  const requirements = [...discovered.manifest.dependencies];
  if (descriptor.kind === 'runtime' && discovered.runtime) requirements.push(...discovered.runtime.dependencies);
  const unique = new Map<string, Dependency>();
  requirements.forEach(requirement => {
    const key = `${identityOf(requirement.package, requirement.export)}\0${requirement.kind}\0${requirement.version}`;
    unique.set(key, requirement);
  });
  return [...unique.values()]
    .map(requirement => ({ identity: identityOf(requirement.package, requirement.export), requirement }))
    .sort((left, right) => compare(left.identity, right.identity) || compare(left.requirement.kind, right.requirement.kind) || compare(left.requirement.version, right.requirement.version));
}

function diagnostic(candidate: Candidate, code: RegistryDiagnosticCode, message: string, dependency?: string): RegistryDiagnostic {
  return {
    code, packageId: candidate.node.packageId, identity: candidate.node.identity,
    source: candidate.node.source, message, ...(dependency ? { dependency } : {}),
  };
}

function stronglyConnected(candidates: Candidate[], edges: ReadonlyMap<string, Set<string>>): string[][] {
  let nextIndex = 0;
  const indexes = new Map<string, number>();
  const lowLinks = new Map<string, number>();
  const stack: string[] = [];
  const onStack = new Set<string>();
  const components: string[][] = [];

  function visit(identity: string): void {
    indexes.set(identity, nextIndex);
    lowLinks.set(identity, nextIndex);
    nextIndex += 1;
    stack.push(identity);
    onStack.add(identity);
    for (const dependency of [...(edges.get(identity) ?? [])].sort(compare)) {
      if (!indexes.has(dependency)) {
        visit(dependency);
        lowLinks.set(identity, Math.min(lowLinks.get(identity)!, lowLinks.get(dependency)!));
      } else if (onStack.has(dependency)) {
        lowLinks.set(identity, Math.min(lowLinks.get(identity)!, indexes.get(dependency)!));
      }
    }
    if (lowLinks.get(identity) !== indexes.get(identity)) return;
    const component: string[] = [];
    let member: string;
    do {
      member = stack.pop()!;
      onStack.delete(member);
      component.push(member);
    } while (member !== identity);
    components.push(component.sort(compare));
  }

  candidates.map(candidate => candidate.node.identity).sort(compare).forEach(identity => {
    if (!indexes.has(identity)) visit(identity);
  });
  return components;
}

function stableOrder(candidates: Candidate[]): string[] {
  const resolved = candidates.filter(candidate => candidate.failures.length === 0);
  const identities = new Set(resolved.map(candidate => candidate.node.identity));
  const indegree = new Map(resolved.map(candidate => [candidate.node.identity, 0]));
  const dependents = new Map<string, Set<string>>();
  resolved.forEach(candidate => {
    candidate.resolvedDependencies.forEach(dependency => {
      if (!identities.has(dependency)) return;
      indegree.set(candidate.node.identity, indegree.get(candidate.node.identity)! + 1);
      const targets = dependents.get(dependency) ?? new Set<string>();
      targets.add(candidate.node.identity);
      dependents.set(dependency, targets);
    });
  });
  const ready = [...indegree].filter(([, count]) => count === 0).map(([identity]) => identity).sort(compare);
  const order: string[] = [];
  while (ready.length) {
    const identity = ready.shift()!;
    order.push(identity);
    for (const dependent of [...(dependents.get(identity) ?? [])].sort(compare)) {
      const remaining = indegree.get(dependent)! - 1;
      indegree.set(dependent, remaining);
      if (remaining === 0) {
        ready.push(dependent);
        ready.sort(compare);
      }
    }
  }
  return order;
}

export function buildExportRegistryGraph(packages: readonly DiscoveredPackage[]): ExportRegistryGraph {
  const candidates = [...packages]
    .sort((left, right) => compare(left.manifest.id, right.manifest.id) || compare(left.manifest.version, right.manifest.version) || compare(left.root, right.root))
    .flatMap(discovered => [...discovered.manifest.exports]
      .sort((left, right) => compare(left.id, right.id) || compare(left.kind, right.kind))
      .map<Candidate>(descriptor => {
        const identity = identityOf(discovered.manifest.id, descriptor.id);
        return {
          discovered, failures: [], resolvedDependencies: new Set(), consumers: new Set(),
          node: {
            identity, packageId: discovered.manifest.id, packageVersion: discovered.manifest.version,
            source: discovered.root, descriptor, dependencies: packageDependencies(discovered, descriptor),
            directConsumers: [], status: 'resolved', diagnostics: [],
          },
        };
      }));
  const byIdentity = new Map<string, Candidate[]>();
  candidates.forEach(candidate => {
    const group = byIdentity.get(candidate.node.identity) ?? [];
    group.push(candidate);
    byIdentity.set(candidate.node.identity, group);
  });

  for (const [identity, group] of [...byIdentity].sort(([left], [right]) => compare(left, right))) {
    if (group.length < 2) continue;
    const sources = group.map(candidate => `${candidate.node.packageVersion} at ${candidate.node.source}`).sort(compare).join(', ');
    group.forEach(candidate => candidate.failures.push(diagnostic(candidate, 'duplicate-export', `Duplicate export ${identity}: ${sources}`)));
  }

  candidates.forEach(candidate => {
    candidate.node.dependencies.forEach(dependency => {
      const targets = byIdentity.get(dependency.identity) ?? [];
      targets.forEach(target => target.consumers.add(candidate.node.packageId));
      if (targets.length === 0) {
        candidate.failures.push(diagnostic(candidate, 'missing-dependency', `Missing required export ${dependency.identity}`, dependency.identity));
        return;
      }
      if (targets.length > 1) {
        candidate.failures.push(diagnostic(candidate, 'dependency-collision', `Required export ${dependency.identity} is ambiguous`, dependency.identity));
        return;
      }
      const target = targets[0];
      if (target.node.descriptor.kind !== dependency.requirement.kind) {
        candidate.failures.push(diagnostic(candidate, 'dependency-kind', `Required export ${dependency.identity} is ${target.node.descriptor.kind}, expected ${dependency.requirement.kind}`, dependency.identity));
        return;
      }
      if (!satisfies(target.node.packageVersion, dependency.requirement.version)) {
        candidate.failures.push(diagnostic(candidate, 'dependency-version', `Required export ${dependency.identity} is version ${target.node.packageVersion}, expected ${dependency.requirement.version}`, dependency.identity));
        return;
      }
      candidate.resolvedDependencies.add(dependency.identity);
    });
  });

  const unique = candidates.filter(candidate => byIdentity.get(candidate.node.identity)?.length === 1);
  const edges = new Map(unique.map(candidate => [candidate.node.identity, candidate.resolvedDependencies]));
  stronglyConnected(unique, edges).forEach(component => {
    const selfCycle = component.length === 1 && edges.get(component[0])?.has(component[0]);
    if (component.length < 2 && !selfCycle) return;
    const cycle = [...component, component[0]].join(' -> ');
    component.forEach(identity => {
      const candidate = byIdentity.get(identity)![0];
      candidate.failures.push(diagnostic(candidate, 'dependency-cycle', `Dependency cycle: ${cycle}`));
    });
  });

  let changed = true;
  while (changed) {
    changed = false;
    unique.forEach(candidate => {
      candidate.resolvedDependencies.forEach(dependency => {
        const target = byIdentity.get(dependency)![0];
        if (target.failures.length === 0 || candidate.failures.some(item => item.code === 'dependency-unavailable' && item.dependency === dependency)) return;
        candidate.failures.push(diagnostic(candidate, 'dependency-unavailable', `Required export ${dependency} is unavailable`, dependency));
        changed = true;
      });
    });
  }

  candidates.forEach(candidate => {
    candidate.node.directConsumers = [...candidate.consumers].sort(compare);
    candidate.node.diagnostics = candidate.failures.sort((left, right) => compare(left.code, right.code) || compare(left.message, right.message));
    candidate.node.status = candidate.failures.length ? 'failed' : 'resolved';
  });
  const activationOrder = stableOrder(candidates);
  const available = new Map<string, RegistryExport>();
  activationOrder.forEach(identity => available.set(identity, byIdentity.get(identity)![0].node));
  const exports = candidates.map(candidate => candidate.node)
    .sort((left, right) => compare(left.identity, right.identity) || compare(left.source, right.source));
  const diagnostics = exports.flatMap(item => item.diagnostics)
    .sort((left, right) => compare(left.identity, right.identity) || compare(left.source, right.source) || compare(left.code, right.code) || compare(left.message, right.message));
  return { exports, available, activationOrder, diagnostics };
}
