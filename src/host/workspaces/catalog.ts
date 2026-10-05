import { ActivationController } from '../activation/controller';
import { discoverContributionPackage, loadCompiledContributions, type LoadedContribution, type ProviderLoadOptions } from '../install/contribution-package';
import type { WorkspaceStore } from './store';
import type { InstancePreferences } from './preferences';
import { instanceRegistrations, resolveInstanceClaims, type InstancePackage, type ClaimedRegistry } from './claims';
import type { CopyOptions } from './artifact-copy';

export interface CatalogEntry extends InstancePackage { failure?: string }
export interface CatalogSnapshot extends ClaimedRegistry { entries: readonly CatalogEntry[]; order: readonly string[] }

export class PluginCatalog {
  readonly controller = new ActivationController();
  #listeners = new Set<() => void>();
  #loaded = new Map<string, LoadedContribution[]>();
  #discovered = new Map<string, CatalogEntry['discovered']>();
  #tail: Promise<unknown> = Promise.resolve();
  #snapshot: CatalogSnapshot;
  constructor(readonly preferences: InstancePreferences, readonly loadOptions: ProviderLoadOptions | undefined, readonly store?: WorkspaceStore,
    readonly preview: readonly CatalogEntry[] = [], readonly previewLoad?: (entry: CatalogEntry) => LoadedContribution[]) {
    this.#snapshot = { ...resolveInstanceClaims([], [], preferences), entries: [], order: [] };
  }
  subscribe = (callback: () => void) => { this.#listeners.add(callback); return () => { this.#listeners.delete(callback); }; };
  snapshot = () => this.#snapshot;
  private enqueue<T>(run: () => Promise<T>): Promise<T> {
    const next = this.#tail.then(run); this.#tail = next.catch(() => {}); return next;
  }
  refresh(): Promise<void> { return this.enqueue(() => this.reconcile()); }
  private async reconcile(): Promise<void> {
    const saved = this.store?.read();
    const order = saved?.order ?? this.preview.map(item => item.instance.instanceId);
    const entries: CatalogEntry[] = saved ? saved.instances.map(instance => {
      const key = `${instance.instanceId}@${instance.currentRevision}`;
      let discovered = this.#discovered.get(key);
      if (!discovered) {
        try {
          discovered = discoverContributionPackage(this.store!.artifact(instance), this.store!.hostRequire);
          this.#discovered.set(key, discovered);
        } catch (error) {
          return { instance, failure: String(error), discovered: { root: '', manifestPath: '', entries: {}, assets: {},
            manifest: { format: 'power-eagle/package' as const, formatVersion: 1 as const, id: instance.namespace, name: instance.name, version: '0.0.0', sdk: '^1.0.0', description: 'Artifact could not be read', contributions: {}, exports: [], dependencies: [], assets: [] } } };
        }
      }
      return { instance, discovered };
    }) : [...this.preview];
    entries.sort((a, b) => order.indexOf(a.instance.instanceId) - order.indexOf(b.instance.instanceId));
    const result = resolveInstanceClaims(entries, order, this.preferences);
    const registrations = [...result.owners.values()].flatMap(owner => {
      const key = `${owner.instance.instanceId}@${owner.instance.currentRevision}`;
      try {
        if (entries.find(item => item.instance.instanceId === owner.instance.instanceId)?.failure) return [];
        let loaded = this.#loaded.get(key);
        if (!loaded) {
          loaded = this.loadOptions ? loadCompiledContributions(owner.discovered, this.loadOptions) : this.previewLoad?.(owner) ?? [];
          this.#loaded.set(key, loaded);
        }
        return instanceRegistrations(owner, loaded);
      } catch (error) {
        entries.find(item => item.instance.instanceId === owner.instance.instanceId)!.failure = String(error);
        return [];
      }
    });
    const activation = await this.controller.reconcile(result.registry, registrations);
    for (const entry of entries) {
      const claim = result.claims.get(entry.instance.instanceId)!;
      if (result.owners.get(entry.instance.namespace)?.instance.instanceId !== entry.instance.instanceId) continue;
      const errors = [...activation.failures.values()].filter(item => item.identity.startsWith(`${entry.instance.namespace}/`));
      if (entry.failure || errors.length) { claim.status = 'failed'; claim.reason = entry.failure ?? errors.map(item => item.message).join('\n'); }
    }
    for (const node of result.registry.exports) {
      const failure = activation.failures.get(node.identity);
      if (failure) { node.effectiveStatus = 'failed'; node.reason = { code: 'dependency-failed', message: failure.message }; }
    }
    result.registry.active = new Map([...result.registry.active].filter(([id]) => activation.snapshot.all.has(id)));
    this.#snapshot = { ...result, entries, order };
    this.#listeners.forEach(listener => listener());
  }
  setEnabled(id: string, value: boolean): Promise<void> { return this.enqueue(async () => { this.preferences.setInstance(id, value); await this.reconcile(); }); }
  setExport(id: string, exportId: string, value: boolean): Promise<void> { return this.enqueue(async () => { this.preferences.setExport(id, exportId, value); await this.reconcile(); }); }
  async create(name: string, source?: { instanceId: string; revision: number }, options?: CopyOptions) {
    if (!this.store) throw new Error('Open Power Eagle in Eagle to save plugin workspaces.');
    const instance = await this.store.create(name, source, options);
    await this.refresh(); return instance;
  }
  async move(id: string, before: string | null): Promise<void> {
    if (!this.store) throw new Error('Open Power Eagle in Eagle to save plugin order.');
    await this.enqueue(async () => {
      const order = this.store!.read().order.filter(item => item !== id);
      if (!this.#snapshot.order.includes(id) || (before && !order.includes(before))) throw new Error('Plugin order target is unavailable');
      order.splice(before ? order.indexOf(before) : order.length, 0, id);
      await this.store!.reorder(order); await this.reconcile();
    });
  }
  runtimeKey(identity: string): string {
    const visited = new Set<string>();
    const visit = (id: string): string => {
      if (visited.has(id)) return ''; visited.add(id);
      const registration = this.controller.snapshot.all.get(id);
      const dependencies = this.#snapshot.registry.exports.find(item => item.identity === id)?.dependencies ?? [];
      return `${registration?.group ?? 'off'}[${dependencies.map(item => visit(item.identity)).join(',')}]`;
    };
    return visit(identity);
  }
  dispose(): Promise<void> { return this.enqueue(() => this.controller.dispose()); }
}
