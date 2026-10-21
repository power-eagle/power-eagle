import { initializeSaucepan, type ManagerOptions, type SaucepanManagerState } from './saucepan-manager';
import { PowerEagleSaucepan, type PackageRequest, type RetainedPackage } from './saucepan-client';
import { AcquiredPackageRepository, type AcquiredContributionPackage } from './package-repository';
import type { PluginCatalog } from '../workspaces/catalog';
import type { PluginInstance } from '../workspaces/model';
import type { CopyOptions } from '../workspaces/artifact-copy';

const EXPLICIT_UPDATE = '67cfcb22-8741-48cd-a464-55f1076a77b9';

/** Workbench ownership only. Source resolution and policy expansion remain manager operations. */
export class WorkbenchAcquisition {
  readonly app?: PowerEagleSaucepan;
  readonly repository?: AcquiredPackageRepository;
  #tail: Promise<unknown> = Promise.resolve();
  #closed = false;
  #sessions = new Map<string, { record: AcquiredContributionPackage; reader: { close(): Promise<void> }; disposalError?: Error }>();
  constructor(readonly catalog: PluginCatalog, readonly manager: SaucepanManagerState, stateRoot?: string) {
    if (manager.status === 'ready' && catalog.store && stateRoot) {
      this.app = new PowerEagleSaucepan({ client: manager.client, stateRoot, hostRequire: catalog.store.hostRequire });
      this.repository = new AcquiredPackageRepository(this.app, catalog.store.hostRequire);
    }
  }
  get unavailable(): string | undefined {
    return this.manager.status === 'unavailable'
      ? `${this.manager.error.message}. ${this.manager.error.recovery}`
      : !this.app ? 'Open Power Eagle in Eagle to manage packages.' : undefined;
  }
  private enqueue<T>(run: () => Promise<T>): Promise<T> {
    if (this.#closed) return Promise.reject(new Error('Package management is closing.'));
    const work = this.#tail.then(async () => {
      if (this.unavailable) throw new Error(this.unavailable);
      return run();
    });
    this.#tail = work.catch(() => {}); return work;
  }
  setup(): Promise<void> { return this.enqueue(async () => { await this.app!.initializeStore(); }); }
  private async explicitRequest(request: PackageRequest): Promise<PackageRequest> {
    if (request.policyRefs) return request;
    // The user explicitly requested retrieval/update. Stable refs preserve the same acquisition slot.
    const profile = await this.app!.registerProfile('explicit-update', {
      catalog: [{ uuid: EXPLICIT_UPDATE, type: 'update_policy', mode: 'always' }],
      acquisitionPolicyRefs: [EXPLICIT_UPDATE],
    });
    return { ...request, policyRefs: profile.combined_policy_refs };
  }
  install(request: PackageRequest): Promise<PluginInstance> {
    return this.enqueue(() => this.installNow(request));
  }
  private async installNow(request: PackageRequest): Promise<PluginInstance> {
    await this.app!.ensureRegistration();
    const selected = await this.explicitRequest(request);
    let installed: PluginInstance | undefined;
    let previous: RetainedPackage | undefined;
    await this.repository!.acquirePersistent(selected, async (record, publish) => {
      const current = this.catalog.store!.read().instances.find(item => item.acquisition?.slot === record.acquired.slot);
      previous = current?.acquisition && this.app!.retainedReceipts().find(item => item.pinUuid === current.acquisition!.pinUuid);
      installed = await this.catalog.importAcquired(record, publish);
    });
    if (previous && previous.pinUuid !== installed!.acquisition!.pinUuid) {
      try { await this.app!.forget(previous); await this.app!.release(previous); }
      catch (error) { throw new Error(`The new revision is installed, but prior retention needs cleanup: ${String(error)}`); }
    }
    return installed!;
  }
  refresh(instanceId: string): Promise<PluginInstance> {
    return this.enqueue(async () => {
      const instance = this.catalog.store!.read().instances.find(item => item.instanceId === instanceId);
      if (!instance?.acquisition) throw new Error('Select an installed source package to refresh.');
      if (instance.currentRevision !== instance.acquisition.revision) throw new Error('This plugin has a selected local edit. Select its acquired revision before refreshing from source.');
      const receipt = this.receipt(instance);
      return this.installNow(receipt.request);
    });
  }
  private receipt(instance: PluginInstance): RetainedPackage {
    const receipt = this.app!.retainedReceipts().find(item => item.pinUuid === instance.acquisition?.pinUuid);
    if (!receipt || receipt.slot !== instance.acquisition?.slot) throw new Error('The installed revision has no matching retained receipt. Inspect acquisition state before recovery.');
    return receipt;
  }
  remove(instanceId: string): Promise<void> {
    return this.enqueue(async () => {
      const instance = this.catalog.store!.read().instances.find(item => item.instanceId === instanceId);
      if (!instance?.acquisition) throw new Error('Select an acquired installation to remove.');
      const receipt = this.receipt(instance);
      await this.catalog.removeAcquired(instanceId);
      try { await this.app!.forget(receipt); await this.app!.release(receipt); }
      catch (error) { throw new Error(`The installation was removed; its retained receipt needs cleanup: ${String(error)}`); }
    });
  }
  preview(request: PackageRequest): Promise<string> {
    return this.enqueue(async () => {
      let id = '';
      await this.repository!.acquireSession(await this.explicitRequest(request), async record => {
        const reader = await this.repository!.reader(record);
        try {
          id = await this.catalog.openPreview(record);
          this.#sessions.set(id, { record, reader });
        } catch (error) { await reader.close(); throw error; }
      });
      return id;
    });
  }
  closePreview(id: string): Promise<void> { return this.enqueue(() => this.closeNow(id)); }
  copyPreview(id: string, name: string, options?: CopyOptions): Promise<PluginInstance> {
    return this.enqueue(async () => {
      const session = this.#sessions.get(id);
      const entry = this.catalog.snapshot().entries.find(item => item.instance.instanceId === id);
      if (!session || !entry) throw new Error('The preview has closed.');
      const reader = await this.repository!.reader(session.record);
      try {
        const copy = await this.catalog.store!.copyPreview(name, entry.instance, reader.directory, options);
        await this.catalog.refresh(); return copy;
      } finally { await reader.close(); }
    });
  }
  private async closeNow(id: string): Promise<void> {
    const session = this.#sessions.get(id);
    if (!session) return;
    if (session.disposalError) throw session.disposalError;
    try { await this.catalog.closePreview(id); }
    catch (error) {
      session.disposalError = new Error(`Preview disposal failed; its reader and pin remain retained for recovery: ${String(error)}`);
      throw session.disposalError;
    }
    await session.reader.close();
    await this.repository!.dispose(session.record);
    this.#sessions.delete(id);
  }
  async dispose(): Promise<void> {
    this.#closed = true;
    await this.#tail;
    for (const id of this.#sessions.keys()) await this.closeNow(id);
  }
}

export async function openWorkbenchAcquisition(catalog: PluginCatalog, options: ManagerOptions = {}) {
  const hostRequire = catalog.store?.hostRequire;
  const stateRoot = catalog.store?.bounded('acquisition');
  const manager = await initializeSaucepan({ ...options, ...(hostRequire ? { hostRequire } : {}) });
  return new WorkbenchAcquisition(catalog, manager, stateRoot);
}
