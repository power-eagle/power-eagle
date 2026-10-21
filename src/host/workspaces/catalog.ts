import { ActivationController } from '../activation/controller';
import { discoverContributionPackage, loadCompiledContributions, type LoadedContribution, type ProviderLoadOptions } from '../install/contribution-package';
import type { WorkspaceStore } from './store';
import type { InstancePreferences } from './preferences';
import { instanceRegistrations, resolveInstanceClaims, type InstancePackage, type ClaimedRegistry } from './claims';
import type { CopyOptions } from './artifact-copy';
import { newPluginInstance, type WorkspaceCatalog } from './model';
import type { AcquiredContributionPackage } from '../install/package-repository';
import type { WorkbenchAcquisition } from '../install/workbench-acquisition';

export interface CatalogEntry extends InstancePackage { failure?: string; session?: boolean }
export interface CatalogSnapshot extends ClaimedRegistry { entries: readonly CatalogEntry[]; order: readonly string[] }

export class PluginCatalog {
  readonly controller = new ActivationController();
  acquisition?: WorkbenchAcquisition;
  acquisitionError?: string;
  #sessions = new Map<string, CatalogEntry>();
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
  private async reconcile(candidate?: WorkspaceCatalog, notify = true, strict = false): Promise<void> {
    const saved = candidate ?? this.store?.read();
    const order = [...(saved?.order ?? this.preview.map(item => item.instance.instanceId)), ...this.#sessions.keys()];
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
    entries.push(...this.#sessions.values());
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
      if (entry.failure || errors.length) {
        claim.status = 'failed'; claim.reason = entry.failure ?? errors.map(item => item.message).join('\n');
        const packageState = result.registry.packages.get(entry.instance.namespace);
        if (packageState) { packageState.effectiveStatus = 'failed'; packageState.reason = { code: 'dependency-failed', message: claim.reason }; }
      }
    }
    for (const node of result.registry.exports) {
      const failure = activation.failures.get(node.identity);
      if (failure) { node.effectiveStatus = 'failed'; node.reason = { code: 'dependency-failed', message: failure.message }; }
    }
    result.registry.active = new Map([...result.registry.active].filter(([id]) => activation.snapshot.all.has(id)));
    this.#snapshot = { ...result, entries, order };
    if (strict && activation.failures.size) throw new Error([...activation.failures.values()].map(item => item.message).join('\n'));
    if (notify) this.#listeners.forEach(listener => listener());
  }
  setEnabled(id: string, value: boolean): Promise<void> { return this.enqueue(async () => { this.preferences.setInstance(id, value); await this.reconcile(); }); }
  setExport(id: string, exportId: string, value: boolean): Promise<void> { return this.enqueue(async () => { this.preferences.setExport(id, exportId, value); await this.reconcile(); }); }
  async create(name: string, source?: { instanceId: string; revision: number }, options?: CopyOptions) {
    if (!this.store) throw new Error('Open Power Eagle in Eagle to save plugin workspaces.');
    const session = source && this.#sessions.get(source.instanceId);
    if (session) {
      if (!this.acquisition) throw new Error('The preview owner is unavailable.');
      return this.acquisition.copyPreview(session.instance.instanceId, name, options);
    }
    const instance = await this.store.create(name, source, options);
    await this.refresh(); return instance;
  }
  async move(id: string, before: string | null): Promise<void> {
    if (!this.store) throw new Error('Open Power Eagle in Eagle to save plugin order.');
    await this.enqueue(async () => {
      if (this.#sessions.has(id) || (before && this.#sessions.has(before))) throw new Error('Install a preview before changing its saved order.');
      const order = this.store!.read().order.filter(item => item !== id);
      if (!this.#snapshot.order.includes(id) || (before && !order.includes(before))) throw new Error('Plugin order target is unavailable');
      order.splice(before ? order.indexOf(before) : order.length, 0, id);
      await this.store!.reorder(order); await this.reconcile();
    });
  }
  importAcquired(record: AcquiredContributionPackage, publish: () => Promise<void>) {
    if (!this.store) throw new Error('Open Power Eagle in Eagle to install packages.');
    return this.enqueue(async () => {
      const instance = await this.store!.importAcquired(record.acquired, async (candidate, installed) => {
        await this.reconcile(candidate, false, true);
        const claim = this.#snapshot.claims.get(installed.instanceId)!;
        if (claim.status === 'failed') throw new Error(claim.reason ?? 'Package activation failed');
      }, publish, async previous => {
        const previousKeys = new Set(previous.instances.map(item => `${item.instanceId}@${item.currentRevision}`));
        for (const key of this.#loaded.keys()) if (!previousKeys.has(key)) this.#loaded.delete(key);
        for (const key of this.#discovered.keys()) if (!previousKeys.has(key)) this.#discovered.delete(key);
        await this.reconcile(previous);
      });
      this.#listeners.forEach(listener => listener());
      return instance;
    });
  }
  removeAcquired(id: string): Promise<void> {
    if (!this.store) throw new Error('Open Power Eagle in Eagle to remove packages.');
    return this.enqueue(async () => {
      await this.store!.removeAcquired(id, candidate => this.reconcile(candidate, false, true), previous => this.reconcile(previous));
      this.#listeners.forEach(listener => listener());
    });
  }
  openPreview(record: AcquiredContributionPackage): Promise<string> {
    return this.enqueue(async () => {
      if (this.#snapshot.entries.some(item => item.instance.namespace === record.discovered.manifest.id)) throw new Error('This namespace is already in Sources. Refresh its installed instance or close the existing preview.');
      const instance = newPluginInstance(record.discovered.manifest.name, { kind: 'acquired', sourceId: record.acquired.sourceUuid });
      instance.namespace = record.discovered.manifest.id;
      this.#sessions.set(instance.instanceId, { instance, discovered: record.discovered, session: true });
      try {
        await this.reconcile(undefined, false, true);
        const claim = this.#snapshot.claims.get(instance.instanceId)!;
        if (claim.status === 'failed') throw new Error(claim.reason ?? 'Preview activation failed');
        this.#listeners.forEach(listener => listener());
        return instance.instanceId;
      } catch (error) { this.#sessions.delete(instance.instanceId); await this.reconcile(); throw error; }
    });
  }
  closePreview(id: string): Promise<void> {
    return this.enqueue(async () => { this.#sessions.delete(id); await this.reconcile(undefined, true, true); });
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
  async dispose(): Promise<void> {
    await this.acquisition?.dispose();
    await this.enqueue(() => this.controller.dispose());
  }
}
