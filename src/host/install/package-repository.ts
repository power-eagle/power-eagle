import {
  ContributionPackageError,
  discoverContributionPackage,
  type DiscoveredPackage,
  type PackageDiscoveryOptions,
} from './contribution-package';
import type { PackageRequest, RetainedPackage } from './saucepan-client';
import type { WorkspaceStore } from '../workspaces/store';

export type PackagePersistence = 'persistent' | 'session';
export interface AcquiredContributionPackage {
  persistence: PackagePersistence;
  acquired: RetainedPackage;
  discovered: DiscoveredPackage;
}
export interface PersistentRefreshFailure {
  resource: RetainedPackage;
  error: unknown;
  retained?: AcquiredContributionPackage;
}
export interface PersistentRefreshResult {
  packages: AcquiredContributionPackage[];
  failures: PersistentRefreshFailure[];
}
export interface PackageAcquisitionSource {
  acquirePersistent(request: PackageRequest): Promise<RetainedPackage>;
  acquireSession(request: PackageRequest): Promise<RetainedPackage>;
  retainedPackages(): Promise<RetainedPackage[]>;
  publish(receipt: RetainedPackage): Promise<void>;
  forget(receipt: RetainedPackage): Promise<void>;
  release(receipt: RetainedPackage): Promise<void>;
  retainReader(
    receipt: RetainedPackage,
  ): Promise<{ directory: string; close: () => Promise<void> }>;
}
export class PackageAcquisitionError extends Error {
  constructor(
    readonly persistence: PackagePersistence,
    readonly acquired: RetainedPackage,
    readonly validation: unknown,
    readonly retained?: AcquiredContributionPackage,
  ) {
    super(
      `Acquired ${persistence} package failed validation/activation: ${validation instanceof Error ? validation.message : String(validation)}`,
    );
    this.name = 'PackageAcquisitionError';
  }
}
type Activation = (record: AcquiredContributionPackage) => Promise<void>;
/** Retention follows readers. Replaced packages stay pinned until explicit disposal. */
export class AcquiredPackageRepository {
  readonly #persistent = new Map<string, AcquiredContributionPackage>();
  readonly #session = new Map<string, AcquiredContributionPackage>();
  readonly #readers = new Map<string, number>();
  readonly #closing = new Set<string>();
  readonly #releasing = new Map<string, Promise<void>>();
  constructor(
    private readonly saucepan: PackageAcquisitionSource,
    private readonly hostRequire: NodeRequire,
    private readonly discoveryOptions: PackageDiscoveryOptions = {},
  ) {}
  acquirePersistent(request: PackageRequest, activate?: Activation) {
    return this.acquire(request, 'persistent', activate);
  }
  acquireSession(request: PackageRequest, activate?: Activation) {
    return this.acquire(request, 'session', activate);
  }
  private async acquire(
    request: PackageRequest,
    persistence: PackagePersistence,
    activate?: Activation,
  ): Promise<AcquiredContributionPackage> {
    const acquired = await (persistence === 'persistent'
      ? this.saucepan.acquirePersistent(request)
      : this.saucepan.acquireSession(request));
    const previous = this.#persistent.get(acquired.slot);
    const guard = await this.saucepan.retainReader(acquired);
    try {
      const record = this.discover(acquired);
      await activate?.(record);
      await this.saucepan.publish(acquired);
      (persistence === 'persistent' ? this.#persistent : this.#session).set(
        persistence === 'persistent' ? acquired.slot : acquired.pinUuid,
        record,
      );
      return record;
    } catch (error) {
      // A failed activation may have started readers. Keep the receipt inspectable until explicit disposal.
      throw new PackageAcquisitionError(persistence, acquired, error, previous);
    } finally {
      await guard.close();
    }
  }
  async refreshPersistent(): Promise<PersistentRefreshResult> {
    const failures: PersistentRefreshFailure[] = [];
    for (const resource of await this.saucepan.retainedPackages()) {
      const retained = this.#persistent.get(resource.slot);
      let guard:
        | Awaited<ReturnType<PackageAcquisitionSource['retainReader']>>
        | undefined;
      try {
        guard = await this.saucepan.retainReader(resource);
        this.#persistent.set(resource.slot, this.discover(resource));
      } catch (error) {
        failures.push({ resource, error, ...(retained ? { retained } : {}) });
      } finally {
        await guard?.close();
      }
    }
    return { packages: this.persistent(), failures };
  }
  persistent() {
    return [...this.#persistent.values()].sort((a, b) =>
      a.discovered.manifest.id.localeCompare(b.discovered.manifest.id),
    );
  }
  session() {
    return [...this.#session.values()];
  }
  /** Provider owner must hold this handle until its disposal completes. */
  async reader(record: AcquiredContributionPackage): Promise<{
    directory: string;
    close: () => Promise<void>;
  }> {
    const id = record.acquired.pinUuid;
    if (this.#closing.has(id)) throw new Error('Package is closing');
    this.#readers.set(id, (this.#readers.get(id) ?? 0) + 1);
    let guard: Awaited<ReturnType<PackageAcquisitionSource['retainReader']>>;
    try {
      guard = await this.saucepan.retainReader(record.acquired);
    } catch (error) {
      this.#readers.set(id, this.#readers.get(id)! - 1);
      await this.releaseIfUnused(record);
      throw error;
    }
    let closed = false;
    let detached = false;
    return {
      directory: guard.directory,
      close: async () => {
        if (closed) return;
        await guard.close();
        if (!detached) {
          this.#readers.set(id, this.#readers.get(id)! - 1);
          detached = true;
        }
        await this.releaseIfUnused(record);
        closed = true;
      },
    };
  }
  async copyToWorkspace(
    record: AcquiredContributionPackage,
    store: WorkspaceStore,
  ) {
    const reader = await this.reader(record);
    try {
      return await store.register(reader.directory, {
        kind: 'acquired',
        sourceId: record.acquired.sourceUuid,
      });
    } finally {
      await reader.close();
    }
  }
  /** Uninstall/preview-close only after caller has initiated provider disposal. */
  async dispose(record: AcquiredContributionPackage): Promise<void> {
    await this.saucepan.forget(record.acquired);
    if (this.#persistent.get(record.acquired.slot) === record)
      this.#persistent.delete(record.acquired.slot);
    this.#session.delete(record.acquired.pinUuid);
    this.#closing.add(record.acquired.pinUuid);
    await this.releaseIfUnused(record);
  }
  private async releaseIfUnused(
    record: AcquiredContributionPackage,
  ): Promise<void> {
    const id = record.acquired.pinUuid;
    if (!this.#closing.has(id) || (this.#readers.get(id) ?? 0) > 0) return;
    let work = this.#releasing.get(id);
    if (!work) {
      work = this.saucepan.release(record.acquired);
      this.#releasing.set(id, work);
    }
    try {
      await work;
      this.#readers.delete(id);
    } catch (error) {
      this.#releasing.delete(id);
      throw error;
    }
  }
  private discover(acquired: RetainedPackage): AcquiredContributionPackage {
    if (!acquired.pinUuid)
      throw new ContributionPackageError([
        {
          packageRoot: acquired.directory,
          path: '',
          code: 'retention',
          message: 'No retained output receipt',
        },
      ]);
    return {
      persistence: acquired.persistence,
      acquired,
      discovered: discoverContributionPackage(
        acquired.directory,
        this.hostRequire,
        this.discoveryOptions,
      ),
    };
  }
}
